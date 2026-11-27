<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderConversation;
use App\Models\OrderItem;
use App\Models\OrderMessage;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class OrderService
{
    public const CONFIRMATION_TIMEOUT_MINUTES = 60;

    public const PICKUP_TIMEOUT_MINUTES = 60;

    public function __construct(private readonly NotificationService $notificationService) {}

    /**
     * Place an order atomically:
     *  1. Validate every item has enough remaining stock.
     *  2. Create the Order record.
     *  3. Create OrderItems.
     *
     * Stock is NOT deducted on order placement — it is deducted only once the
     * vendor marks the order as Completed (picked up by the customer).
     *
     * Payment logic:
     *  - cash => payment_status = paid (no verification needed)
     *  - gcash/maya with reference => pending_verification
     *  - gcash/maya without reference => unpaid (customer must submit later)
     */
    public function placeOrder(User $user, array $items, string $paymentMethod = 'cash', ?string $notes = null, ?string $paymentReference = null, array $vendorPayments = []): Order
    {
        $order = DB::transaction(function () use ($user, $items, $paymentMethod, $notes, $paymentReference, $vendorPayments) {

            // ── 1. Load & lock all products in one query ──────────────────
            $productIds = array_column($items, 'product_id');
            $products = Product::whereIn('id', $productIds)
                ->where('is_available', true)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            // ── 2. Load & lock matching inventories ───────────────────────
            $inventories = Inventory::whereIn('product_id', $productIds)
                ->where('status', 'active')
                ->lockForUpdate()
                ->get()
                ->keyBy('product_id');

            // ── 3. Validate each item ──────────────────────────────────────
            $totalAmount = 0;

            foreach ($items as $item) {
                $product = $products->get($item['product_id']);
                $inventory = $inventories->get($item['product_id']);
                $qty = (float) $item['quantity'];

                if (! $product) {
                    throw new UnprocessableEntityHttpException(
                        "Product \"{$item['product_name']}\" is no longer available."
                    );
                }

                // Validate quantity granularity: 0.5 kg increments for weight, integer otherwise
                $isWeight = strtolower($product->unit) === 'kg';
                if ($qty < 0.5) {
                    throw new UnprocessableEntityHttpException(
                        "Quantity for \"{$product->name}\" must be at least 0.5."
                    );
                }
                if ($isWeight) {
                    // Must be multiple of 0.5: 0.5, 1, 1.5, 2 ...
                    if (abs($qty * 2 - round($qty * 2)) > 0.0001) {
                        throw new UnprocessableEntityHttpException(
                            "For \"{$product->name}\" (per kg), quantity must be in 0.5 kg increments (e.g., 0.5, 1, 1.5)."
                        );
                    }
                } else {
                    if (abs($qty - round($qty)) > 0.0001) {
                        throw new UnprocessableEntityHttpException(
                            "Quantity for \"{$product->name}\" must be a whole number."
                        );
                    }
                }

                // If vendor has no inventory record, skip stock check (allow legacy products)
                if ($inventory) {
                    $stock = (float) $inventory->stock_quantity;
                    if ($stock <= 0.0001) {
                        throw new UnprocessableEntityHttpException(
                            "\"$product->name\" is currently out of stock."
                        );
                    }

                    if ($stock + 1e-9 < $qty) {
                        $stockDisplay = rtrim(rtrim(number_format($stock, 2, '.', ''), '0'), '.');
                        throw new UnprocessableEntityHttpException(
                            "Only {$stockDisplay} {$product->unit}(s) of \"$product->name\" remaining in stock."
                        );
                    }

                    $reorderLevel = (float) ($inventory->reorder_level ?? 0);
                    if ($reorderLevel > 0 && $qty > $reorderLevel + 1e-9) {
                        $maxDisplay = rtrim(rtrim(number_format($reorderLevel, 2, '.', ''), '0'), '.');
                        throw new UnprocessableEntityHttpException(
                            "You can only order up to {$maxDisplay} {$product->unit}(s) of \"{$product->name}\" per order (reorder level limit: {$maxDisplay})."
                        );
                    }
                }

                $totalAmount += (float) $product->price * $qty;
            }

            // ── 3b. Validate e-wallet availability for gcash/maya ──────────
            if (in_array($paymentMethod, ['gcash', 'maya'])) {
                // Check that at least one vendor in the order has configured the selected method
                // This prevents customers from selecting GCash when no vendor supports it
                $vendorIds = Product::whereIn('id', $productIds)->pluck('vendor_id')->unique();
                $vendors = Vendor::whereIn('id', $vendorIds)->get();
                $hasMethod = $vendors->contains(function ($vendor) use ($paymentMethod) {
                    if ($paymentMethod === 'gcash') {
                        return ! empty($vendor->gcash_number) || ! empty($vendor->gcash_qr_path);
                    }

                    return ! empty($vendor->maya_number) || ! empty($vendor->maya_qr_path);
                });

                // We do not hard-fail here; just allow but payment_status will be unpaid if not configured
                // Uncomment to enforce:
                // if (!$hasMethod) {
                //     throw new UnprocessableEntityHttpException("No vendor has configured {$paymentMethod} payment. Please choose another method.");
                // }
            }

            // ── 4. Parse per-vendor references if provided ────────────────
            $vendorRefMap = [];
            foreach ($vendorPayments as $key => $val) {
                if (is_array($val) && isset($val['vendor_id'])) {
                    $vendorRefMap[(int) $val['vendor_id']] = trim((string) ($val['payment_reference_number'] ?? ''));
                } elseif (is_numeric($key)) {
                    $vendorRefMap[(int) $key] = is_string($val) ? trim($val) : trim((string) ($val['payment_reference_number'] ?? ''));
                }
            }

            // ── 5. Create Order ────────────────────────────────────────────
            $isCod = $paymentMethod === 'cash';
            // Clicking Buy Now / Place Order is already confirmation for COD orders.
            $confirmationStatus = $isCod ? 'confirmed' : 'not_required';
            $now = now();

            $order = Order::create([
                'user_id' => $user->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'confirmation_status' => $confirmationStatus,
                'confirmed_at' => $isCod ? $now : null,
                'confirmed_by' => $isCod ? $user->id : null,
                'confirmation_expires_at' => null,
                'total_amount' => round($totalAmount, 2),
                'payment_method' => $paymentMethod,
                'payment_reference_number' => $paymentReference ? trim($paymentReference) : null,
                'payment_status' => 'unpaid',
                'payment_submitted_at' => null,
                'notes' => $notes,
            ]);

            // ── 5b. Start the status timeline ──────────────────────────────
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'pending',
                'note' => 'Order placed',
            ]);

            // ── 6. Create Order Items + Deduct Inventory ───────────────────
            foreach ($items as $item) {
                $product = $products->get($item['product_id']);
                $inventory = $inventories->get($item['product_id']);
                $qty = (float) $item['quantity'];
                $unitPrice = (float) $product->price;

                $vRef = $vendorRefMap[$product->vendor_id] ?? ($paymentReference ? trim($paymentReference) : null);
                $itemPaymentStatus = 'unpaid';
                $itemSubmittedAt = null;
                $itemRef = null;

                if ($paymentMethod === 'cash') {
                    $itemPaymentStatus = 'paid';
                } elseif (in_array($paymentMethod, ['gcash', 'maya'])) {
                    if (! empty($vRef)) {
                        $itemPaymentStatus = 'pending_verification';
                        $itemRef = $vRef;
                        $itemSubmittedAt = now();
                    }
                }

                // Create order item (snapshot of product data at purchase time).
                // Each vendor's portion tracks its own fulfillment & payment status.
                // Stock remains untouched until the portion is marked Completed.
                $order->items()->create([
                    'product_id' => $product->id,
                    'vendor_id' => $product->vendor_id,
                    'product_name' => $product->name,
                    'category' => $product->category,
                    'unit' => $product->unit,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal' => round($unitPrice * $qty, 2),
                    'status' => 'pending',
                    'confirmation_status' => $confirmationStatus,
                    'payment_status' => $itemPaymentStatus,
                    'payment_reference_number' => $itemRef,
                    'payment_submitted_at' => $itemSubmittedAt,
                ]);
            }

            // ── 6b. Refresh overall payment status & record verification timeline ──
            $this->refreshOverallPaymentStatus($order);

            // Record timeline entries for submitted payment proofs
            $submittedVendorRefs = $order->items()
                ->where('payment_status', 'pending_verification')
                ->whereNotNull('payment_reference_number')
                ->with('vendor')
                ->get()
                ->groupBy('vendor_id');

            if ($submittedVendorRefs->count() > 1) {
                foreach ($submittedVendorRefs as $vId => $vItems) {
                    $vStall = $vItems->first()->vendor?->stall_name ?? "Vendor #{$vId}";
                    $vRefNum = $vItems->first()->payment_reference_number;
                    OrderStatusHistory::create([
                        'order_id' => $order->id,
                        'status' => 'pending',
                        'note' => "Payment proof submitted for {$vStall} (".strtoupper($paymentMethod)." Ref: {$vRefNum})",
                    ]);
                }
            } elseif ($submittedVendorRefs->count() === 1) {
                $singleRef = $submittedVendorRefs->first()->first()->payment_reference_number;
                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'status' => 'pending',
                    'note' => 'Payment proof submitted — awaiting verification ('.strtoupper($paymentMethod).' Ref: '.$singleRef.')',
                ]);
            }

            // ── 7. Initialize Order Conversations for each vendor ──────────
            $vendorIds = $order->items->pluck('vendor_id')->unique()->filter()->values();
            foreach ($vendorIds as $vId) {
                $conv = OrderConversation::firstOrCreate([
                    'order_id' => $order->id,
                    'vendor_id' => $vId,
                    'customer_id' => $user->id,
                ], [
                    'confirmation_status' => $confirmationStatus !== 'not_required' ? $confirmationStatus : 'none',
                    'last_message_at' => now(),
                ]);

                if ($isCod) {
                    OrderMessage::create([
                        'order_conversation_id' => $conv->id,
                        'sender_id' => $user->id,
                        'sender_type' => 'system',
                        'message' => 'Cash on Delivery (COD) order placed and automatically confirmed. Vendor can proceed to prepare your items.',
                        'message_type' => 'order_confirmed',
                        'metadata' => [
                            'action' => 'cod_order_confirmed',
                            'order_number' => $order->order_number,
                            'total_amount' => (float) $order->total_amount,
                        ],
                        'is_read' => false,
                    ]);
                }
            }

            return $order->load(['items.product:id,image', 'items.vendor:id,stall_name,stall_location']);
        });

        $this->notificationService->notifyVendorsNewOrder($order, $user);

        return $order;
    }

    /**
     * Customer submits payment reference after order creation (e.g., after GCash transfer).
     * Supports submitting for a specific vendor or for remaining unpaid portions.
     */
    public function submitPaymentReference(User $user, int $orderId, string $reference, ?int $vendorId = null): Order
    {
        $order = Order::where('user_id', $user->id)->findOrFail($orderId);

        if (! in_array($order->payment_method, ['gcash', 'maya'])) {
            throw new UnprocessableEntityHttpException('Payment reference is only required for GCash or Maya payments.');
        }

        $trimmedRef = trim($reference);
        if (empty($trimmedRef)) {
            throw new UnprocessableEntityHttpException('Payment reference number cannot be empty.');
        }

        if ($vendorId !== null) {
            $notifiableItems = $order->items()->where('vendor_id', $vendorId)->get();
            if ($notifiableItems->isEmpty()) {
                throw new UnprocessableEntityHttpException('Vendor not found in this order.');
            }
            if ($notifiableItems->every(fn ($i) => $i->payment_status === 'paid')) {
                throw new UnprocessableEntityHttpException('Payment for this vendor has already been verified as paid.');
            }

            $order->items()->where('vendor_id', $vendorId)->update([
                'payment_reference_number' => $trimmedRef,
                'payment_status' => 'pending_verification',
                'payment_submitted_at' => now(),
            ]);

            $vendor = Vendor::find($vendorId);
            $stallName = $vendor?->stall_name ?? "Vendor #{$vendorId}";

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'note' => "Payment proof submitted for {$stallName} (".strtoupper($order->payment_method)." Ref: {$trimmedRef})",
            ]);
        } else {
            $allItems = $order->items()->get();
            $unpaidOrRejected = $allItems->whereIn('payment_status', ['unpaid', 'rejected']);

            if ($allItems->every(fn ($i) => $i->payment_status === 'paid')) {
                throw new UnprocessableEntityHttpException('This payment has already been verified as paid.');
            }
            if ($unpaidOrRejected->isEmpty() && $allItems->where('payment_status', 'pending_verification')->isNotEmpty()) {
                throw new UnprocessableEntityHttpException('Payment proof already submitted. Awaiting vendor verification.');
            }

            $targetItems = $unpaidOrRejected->isNotEmpty() ? $order->items()->whereIn('payment_status', ['unpaid', 'rejected']) : $order->items();
            $notifiableItems = $targetItems->get();

            $order->items()->whereIn('id', $notifiableItems->pluck('id'))->update([
                'payment_reference_number' => $trimmedRef,
                'payment_status' => 'pending_verification',
                'payment_submitted_at' => now(),
            ]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'note' => 'Payment proof submitted — awaiting verification ('.strtoupper($order->payment_method).' Ref: '.$trimmedRef.')',
            ]);
        }

        $this->refreshOverallPaymentStatus($order);

        $this->notificationService->notifyVendorsPaymentSubmitted($order, $notifiableItems, $user, $trimmedRef);

        return $order->fresh()->load(['items.product:id,image', 'items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path']);
    }

    /**
     * Vendor or Admin verifies a pending payment (approve -> paid, reject -> rejected).
     * For multi-vendor orders, vendors only verify their own portion subtotal and reference.
     */
    public function verifyPayment(User $user, int $orderId, string $action = 'verify', ?int $targetVendorId = null): Order
    {
        $isAdmin = $user->is_admin ?? false;
        $vendor = $user->vendor ?? null;

        if (! $isAdmin && ! $vendor) {
            throw new AccessDeniedHttpException('Vendor profile not found');
        }

        $query = Order::query();
        if (! $isAdmin) {
            $query->whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id));
        }

        $order = $query->findOrFail($orderId);

        $vendorIdToVerify = $isAdmin ? $targetVendorId : $vendor->id;
        $itemsQuery = $order->items();
        if ($vendorIdToVerify) {
            $itemsQuery->where('vendor_id', $vendorIdToVerify);
        }

        $items = $itemsQuery->get();
        if ($items->isEmpty()) {
            throw new AccessDeniedHttpException('No items found for verification in this order.');
        }

        $hasPending = $items->contains(fn ($i) => $i->payment_status === 'pending_verification');
        if (! $hasPending && $order->payment_status !== 'pending_verification') {
            throw new UnprocessableEntityHttpException('No pending verification for this vendor portion. Current status: '.($items->first()->payment_status ?? $order->payment_status));
        }

        $isApprove = in_array($action, ['verify', 'approve', 'approve_payment']);
        $newPaymentStatus = $isApprove ? 'paid' : 'rejected';
        $now = now();

        $updateData = [
            'payment_status' => $newPaymentStatus,
            'payment_verified_at' => $now,
            'payment_verified_by' => $user->id,
        ];

        if ($vendorIdToVerify) {
            $order->items()->where('vendor_id', $vendorIdToVerify)->update($updateData);
        } else {
            $order->items()->update($updateData);
        }

        if ($isApprove) {
            $order->update([
                'payment_verified_at' => $now,
                'payment_verified_by' => $user->id,
            ]);
        }

        $this->refreshOverallPaymentStatus($order);

        $stallName = $items->first()->vendor?->stall_name ?? ($vendor?->stall_name ?? 'vendor');
        $ref = $items->first()->payment_reference_number ?? $order->payment_reference_number ?? '—';

        if ($isApprove) {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'note' => 'Payment verified as Paid for '.$stallName.' by '.($isAdmin ? 'admin' : 'vendor').' ('.strtoupper($order->payment_method).' Ref: '.$ref.')',
            ]);
        } else {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'note' => 'Payment proof rejected for '.$stallName.' by '.($isAdmin ? 'admin' : 'vendor').'. Please resubmit a valid reference.',
            ]);
        }

        $this->notificationService->notifyCustomerPaymentResult($order, $items, $isApprove, (string) $ref);

        return $order->fresh()->load([
            'items' => fn ($q) => $isAdmin ? $q->with('vendor:id,stall_name,stall_location') : $q->where('vendor_id', $vendor->id)->with('vendor:id,stall_name,stall_location'),
            'user:id,name,email',
        ]);
    }

    /**
     * Recompute overall order payment status based on individual vendor portions.
     */
    public function refreshOverallPaymentStatus(Order $order): string
    {
        $items = $order->items()->get();
        if ($items->isEmpty()) {
            return $order->payment_status ?? 'unpaid';
        }

        $statuses = $items->pluck('payment_status')->all();
        $unique = array_unique($statuses);

        if (count($unique) === 1) {
            $overall = $unique[0];
        } elseif (in_array('paid', $statuses)) {
            $overall = 'partially_paid';
        } elseif (in_array('pending_verification', $statuses)) {
            $overall = 'pending_verification';
        } elseif (in_array('rejected', $statuses)) {
            $overall = 'rejected';
        } else {
            $overall = 'unpaid';
        }

        $validRefs = $items->pluck('payment_reference_number')->filter()->unique()->values();
        $topRef = $validRefs->count() > 0 ? $validRefs->implode(', ') : $order->payment_reference_number;

        $updateData = [
            'payment_status' => $overall,
            'payment_reference_number' => $topRef,
        ];

        if ($overall === 'paid') {
            $updateData['payment_verified_at'] = $order->payment_verified_at ?? now();
        }

        $order->update($updateData);

        return $overall;
    }

    /**
     * Get paginated order history for a customer.
     */
    public function getCustomerOrders(User $user, int $perPage = 20)
    {
        $this->processExpiredOrders(userId: $user->id);

        return Order::where('user_id', $user->id)
            ->with([
                'items.product:id,image',
                'items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path',
            ])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Get a single order (customer must own it).
     */
    public function getOrder(User $user, int $orderId): Order
    {
        $this->processExpiredOrders(userId: $user->id);

        return Order::where('user_id', $user->id)
            ->with([
                'items.product:id,image',
                'items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path',
            ])
            ->findOrFail($orderId);
    }

    /**
     * Real-time tracking data for a customer's order:
     * order + items (with vendor stalls) + full status timeline.
     */
    public function track(User $user, int $orderId): Order
    {
        $this->processExpiredOrders(userId: $user->id);

        return Order::where('user_id', $user->id)
            ->with([
                'items.product:id,image',
                'items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path',
                'statusHistory',
            ])
            ->findOrFail($orderId);
    }

    /**
     * Get complete transaction receipt details for customer or vendor.
     */
    public function getReceiptData(User $user, int $orderId): array
    {
        $orderQuery = Order::with([
            'user:id,name,phone,email',
            'items.product:id,name,unit,price,image',
            'items.vendor.stall',
            'items.vendor:id,stall_name,stall_location',
        ]);

        if (! $user->is_admin) {
            $vendorId = $user->vendor?->id;
            $orderQuery->where(function ($q) use ($user, $vendorId) {
                $q->where('user_id', $user->id);
                if ($vendorId) {
                    $q->orWhereHas('items', fn ($iq) => $iq->where('vendor_id', $vendorId));
                }
            });
        }

        $order = $orderQuery->findOrFail($orderId);

        $items = $order->items->map(function ($item) {
            $stallNumber = $item->vendor?->stall?->stall_number ?? ($item->vendor?->stall_location ?? 'Stall');

            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name ?? $item->product?->name ?? 'Market Item',
                'vendor_id' => $item->vendor_id,
                'vendor_name' => $item->vendor?->stall_name ?? 'Market Vendor',
                'stall_number' => $stallNumber,
                'stall_location' => $item->vendor?->stall_location ?? 'Taguig Public Market',
                'quantity' => (float) $item->quantity,
                'unit' => $item->unit ?? $item->product?->unit ?? 'pc',
                'unit_price' => (float) $item->unit_price,
                'subtotal' => (float) $item->subtotal,
            ];
        })->values()->all();

        return [
            'receipt_number' => 'TS-REC-'.str_pad((string) $order->id, 6, '0', STR_PAD_LEFT),
            'order_number' => $order->order_number,
            'created_at' => $order->created_at->format('M d, Y h:i A'),
            'status' => $order->status,
            'payment_method' => strtoupper($order->payment_method),
            'payment_status' => ucfirst($order->payment_status),
            'payment_reference' => $order->payment_reference_number ?? ($order->reference_number ?? null),
            'customer' => [
                'id' => $order->user?->id,
                'name' => $order->user?->name ?? 'Customer',
                'phone' => $order->user?->phone ?? 'N/A',
                'email' => $order->user?->email ?? null,
            ],
            'items' => $items,
            'subtotal' => (float) $order->total_amount,
            'market_fee' => 0.00,
            'total_amount' => (float) $order->total_amount,
            'market_info' => [
                'market_name' => 'Taguig City Public Market',
                'address' => 'General Luna St, Taguig, Metro Manila',
                'app_name' => 'Taguig Suki',
            ],
        ];
    }

    /**
     * Get all orders that contain items belonging to this vendor.
     * Groups by order, includes only items relevant to this vendor.
     */
    public function getVendorOrders(User $user): Collection
    {
        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            return collect();
        }

        $this->processExpiredOrders(vendorId: $vendor->id);

        // Find all orders that have at least one item for this vendor
        $orders = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->with([
                'items' => fn ($q) => $q->where('vendor_id', $vendor->id),
                'user:id,name,email',
            ])
            ->orderByDesc('created_at')
            ->get();

        foreach ($orders as $order) {
            $firstItem = $order->items->first();
            if ($firstItem) {
                if (! empty($firstItem->payment_status)) {
                    $order->payment_status = $firstItem->payment_status;
                }
                if (! empty($firstItem->payment_reference_number)) {
                    $order->payment_reference_number = $firstItem->payment_reference_number;
                }
                if ($firstItem->ready_at) {
                    $order->ready_at = $firstItem->ready_at;
                    $order->pickup_expires_at = $firstItem->pickup_expires_at
                        ?? $firstItem->ready_at->copy()->addMinutes(self::PICKUP_TIMEOUT_MINUTES);
                }
                if ($firstItem->status === 'cancelled') {
                    $order->cancelled_at = $firstItem->cancelled_at ?? $order->cancelled_at;
                    $order->cancelled_by = $firstItem->cancelled_by ?? $order->cancelled_by;
                    $order->cancellation_reason = $firstItem->cancellation_reason ?? $order->cancellation_reason;
                }
            }
        }

        return $orders;
    }

    /**
     * Get pending-verification orders for vendor.
     */
    public function getVendorPendingPayments(User $user): Collection
    {
        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            return collect();
        }

        $orders = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id)->where('payment_status', 'pending_verification'))
            ->whereIn('payment_method', ['gcash', 'maya'])
            ->with(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email'])
            ->orderByDesc('payment_submitted_at')
            ->get();

        foreach ($orders as $order) {
            $firstItem = $order->items->first();
            if ($firstItem) {
                if (! empty($firstItem->payment_status)) {
                    $order->payment_status = $firstItem->payment_status;
                }
                if (! empty($firstItem->payment_reference_number)) {
                    $order->payment_reference_number = $firstItem->payment_reference_number;
                }
            }
        }

        return $orders;
    }

    /**
     * Progression ranks used to derive the overall order status from its
     * per-vendor portions. The overall status is the least-advanced portion:
     * the order is Ready / Completed only once EVERY vendor's portion is.
     */
    private const PORTION_STATUS_RANKS = [
        'cancelled' => -1,
        'pending' => 0,
        'pending_confirmation' => 0,
        'confirmed' => 1,
        'ready' => 2,
        'completed' => 3,
    ];

    /**
     * Vendor updates the status of THEIR OWN portion of an order.
     * Other vendors' portions are never touched: each vendor independently
     * confirms, prepares, and completes only their own items.
     *
     * Processing status removed: pending → confirmed → ready → completed.
     * When vendor confirms a pending portion, it automatically moves to Ready.
     */
    /**
     * Update order status for a specific vendor's portion.
     * Enforces 1-hour Ready-for-Pickup rule on vendor cancellation and restores stock.
     */
    public function updateOrderStatus(User $user, int $orderId, string $status, ?string $reason = null): Order
    {
        if ($status === 'cancelled') {
            return $this->cancelByVendor($user, $orderId, $reason);
        }

        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            throw new AccessDeniedHttpException('Vendor profile not found');
        }

        if ($status === 'processing') {
            throw new UnprocessableEntityHttpException('Processing status has been removed. Use Ready instead.');
        }

        $this->processExpiredOrders(vendorId: $vendor->id);

        // Confirm this vendor has items in this order (load ALL items for aggregation)
        $order = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->with('items')
            ->findOrFail($orderId);

        if ($order->status === 'cancelled') {
            throw new UnprocessableEntityHttpException('This order has been cancelled and can no longer be updated.');
        }

        $portionStatus = $this->portionStatus($order, $vendor->id);
        if ($portionStatus === 'cancelled') {
            throw new UnprocessableEntityHttpException('This order portion has already been cancelled.');
        }

        // Auto-advance: pending + confirm => directly to Ready (one-click confirm)
        $effectiveStatus = ($portionStatus === 'pending' && $status === 'confirmed') ? 'ready' : $status;
        $now = now();
        $vendorItemsBefore = $order->items->where('vendor_id', $vendor->id);
        $firstItemBefore = $vendorItemsBefore->first();
        $vendorConfirmedAt = $firstItemBefore?->vendor_confirmed_at ?? $now;

        $itemUpdate = ['status' => $effectiveStatus];
        if ($effectiveStatus === 'confirmed') {
            $itemUpdate['vendor_confirmed_at'] = $vendorConfirmedAt;
        } elseif ($effectiveStatus === 'ready') {
            $readyAt = $firstItemBefore?->ready_at ?? $now;
            $itemUpdate['vendor_confirmed_at'] = $vendorConfirmedAt;
            $itemUpdate['ready_at'] = $readyAt;
            $itemUpdate['pickup_expires_at'] = $firstItemBefore?->pickup_expires_at
                ?? $readyAt->copy()->addMinutes(self::PICKUP_TIMEOUT_MINUTES);
        } elseif ($effectiveStatus === 'completed') {
            $itemUpdate['vendor_confirmed_at'] = $vendorConfirmedAt;
        }

        DB::transaction(function () use ($order, $vendor, $status, $portionStatus, $effectiveStatus, $itemUpdate, $user) {
            // Update ONLY this vendor's items — never another vendor's portion.
            $order->items()
                ->where('vendor_id', $vendor->id)
                ->update($itemUpdate);

            if ($portionStatus === 'pending' && $status === 'confirmed') {
                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'status' => 'confirmed',
                    'note' => "Portion confirmed by {$vendor->stall_name}",
                ]);
            }

            // Deduct vendor inventory ONLY once items are marked Completed (picked up).
            if ($effectiveStatus === 'completed' && $portionStatus !== 'completed') {
                $completedItems = $order->items()->where('vendor_id', $vendor->id)->get();
                $this->deductCompletedItems($order, $completedItems, $user->name);
            }

            $freshOrder = $order->fresh('items');
            $hasPendingItems = $freshOrder->items->contains(fn (OrderItem $item) => $item->status === 'pending');
            if (! $hasPendingItems && $freshOrder->confirmation_expires_at !== null) {
                $freshOrder->update(['confirmation_expires_at' => null]);
            }

            $this->refreshOverallStatus($freshOrder, "Portion updated to {$effectiveStatus} by {$vendor->stall_name}");
        });

        if ($portionStatus !== $effectiveStatus) {
            $vendorItems = $order->items()->where('vendor_id', $vendor->id)->get();

            $this->notificationService->notifyCustomerOrderStatus(
                $order,
                $vendor,
                $vendorItems,
                $effectiveStatus,
            );
        }

        $result = $order->fresh()->load(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
        $firstResultItem = $result->items->first();
        if ($firstResultItem && $firstResultItem->ready_at) {
            $result->ready_at = $firstResultItem->ready_at;
            $result->pickup_expires_at = $firstResultItem->pickup_expires_at;
        }

        return $result;
    }

    /**
     * Customer cancels an entire pending order before any vendor confirms it.
     */
    public function cancelByCustomer(User $user, int $orderId, ?string $reason = null): Order
    {
        $this->processExpiredOrders(userId: $user->id);

        $order = Order::where('user_id', $user->id)
            ->with(['items.vendor.user', 'items.product', 'user'])
            ->findOrFail($orderId);

        $this->ensureCustomerCanCancel($order);

        $trimmedReason = $reason ? trim($reason) : null;
        $effectiveReason = $trimmedReason ?: 'Cancelled by customer before vendor confirmation.';

        $cancelledItems = DB::transaction(function () use ($order, $user, $effectiveReason) {
            $lockedOrder = Order::whereKey($order->id)
                ->with(['items.vendor.user', 'user'])
                ->lockForUpdate()
                ->firstOrFail();

            $this->ensureCustomerCanCancel($lockedOrder);

            $activeItems = $lockedOrder->items->where('status', '!=', 'cancelled');

            $this->restoreVendorItemsAndCancel(
                order: $lockedOrder,
                itemsToCancel: $activeItems,
                actorName: $user->name,
                cancelledBy: 'customer',
                reason: $effectiveReason,
                historyNote: "Order cancelled by customer ({$user->name}).".($effectiveReason ? " Reason: {$effectiveReason}" : ''),
            );

            $this->appendCancellationChatMessages(
                order: $lockedOrder,
                senderUserId: $user->id,
                cancelledBy: 'customer',
                reason: $effectiveReason,
                message: "Order #{$lockedOrder->order_number} was CANCELLED by {$user->name} before vendor confirmation. Stock has been restored.",
            );

            return $activeItems;
        });

        $this->notificationService->notifyVendorsOrderCancelled($order, $cancelledItems, $trimmedReason);

        return $order->fresh()->load([
            'items.product:id,image',
            'items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path',
        ]);
    }

    /**
     * Vendor cancels their portion of an order (Ready orders require >= 1 hour unclaimed).
     */
    public function cancelByVendor(User $user, int $orderId, ?string $reason = null): Order
    {
        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            throw new AccessDeniedHttpException('Vendor profile not found');
        }

        $this->processExpiredOrders(vendorId: $vendor->id);

        $order = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->with(['items', 'user'])
            ->findOrFail($orderId);

        $trimmedReason = $reason ? trim($reason) : null;
        $effectiveReason = $trimmedReason ?: 'Order was not picked up within 1 hour of being ready.';

        $cancelledItems = DB::transaction(function () use ($order, $vendor, $user, $effectiveReason) {
            $lockedOrder = Order::whereKey($order->id)
                ->with(['items', 'user'])
                ->lockForUpdate()
                ->firstOrFail();

            $vendorItems = $lockedOrder->items->where('vendor_id', $vendor->id);
            $this->ensureVendorCanCancelPortion($lockedOrder, $vendorItems);

            $this->restoreVendorItemsAndCancel(
                order: $lockedOrder,
                itemsToCancel: $vendorItems,
                actorName: $user->name,
                cancelledBy: 'vendor',
                reason: $effectiveReason,
                historyNote: "Portion cancelled by {$vendor->stall_name}.".($effectiveReason ? " Reason: {$effectiveReason}" : ''),
                vendorId: $vendor->id,
            );

            $this->appendCancellationChatMessages(
                order: $lockedOrder,
                senderUserId: $user->id,
                cancelledBy: 'vendor',
                reason: $effectiveReason,
                message: "Order #{$lockedOrder->order_number} for {$vendor->stall_name} was CANCELLED by vendor. Reason: {$effectiveReason}",
                vendorId: $vendor->id,
            );

            return $vendorItems;
        });

        $this->notificationService->notifyCustomerOrderStatus(
            $order,
            $vendor,
            $cancelledItems,
            'cancelled',
            $effectiveReason,
        );

        $result = $order->fresh()->load(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
        $firstResultItem = $result->items->first();
        if ($firstResultItem && $firstResultItem->status === 'cancelled') {
            $result->cancelled_at = $firstResultItem->cancelled_at ?? $result->cancelled_at;
            $result->cancelled_by = $firstResultItem->cancelled_by ?? $result->cancelled_by;
            $result->cancellation_reason = $firstResultItem->cancellation_reason ?? $result->cancellation_reason;
        }

        return $result;
    }

    /**
     * Auto-cancel unconfirmed pending orders whose 1-hour confirmation window has expired.
     */
    public function processExpiredOrders(?int $userId = null, ?int $vendorId = null): int
    {
        $query = Order::query()
            ->where('status', 'pending')
            ->where('confirmation_status', 'pending_confirmation')
            ->whereNotNull('confirmation_expires_at')
            ->where('confirmation_expires_at', '<=', now());

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        if ($vendorId !== null) {
            $query->whereHas('items', fn ($q) => $q->where('vendor_id', $vendorId));
        }

        $candidateIds = $query->pluck('id');
        if ($candidateIds->isEmpty()) {
            return 0;
        }

        $autoReason = 'Automatically cancelled after 1 hour without customer confirmation.';
        $cancelledCount = 0;

        foreach ($candidateIds as $orderId) {
            $autoCancelledItems = null;
            $lockedOrder = null;

            DB::transaction(function () use ($orderId, $autoReason, &$autoCancelledItems, &$lockedOrder) {
                $lockedOrder = Order::whereKey($orderId)
                    ->with(['items.vendor.user', 'user'])
                    ->lockForUpdate()
                    ->first();

                if (! $lockedOrder) {
                    return;
                }

                if ($lockedOrder->status !== 'pending' || $lockedOrder->confirmation_status !== 'pending_confirmation') {
                    return;
                }

                if (! $lockedOrder->confirmation_expires_at || $lockedOrder->confirmation_expires_at->isFuture()) {
                    return;
                }

                $pendingUnconfirmed = $lockedOrder->items->filter(
                    fn (OrderItem $item) => $item->status === 'pending' && $item->vendor_confirmed_at === null
                );

                if ($pendingUnconfirmed->isEmpty()) {
                    return;
                }

                $this->restoreVendorItemsAndCancel(
                    order: $lockedOrder,
                    itemsToCancel: $pendingUnconfirmed,
                    actorName: 'System Auto-Cancel',
                    cancelledBy: 'system',
                    reason: $autoReason,
                    historyNote: "Order #{$lockedOrder->order_number} automatically cancelled after 1 hour without customer confirmation.",
                );

                $this->appendCancellationChatMessages(
                    order: $lockedOrder,
                    senderUserId: $lockedOrder->user_id,
                    cancelledBy: 'system',
                    reason: $autoReason,
                    message: "Order #{$lockedOrder->order_number} was AUTOMATICALLY CANCELLED after 1 hour without confirmation. Stock has been restored.",
                );

                $autoCancelledItems = $pendingUnconfirmed;
            });

            if ($autoCancelledItems && $lockedOrder) {
                $this->notificationService->notifyOrderAutoCancelled($lockedOrder, $autoCancelledItems, $autoReason);
                $cancelledCount++;
            }
        }

        return $cancelledCount;
    }

    /**
     * Validate that a customer is allowed to cancel before the vendor confirms.
     */
    public function ensureCustomerCanCancel(Order $order, ?int $vendorId = null): void
    {
        if ($order->status === 'cancelled') {
            throw new UnprocessableEntityHttpException('This order has already been cancelled.');
        }

        if ($order->status === 'completed') {
            throw new UnprocessableEntityHttpException('Cannot cancel an order that is already completed.');
        }

        $items = $vendorId ? $order->items->where('vendor_id', $vendorId) : $order->items;

        if ($items->isEmpty()) {
            throw new AccessDeniedHttpException('No items found to cancel for this order.');
        }

        if ($items->every(fn (OrderItem $item) => $item->status === 'cancelled')) {
            throw new UnprocessableEntityHttpException('This order has already been cancelled.');
        }

        $lockedByConfirmation = $order->status !== 'pending'
            || $items->contains(
                fn (OrderItem $item) => in_array($item->status, ['confirmed', 'ready', 'completed'], true)
                    || $item->vendor_confirmed_at !== null
            );

        if ($lockedByConfirmation) {
            throw new UnprocessableEntityHttpException('Order can no longer be cancelled once confirmed by the vendor.');
        }
    }

    /**
     * Validate that a vendor may cancel their portion (Ready portions require >= 1 hour unclaimed).
     *
     * @param  Collection<int, OrderItem>  $vendorItems
     */
    public function ensureVendorCanCancelPortion(Order $order, Collection $vendorItems): void
    {
        if ($vendorItems->isEmpty()) {
            throw new AccessDeniedHttpException('No items found for this vendor in this order.');
        }

        $portionStatus = $vendorItems->first()->status ?? $order->status;

        if ($order->status === 'cancelled' || $portionStatus === 'cancelled') {
            throw new UnprocessableEntityHttpException('This order has already been cancelled.');
        }

        if ($order->status === 'completed' || $portionStatus === 'completed') {
            throw new UnprocessableEntityHttpException('Cannot cancel an order that is already completed.');
        }

        if ($portionStatus === 'ready') {
            $readyAt = $vendorItems->first()->ready_at ?? $order->ready_at;
            $pickupExpiresAt = $vendorItems->first()->pickup_expires_at
                ?? $order->pickup_expires_at
                ?? ($readyAt ? $readyAt->copy()->addMinutes(self::PICKUP_TIMEOUT_MINUTES) : null);

            if (! $pickupExpiresAt || now()->lt($pickupExpiresAt)) {
                throw new UnprocessableEntityHttpException(
                    'You can cancel a Ready for Pickup order only after 1 hour has passed without customer pickup.'
                );
            }
        }
    }

    /**
     * Deduct inventory stock for completed order items (idempotent per order item).
     *
     * @param  Collection<int, OrderItem>  $items
     */
    public function deductCompletedItems(Order $order, Collection $items, string $actorName): void
    {
        foreach ($items as $item) {
            $alreadyDeducted = InventoryLog::where('reference_number', $order->order_number)
                ->where('vendor_id', $item->vendor_id)
                ->where('product_id', $item->product_id)
                ->where('type', 'sold')
                ->exists();

            if ($alreadyDeducted) {
                continue;
            }

            $inventory = Inventory::where('product_id', $item->product_id)
                ->where('vendor_id', $item->vendor_id)
                ->lockForUpdate()
                ->first();

            if (! $inventory) {
                continue;
            }

            $before = (float) $inventory->stock_quantity;
            $qty = (float) $item->quantity;
            $after = max(0.0, round($before - $qty, 2));
            $deducted = round($before - $after, 2);

            if ($deducted <= 0) {
                continue;
            }

            $inventory->update(['stock_quantity' => $after]);

            InventoryLog::create([
                'inventory_id' => $inventory->id,
                'vendor_id' => $inventory->vendor_id,
                'product_id' => $item->product_id,
                'type' => 'sold',
                'quantity_before' => $before,
                'quantity_change' => -$deducted,
                'quantity_after' => $after,
                'reason' => "Order #{$order->order_number} completed (picked up)",
                'reference_number' => $order->order_number,
                'unit_cost' => $inventory->cost_price,
                'performed_by' => $actorName,
            ]);
        }
    }

    /**
     * Mark given order items (and order if empty) cancelled; restores stock only if a prior sale deduction exists.
     *
     * @param  Collection<int, OrderItem>  $itemsToCancel
     */
    public function restoreVendorItemsAndCancel(
        Order $order,
        Collection $itemsToCancel,
        string $actorName,
        string $cancelledBy,
        string $reason,
        string $historyNote,
        ?int $vendorId = null,
    ): void {
        $now = now();
        $activeItems = $itemsToCancel->where('status', '!=', 'cancelled');

        foreach ($activeItems as $item) {
            $soldAmount = (float) InventoryLog::where('reference_number', $order->order_number)
                ->where('vendor_id', $item->vendor_id)
                ->where('product_id', $item->product_id)
                ->where('type', 'sold')
                ->sum('quantity_change');

            $returnedAmount = (float) InventoryLog::where('reference_number', $order->order_number)
                ->where('vendor_id', $item->vendor_id)
                ->where('product_id', $item->product_id)
                ->where('type', 'returned')
                ->sum('quantity_change');

            // Stock is normally deducted only upon Completed; only restore if previously deducted.
            $netDeducted = round(abs($soldAmount) - $returnedAmount, 2);
            if ($soldAmount >= 0 || $netDeducted <= 0) {
                continue;
            }

            $inventory = Inventory::where('product_id', $item->product_id)
                ->where('vendor_id', $item->vendor_id)
                ->lockForUpdate()
                ->first();

            if ($inventory) {
                $before = (float) $inventory->stock_quantity;
                $restored = min((float) $item->quantity, $netDeducted);
                $after = round($before + $restored, 2);

                $inventory->update(['stock_quantity' => $after]);

                InventoryLog::create([
                    'inventory_id' => $inventory->id,
                    'vendor_id' => $item->vendor_id,
                    'product_id' => $item->product_id,
                    'type' => 'returned',
                    'quantity_before' => $before,
                    'quantity_change' => $restored,
                    'quantity_after' => $after,
                    'reason' => "Order #{$order->order_number} cancelled by {$actorName}".($reason ? ": {$reason}" : ''),
                    'reference_number' => $order->order_number,
                    'unit_cost' => $inventory->cost_price,
                    'performed_by' => $actorName,
                ]);
            }
        }

        $itemIds = $activeItems->pluck('id')->all();
        if (! empty($itemIds)) {
            OrderItem::whereIn('id', $itemIds)->update([
                'status' => 'cancelled',
                'confirmation_status' => 'cancelled',
                'cancelled_at' => $now,
                'cancelled_by' => $cancelledBy,
                'cancellation_reason' => $reason,
            ]);
        }

        $affectedVendorIds = $vendorId !== null
            ? [$vendorId]
            : $activeItems->pluck('vendor_id')->unique()->values()->all();

        if (! empty($affectedVendorIds)) {
            OrderConversation::where('order_id', $order->id)
                ->whereIn('vendor_id', $affectedVendorIds)
                ->update(['confirmation_status' => 'cancelled']);
        }

        $freshOrder = $order->fresh('items');
        $this->refreshOverallStatus($freshOrder, $historyNote);

        $nonCancelledItems = $freshOrder->items->where('status', '!=', 'cancelled');
        if ($nonCancelledItems->isEmpty()) {
            $order->update([
                'status' => 'cancelled',
                'confirmation_status' => 'cancelled',
                'confirmation_expires_at' => null,
                'cancelled_at' => $now,
                'cancelled_by' => $cancelledBy,
                'cancellation_reason' => $reason,
            ]);
        }

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => 'cancelled',
            'note' => $historyNote,
        ]);
    }

    /**
     * Append a cancellation notice to existing order conversations when available.
     */
    private function appendCancellationChatMessages(
        Order $order,
        int $senderUserId,
        string $cancelledBy,
        string $reason,
        string $message,
        ?int $vendorId = null,
    ): void {
        $conversations = OrderConversation::where('order_id', $order->id)
            ->when($vendorId !== null, fn ($q) => $q->where('vendor_id', $vendorId))
            ->get();

        foreach ($conversations as $conversation) {
            OrderMessage::create([
                'order_conversation_id' => $conversation->id,
                'sender_id' => $senderUserId,
                'sender_type' => $cancelledBy === 'system' ? 'system' : $cancelledBy,
                'message' => $message,
                'message_type' => 'order_cancelled',
                'metadata' => [
                    'action' => 'order_cancelled',
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'vendor_id' => $conversation->vendor_id,
                    'cancelled_by' => $cancelledBy,
                    'reason' => $reason,
                ],
                'is_read' => false,
            ]);

            $conversation->update(['last_message_at' => now()]);
        }
    }

    /**
     * Get the fulfillment status of one vendor's portion of an order.
     * All of a vendor's items always move together, so the first item's
     * status represents the portion (falls back to the overall status).
     */
    public function portionStatus(Order $order, int $vendorId): string
    {
        $item = $order->items->firstWhere('vendor_id', $vendorId);

        return $item?->status ?? $order->status;
    }

    /**
     * Recompute the overall order status from its portions and persist it
     * when it changed. Records timeline entries only for overall transitions
     * so the customer sees Ready / Completed once ALL portions get there.
     */
    public function refreshOverallStatus(Order $order, ?string $note = null): bool
    {
        $ranks = self::PORTION_STATUS_RANKS;
        $activeItems = $order->items->where('status', '!=', 'cancelled');

        if ($activeItems->isEmpty()) {
            $overall = 'cancelled';
        } else {
            $overall = $activeItems->reduce(
                fn (?string $carry, $item) => $carry === null || ($ranks[$item->status] ?? 0) < ($ranks[$carry] ?? 0) ? $item->status : $carry
            ) ?? 'pending';
        }

        if ($overall === $order->status) {
            return false;
        }

        $updateData = ['status' => $overall];
        if ($overall === 'ready') {
            $latestReadyAt = $activeItems->max('ready_at') ?? now();
            $readyAtCarbon = $latestReadyAt instanceof Carbon ? $latestReadyAt : Carbon::parse($latestReadyAt);
            $updateData['ready_at'] = $order->ready_at ?? $readyAtCarbon;
            $updateData['pickup_expires_at'] = $order->pickup_expires_at ?? $readyAtCarbon->copy()->addMinutes(self::PICKUP_TIMEOUT_MINUTES);
            $updateData['confirmation_expires_at'] = null;
        } elseif ($overall === 'completed') {
            $updateData['confirmation_expires_at'] = null;
        }

        $order->update($updateData);

        if ($overall !== 'cancelled') {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $overall,
                'note' => $note ?? "Order status updated to {$overall}",
            ]);
        }

        return true;
    }

    /**
     * Build vendor-specific payment details for checkout display.
     * Given product IDs (and optional product quantities), returns each vendor's
     * GCash/Maya numbers, QR URLs, subtotal, and items list.
     */
    public function getVendorsPaymentDetails(array $productIds, array $quantities = []): array
    {
        $products = Product::whereIn('id', $productIds)->get();
        $vendorIds = $products->pluck('vendor_id')->unique()->filter()->values();
        $vendors = Vendor::whereIn('id', $vendorIds)->get();

        return $vendors->map(function ($vendor) use ($products, $quantities) {
            $vendorProducts = $products->where('vendor_id', $vendor->id);
            $vendorSubtotal = 0;
            $itemsList = [];

            foreach ($vendorProducts as $prod) {
                $qty = (float) ($quantities[$prod->id] ?? 1);
                $sub = round((float) $prod->price * $qty, 2);
                $vendorSubtotal += $sub;

                $itemsList[] = [
                    'product_id' => $prod->id,
                    'product_name' => $prod->name,
                    'price' => (float) $prod->price,
                    'unit' => $prod->unit,
                    'quantity' => $qty,
                    'subtotal' => $sub,
                ];
            }

            $gcashUrl = null;
            $mayaUrl = null;
            if ($vendor->gcash_qr_path) {
                try {
                    $host = request()->getSchemeAndHttpHost();
                    $gcashUrl = rtrim($host, '/').'/storage/'.ltrim($vendor->gcash_qr_path, '/');
                } catch (\Throwable $e) {
                    $gcashUrl = Storage::disk('public')->url($vendor->gcash_qr_path);
                }
            }
            if ($vendor->maya_qr_path) {
                try {
                    $host = request()->getSchemeAndHttpHost();
                    $mayaUrl = rtrim($host, '/').'/storage/'.ltrim($vendor->maya_qr_path, '/');
                } catch (\Throwable $e) {
                    $mayaUrl = Storage::disk('public')->url($vendor->maya_qr_path);
                }
            }

            $hasGcash = ! empty($vendor->gcash_number) || ! empty($vendor->gcash_qr_path);
            $hasMaya = ! empty($vendor->maya_number) || ! empty($vendor->maya_qr_path);

            return [
                'vendor_id' => $vendor->id,
                'stall_name' => $vendor->stall_name,
                'stall_location' => $vendor->stall_location,
                'subtotal' => round($vendorSubtotal, 2),
                'items' => $itemsList,
                'items_count' => count($itemsList),
                'gcash_number' => $vendor->gcash_number,
                'gcash_qr_url' => $gcashUrl,
                'maya_number' => $vendor->maya_number,
                'maya_qr_url' => $mayaUrl,
                'has_gcash' => $hasGcash,
                'has_maya' => $hasMaya,
                'gcash' => [
                    'number' => $vendor->gcash_number,
                    'qr_url' => $gcashUrl,
                    'has_qr' => ! empty($vendor->gcash_qr_path),
                ],
                'maya' => [
                    'number' => $vendor->maya_number,
                    'qr_url' => $mayaUrl,
                    'has_qr' => ! empty($vendor->maya_qr_path),
                ],
                'has_ewallet' => $hasGcash || $hasMaya,
            ];
        })->all();
    }

    /**
     * Get comprehensive sales history, revenue analytics, and completed transactions for a vendor.
     */
    public function getVendorSalesAnalytics(User $user, string $period = 'all'): array
    {
        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            return [
                'summary' => [
                    'total_revenue' => 0.0,
                    'today_revenue' => 0.0,
                    'week_revenue' => 0.0,
                    'month_revenue' => 0.0,
                    'completed_orders_count' => 0,
                    'total_units_sold' => 0,
                    'average_order_value' => 0.0,
                ],
                'chart_data' => [],
                'top_products' => [],
                'category_breakdown' => [],
                'payment_methods' => [],
                'completed_transactions' => [],
            ];
        }

        // All completed orders containing this vendor's items
        $completedOrders = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->where('status', 'completed')
            ->with([
                'items' => fn ($q) => $q->where('vendor_id', $vendor->id),
                'user:id,name,email',
            ])
            ->orderByDesc('updated_at')
            ->get();

        $startOfToday = now()->startOfDay();
        $startOfWeek = now()->startOfWeek();
        $startOfMonth = now()->startOfMonth();

        $totalRevenue = 0.0;
        $todayRevenue = 0.0;
        $weekRevenue = 0.0;
        $monthRevenue = 0.0;
        $totalUnitsSold = 0;

        $topProductsMap = [];
        $categoryMap = [];
        $paymentMethodsMap = [
            'cash' => ['count' => 0, 'revenue' => 0.0],
            'gcash' => ['count' => 0, 'revenue' => 0.0],
            'maya' => ['count' => 0, 'revenue' => 0.0],
        ];

        $completedTransactions = [];

        foreach ($completedOrders as $order) {
            $orderVendorSubtotal = 0.0;
            $orderUnits = 0.0;
            $itemsSummary = [];

            foreach ($order->items as $item) {
                $subtotal = (float) $item->subtotal;
                $qty = (float) $item->quantity;
                $orderVendorSubtotal += $subtotal;
                $orderUnits += $qty;

                // Product breakdown
                $pid = $item->product_id;
                if (! isset($topProductsMap[$pid])) {
                    $topProductsMap[$pid] = [
                        'product_id' => $pid,
                        'product_name' => $item->product_name,
                        'category' => $item->category,
                        'unit' => $item->unit,
                        'quantity_sold' => 0.0,
                        'revenue' => 0.0,
                    ];
                }
                $topProductsMap[$pid]['quantity_sold'] = round($topProductsMap[$pid]['quantity_sold'] + $qty, 2);
                $topProductsMap[$pid]['revenue'] = round($topProductsMap[$pid]['revenue'] + $subtotal, 2);

                // Category breakdown
                $cat = ucfirst(strtolower($item->category ?? 'Other'));
                if (! isset($categoryMap[$cat])) {
                    $categoryMap[$cat] = [
                        'category' => $cat,
                        'revenue' => 0.0,
                        'quantity' => 0.0,
                    ];
                }
                $categoryMap[$cat]['revenue'] = round($categoryMap[$cat]['revenue'] + $subtotal, 2);
                $categoryMap[$cat]['quantity'] += $qty;

                $itemsSummary[] = [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'category' => $item->category,
                    'unit' => $item->unit,
                    'quantity' => $qty,
                    'unit_price' => (float) $item->unit_price,
                    'subtotal' => $subtotal,
                ];
            }

            $orderVendorSubtotal = round($orderVendorSubtotal, 2);
            $totalRevenue += $orderVendorSubtotal;
            $totalUnitsSold += $orderUnits;

            $updatedAt = $order->updated_at ?? $order->created_at;

            if ($updatedAt >= $startOfToday) {
                $todayRevenue += $orderVendorSubtotal;
            }
            if ($updatedAt >= $startOfWeek) {
                $weekRevenue += $orderVendorSubtotal;
            }
            if ($updatedAt >= $startOfMonth) {
                $monthRevenue += $orderVendorSubtotal;
            }

            $pm = strtolower($order->payment_method ?? 'cash');
            if (! isset($paymentMethodsMap[$pm])) {
                $paymentMethodsMap[$pm] = ['count' => 0, 'revenue' => 0.0];
            }
            $paymentMethodsMap[$pm]['count'] += 1;
            $paymentMethodsMap[$pm]['revenue'] = round($paymentMethodsMap[$pm]['revenue'] + $orderVendorSubtotal, 2);

            $completedTransactions[] = [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->user->name ?? 'Customer',
                'customer_email' => $order->user->email ?? '',
                'payment_method' => $order->payment_method ?? 'cash',
                'total_amount' => (float) $order->total_amount,
                'vendor_subtotal' => $orderVendorSubtotal,
                'total_units' => $orderUnits,
                'notes' => $order->notes,
                'created_at' => $order->created_at?->toIso8601String() ?? '',
                'completed_at' => $updatedAt?->toIso8601String() ?? '',
                'items' => $itemsSummary,
            ];
        }

        $completedCount = $completedOrders->count();
        $totalRevenue = round($totalRevenue, 2);
        $todayRevenue = round($todayRevenue, 2);
        $weekRevenue = round($weekRevenue, 2);
        $monthRevenue = round($monthRevenue, 2);
        $avgOrderValue = $completedCount > 0 ? round($totalRevenue / $completedCount, 2) : 0.0;

        // Daily chart data for the last 7 days
        $chartData = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now()->subDays($i);
            $dayStart = $day->copy()->startOfDay();
            $dayEnd = $day->copy()->endOfDay();

            $dayOrders = $completedOrders->filter(function ($o) use ($dayStart, $dayEnd) {
                $t = $o->updated_at ?? $o->created_at;

                return $t >= $dayStart && $t <= $dayEnd;
            });

            $dayRev = round($dayOrders->sum(fn ($o) => $o->items->sum('subtotal')), 2);

            $chartData[] = [
                'date' => $day->format('Y-m-d'),
                'label' => $day->format('D'),
                'full_label' => $day->format('M j'),
                'revenue' => $dayRev,
                'orders_count' => $dayOrders->count(),
            ];
        }

        // Top products sorted by revenue desc
        $topProducts = array_values($topProductsMap);
        usort($topProducts, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);
        $topProducts = array_slice($topProducts, 0, 8);

        // Categories with percentages
        $categories = array_values($categoryMap);
        foreach ($categories as &$c) {
            $c['percentage'] = $totalRevenue > 0 ? round(($c['revenue'] / $totalRevenue) * 100, 1) : 0;
        }
        unset($c);
        usort($categories, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);

        // Payment methods with percentages
        $paymentMethods = [];
        foreach ($paymentMethodsMap as $pmKey => $pmVal) {
            if ($pmVal['count'] > 0 || in_array($pmKey, ['cash', 'gcash', 'maya'])) {
                $paymentMethods[] = [
                    'payment_method' => $pmKey,
                    'count' => $pmVal['count'],
                    'revenue' => $pmVal['revenue'],
                    'percentage' => $totalRevenue > 0 ? round(($pmVal['revenue'] / $totalRevenue) * 100, 1) : 0,
                ];
            }
        }

        return [
            'summary' => [
                'total_revenue' => $totalRevenue,
                'today_revenue' => $todayRevenue,
                'week_revenue' => $weekRevenue,
                'month_revenue' => $monthRevenue,
                'completed_orders_count' => $completedCount,
                'total_units_sold' => $totalUnitsSold,
                'average_order_value' => $avgOrderValue,
            ],
            'chart_data' => $chartData,
            'top_products' => $topProducts,
            'category_breakdown' => $categories,
            'payment_methods' => $paymentMethods,
            'completed_transactions' => $completedTransactions,
        ];
    }
}
