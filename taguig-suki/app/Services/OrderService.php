<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class OrderService
{
    public function __construct(private readonly NotificationService $notificationService) {}

    /**
     * Place an order atomically:
     *  1. Validate every item has enough stock.
     *  2. Create the Order record.
     *  3. Create OrderItems.
     *  4. Deduct inventory + log each sale.
     *
     * If any step fails the whole transaction rolls back.
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
                }

                $totalAmount += (float) $product->price * $qty;
            }

            // ── 3b. Validate e-wallet availability for gcash/maya ──────────
            if (in_array($paymentMethod, ['gcash', 'maya'])) {
                // Check that at least one vendor in the order has configured the selected method
                // This prevents customers from selecting GCash when no vendor supports it
                $vendorIds = Product::whereIn('id', $productIds)->pluck('vendor_id')->unique();
                $vendors = \App\Models\Vendor::whereIn('id', $vendorIds)->get();
                $hasMethod = $vendors->contains(function ($vendor) use ($paymentMethod) {
                    if ($paymentMethod === 'gcash') {
                        return !empty($vendor->gcash_number) || !empty($vendor->gcash_qr_path);
                    }
                    return !empty($vendor->maya_number) || !empty($vendor->maya_qr_path);
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
                    $vendorRefMap[(int)$val['vendor_id']] = trim((string)($val['payment_reference_number'] ?? ''));
                } elseif (is_numeric($key)) {
                    $vendorRefMap[(int)$key] = is_string($val) ? trim($val) : trim((string)($val['payment_reference_number'] ?? ''));
                }
            }

            // ── 5. Create Order ────────────────────────────────────────────
            $isCod = $paymentMethod === 'cash';
            $confirmationStatus = $isCod ? 'pending_confirmation' : 'not_required';

            $order = Order::create([
                'user_id' => $user->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'confirmation_status' => $confirmationStatus,
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
                    if (!empty($vRef)) {
                        $itemPaymentStatus = 'pending_verification';
                        $itemRef = $vRef;
                        $itemSubmittedAt = now();
                    }
                }

                // Create order item (snapshot of product data at purchase time).
                // Each vendor's portion tracks its own fulfillment & payment status.
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

                // Deduct stock and log the sale
                if ($inventory) {
                    $before = (float) $inventory->stock_quantity;
                    $after = max(0.0, round($before - $qty, 2));

                    $inventory->update(['stock_quantity' => $after]);

                    InventoryLog::create([
                        'inventory_id' => $inventory->id,
                        'vendor_id' => $inventory->vendor_id,
                        'product_id' => $product->id,
                        'type' => 'sold',
                        'quantity_before' => $before,
                        'quantity_change' => -$qty,
                        'quantity_after' => $after,
                        'reason' => "Customer order #{$order->order_number}",
                        'reference_number' => $order->order_number,
                        'unit_cost' => $inventory->cost_price,
                        'performed_by' => $user->name,
                    ]);
                }
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
                $conv = \App\Models\OrderConversation::firstOrCreate([
                    'order_id' => $order->id,
                    'vendor_id' => $vId,
                    'customer_id' => $user->id,
                ], [
                    'confirmation_status' => $confirmationStatus !== 'not_required' ? $confirmationStatus : 'none',
                    'last_message_at' => now(),
                ]);

                if ($isCod) {
                    \App\Models\OrderMessage::create([
                        'order_conversation_id' => $conv->id,
                        'sender_id' => $user->id,
                        'sender_type' => 'system',
                        'message' => "Cash on Delivery (COD) order placed. The vendor may request order confirmation before preparing items.",
                        'message_type' => 'confirmation_request',
                        'metadata' => [
                            'action' => 'cod_order_placed',
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

        if (!in_array($order->payment_method, ['gcash', 'maya'])) {
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

        if (!$isAdmin && !$vendor) {
            throw new AccessDeniedHttpException('Vendor profile not found');
        }

        $query = Order::query();
        if (!$isAdmin) {
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
        if (!$hasPending && $order->payment_status !== 'pending_verification') {
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
        return Order::where('user_id', $user->id)
            ->with([
                'items.product:id,image',
                'items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path',
                'statusHistory',
            ])
            ->findOrFail($orderId);
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
                if (!empty($firstItem->payment_status)) {
                    $order->payment_status = $firstItem->payment_status;
                }
                if (!empty($firstItem->payment_reference_number)) {
                    $order->payment_reference_number = $firstItem->payment_reference_number;
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

        if (!$vendor) {
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
                if (!empty($firstItem->payment_status)) {
                    $order->payment_status = $firstItem->payment_status;
                }
                if (!empty($firstItem->payment_reference_number)) {
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
    public function updateOrderStatus(User $user, int $orderId, string $status): Order
    {
        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            throw new AccessDeniedHttpException('Vendor profile not found');
        }

        if ($status === 'processing') {
            throw new UnprocessableEntityHttpException('Processing status has been removed. Use Ready instead.');
        }

        // Confirm this vendor has items in this order (load ALL items for aggregation)
        $order = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->with('items')
            ->findOrFail($orderId);

        if ($order->status === 'cancelled') {
            throw new UnprocessableEntityHttpException('This order has been cancelled and can no longer be updated.');
        }

        $portionStatus = $this->portionStatus($order, $vendor->id);

        // Auto-advance: pending + confirm => directly to Ready (one-click confirm)
        $effectiveStatus = ($portionStatus === 'pending' && $status === 'confirmed') ? 'ready' : $status;

        // Update ONLY this vendor's items — never another vendor's portion.
        $order->items()
            ->where('vendor_id', $vendor->id)
            ->update(['status' => $effectiveStatus]);

        if ($portionStatus === 'pending' && $status === 'confirmed') {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'confirmed',
                'note' => "Portion confirmed by {$vendor->stall_name}",
            ]);
        }

        $this->refreshOverallStatus($order->fresh('items'), "Portion updated to {$effectiveStatus} by {$vendor->stall_name}");

        if ($portionStatus !== $effectiveStatus) {
            $vendorItems = $order->items()->where('vendor_id', $vendor->id)->get();

            $this->notificationService->notifyCustomerOrderStatus(
                $order,
                $vendor,
                $vendorItems,
                $effectiveStatus,
            );
        }

        return $order->fresh()->load(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
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

        $overall = $order->items->reduce(
            fn (?string $carry, $item) => $carry === null || ($ranks[$item->status] ?? 0) < ($ranks[$carry] ?? 0) ? $item->status : $carry
        ) ?? 'pending';

        if ($overall === $order->status) {
            return false;
        }

        $order->update(['status' => $overall]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $overall,
            'note' => $note ?? "Order status updated to {$overall}",
        ]);

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
        $vendors = \App\Models\Vendor::whereIn('id', $vendorIds)->get();

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
                    $gcashUrl = rtrim($host, '/') . '/storage/' . ltrim($vendor->gcash_qr_path, '/');
                } catch (\Throwable $e) {
                    $gcashUrl = Storage::disk('public')->url($vendor->gcash_qr_path);
                }
            }
            if ($vendor->maya_qr_path) {
                try {
                    $host = request()->getSchemeAndHttpHost();
                    $mayaUrl = rtrim($host, '/') . '/storage/' . ltrim($vendor->maya_qr_path, '/');
                } catch (\Throwable $e) {
                    $mayaUrl = Storage::disk('public')->url($vendor->maya_qr_path);
                }
            }

            $hasGcash = !empty($vendor->gcash_number) || !empty($vendor->gcash_qr_path);
            $hasMaya = !empty($vendor->maya_number) || !empty($vendor->maya_qr_path);

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
                    'has_qr' => !empty($vendor->gcash_qr_path),
                ],
                'maya' => [
                    'number' => $vendor->maya_number,
                    'qr_url' => $mayaUrl,
                    'has_qr' => !empty($vendor->maya_qr_path),
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
