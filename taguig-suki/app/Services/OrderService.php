<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class OrderService
{
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
    public function placeOrder(User $user, array $items, string $paymentMethod = 'cash', ?string $notes = null, ?string $paymentReference = null): Order
    {
        return DB::transaction(function () use ($user, $items, $paymentMethod, $notes, $paymentReference) {

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

            // ── 4. Determine payment status ────────────────────────────────
            $paymentStatus = 'unpaid';
            $paymentSubmittedAt = null;
            $reference = null;

            if ($paymentMethod === 'cash') {
                $paymentStatus = 'paid';
            } elseif (in_array($paymentMethod, ['gcash', 'maya'])) {
                if (!empty($paymentReference)) {
                    $reference = trim($paymentReference);
                    $paymentStatus = 'pending_verification';
                    $paymentSubmittedAt = now();
                } else {
                    $paymentStatus = 'unpaid';
                }
            }

            // ── 5. Create Order ────────────────────────────────────────────
            $order = Order::create([
                'user_id' => $user->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'total_amount' => round($totalAmount, 2),
                'payment_method' => $paymentMethod,
                'payment_reference_number' => $reference,
                'payment_status' => $paymentStatus,
                'payment_submitted_at' => $paymentSubmittedAt,
                'notes' => $notes,
            ]);

            // ── 5b. Start the status timeline ──────────────────────────────
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'pending',
                'note' => 'Order placed',
            ]);

            if ($paymentStatus === 'pending_verification') {
                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'status' => 'pending',
                    'note' => 'Payment proof submitted — awaiting verification ('.strtoupper($paymentMethod).' Ref: '.$reference.')',
                ]);
            }

            // ── 6. Create Order Items + Deduct Inventory ───────────────────
            foreach ($items as $item) {
                $product = $products->get($item['product_id']);
                $inventory = $inventories->get($item['product_id']);
                $qty = (float) $item['quantity'];
                $unitPrice = (float) $product->price;

                // Create order item (snapshot of product data at purchase time)
                $order->items()->create([
                    'product_id' => $product->id,
                    'vendor_id' => $product->vendor_id,
                    'product_name' => $product->name,
                    'category' => $product->category,
                    'unit' => $product->unit,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal' => round($unitPrice * $qty, 2),
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

            return $order->load('items');
        });
    }

    /**
     * Customer submits payment reference after order creation (e.g., after GCash transfer).
     */
    public function submitPaymentReference(User $user, int $orderId, string $reference): Order
    {
        $order = Order::where('user_id', $user->id)->findOrFail($orderId);

        if (!in_array($order->payment_method, ['gcash', 'maya'])) {
            throw new UnprocessableEntityHttpException('Payment reference is only required for GCash or Maya payments.');
        }

        if ($order->payment_status === 'paid') {
            throw new UnprocessableEntityHttpException('This payment has already been verified as paid.');
        }

        if ($order->payment_status === 'pending_verification') {
            throw new UnprocessableEntityHttpException('Payment proof already submitted. Awaiting vendor verification.');
        }

        $order->update([
            'payment_reference_number' => trim($reference),
            'payment_status' => 'pending_verification',
            'payment_submitted_at' => now(),
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $order->status,
            'note' => 'Payment proof submitted — awaiting verification ('.strtoupper($order->payment_method).' Ref: '.trim($reference).')',
        ]);

        return $order->load(['items.vendor:id,stall_name,stall_location']);
    }

    /**
     * Vendor verifies a pending payment (approve -> paid, reject -> rejected).
     */
    public function verifyPayment(User $user, int $orderId, string $action = 'verify'): Order
    {
        $vendor = $user->vendor ?? null;

        if (!$vendor) {
            throw new AccessDeniedHttpException('Vendor profile not found');
        }

        // Admins may verify any order; vendors only those containing their products
        $isAdmin = $user->is_admin ?? false;

        $query = Order::query();
        if (!$isAdmin) {
            $query->whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id));
        }

        $order = $query->findOrFail($orderId);

        if ($order->payment_status !== 'pending_verification') {
            throw new UnprocessableEntityHttpException('No pending verification for this order. Current status: '.$order->payment_status);
        }

        if ($action === 'verify' || $action === 'approve') {
            $order->update([
                'payment_status' => 'paid',
                'payment_verified_at' => now(),
                'payment_verified_by' => $user->id,
            ]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'note' => 'Payment verified as Paid by '.($isAdmin ? 'admin' : 'vendor').' ('.strtoupper($order->payment_method).' Ref: '.($order->payment_reference_number ?? '—').')',
            ]);
        } elseif ($action === 'reject' || $action === 'decline') {
            $order->update([
                'payment_status' => 'rejected',
                'payment_verified_at' => now(),
                'payment_verified_by' => $user->id,
            ]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'note' => 'Payment proof rejected by '.($isAdmin ? 'admin' : 'vendor').'. Please resubmit a valid reference.',
            ]);
        } else {
            throw new UnprocessableEntityHttpException('Invalid verification action. Use verify or reject.');
        }

        return $order->load(['items' => fn ($q) => $isAdmin ? $q : $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
    }

    /**
     * Get paginated order history for a customer.
     */
    public function getCustomerOrders(User $user, int $perPage = 20)
    {
        return Order::where('user_id', $user->id)
            ->with(['items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Get a single order (customer must own it).
     */
    public function getOrder(User $user, int $orderId): Order
    {
        return Order::where('user_id', $user->id)
            ->with(['items.vendor:id,stall_name,stall_location,gcash_number,maya_number,gcash_qr_path,maya_qr_path'])
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
        return Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->with([
                'items' => fn ($q) => $q->where('vendor_id', $vendor->id),
                'user:id,name,email',
            ])
            ->orderByDesc('created_at')
            ->get();
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

        return Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->where('payment_status', 'pending_verification')
            ->whereIn('payment_method', ['gcash', 'maya'])
            ->with(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email'])
            ->orderByDesc('payment_submitted_at')
            ->get();
    }

    /**
     * Vendor updates the status of an order they own items in.
     * Processing status removed: pending → confirmed → ready → completed.
     * When vendor confirms a pending order, it automatically moves to Ready to reduce actions.
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

        // Confirm this vendor has items in this order
        $order = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->findOrFail($orderId);

        // Auto-advance: pending + confirm => directly to Ready (one-click confirm)
        if ($order->status === 'pending' && $status === 'confirmed') {
            $order->update(['status' => 'ready']);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'confirmed',
                'note' => 'Order confirmed by vendor',
            ]);
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'ready',
                'note' => 'Automatically marked as Ready after confirmation (processing step removed)',
            ]);

            return $order->load(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
        }

        $order->update(['status' => $status]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $status,
            'note' => 'Status updated by vendor',
        ]);

        return $order->load(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
    }

    /**
     * Build vendor-specific payment details for checkout display.
     * Given product IDs, return each vendor's GCash/Maya numbers + QR URLs.
     */
    public function getVendorsPaymentDetails(array $productIds): array
    {
        $vendorIds = Product::whereIn('id', $productIds)->pluck('vendor_id')->unique()->filter()->values();
        $vendors = \App\Models\Vendor::whereIn('id', $vendorIds)->get();

        return $vendors->map(function ($vendor) {
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
            return [
                'vendor_id' => $vendor->id,
                'stall_name' => $vendor->stall_name,
                'stall_location' => $vendor->stall_location,
                'gcash_number' => $vendor->gcash_number,
                'gcash_qr_url' => $gcashUrl,
                'maya_number' => $vendor->maya_number,
                'maya_qr_url' => $mayaUrl,
                'has_gcash' => !empty($vendor->gcash_number) || !empty($vendor->gcash_qr_path),
                'has_maya' => !empty($vendor->maya_number) || !empty($vendor->maya_qr_path),
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
