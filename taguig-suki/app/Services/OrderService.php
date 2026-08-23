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
     */
    public function placeOrder(User $user, array $items, string $paymentMethod = 'cash', ?string $notes = null): Order
    {
        return DB::transaction(function () use ($user, $items, $paymentMethod, $notes) {

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
                $qty = (int) $item['quantity'];

                if (! $product) {
                    throw new UnprocessableEntityHttpException(
                        "Product \"{$item['product_name']}\" is no longer available."
                    );
                }

                // If vendor has no inventory record, skip stock check (allow legacy products)
                if ($inventory) {
                    if ($inventory->stock_quantity <= 0) {
                        throw new UnprocessableEntityHttpException(
                            "\"$product->name\" is currently out of stock."
                        );
                    }

                    if ($inventory->stock_quantity < $qty) {
                        throw new UnprocessableEntityHttpException(
                            "Only {$inventory->stock_quantity} item(s) of \"$product->name\" remaining in stock."
                        );
                    }
                }

                $totalAmount += $product->price * $qty;
            }

            // ── 4. Create Order ────────────────────────────────────────────
            $order = Order::create([
                'user_id' => $user->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'total_amount' => round($totalAmount, 2),
                'payment_method' => $paymentMethod,
                'notes' => $notes,
            ]);

            // ── 4b. Start the status timeline ──────────────────────────────
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'pending',
                'note' => 'Order placed',
            ]);

            // ── 5. Create Order Items + Deduct Inventory ───────────────────
            foreach ($items as $item) {
                $product = $products->get($item['product_id']);
                $inventory = $inventories->get($item['product_id']);
                $qty = (int) $item['quantity'];
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
                    $before = $inventory->stock_quantity;
                    $after = max(0, $before - $qty);

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
     * Get paginated order history for a customer.
     */
    public function getCustomerOrders(User $user, int $perPage = 20)
    {
        return Order::where('user_id', $user->id)
            ->with(['items.vendor:id,stall_name,stall_location'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Get a single order (customer must own it).
     */
    public function getOrder(User $user, int $orderId): Order
    {
        return Order::where('user_id', $user->id)
            ->with(['items.vendor:id,stall_name,stall_location'])
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
                'items.vendor:id,stall_name,stall_location',
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
     * Vendor updates the status of an order they own items in.
     */
    public function updateOrderStatus(User $user, int $orderId, string $status): Order
    {
        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            throw new AccessDeniedHttpException('Vendor profile not found');
        }

        // Confirm this vendor has items in this order
        $order = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->findOrFail($orderId);

        $order->update(['status' => $status]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $status,
            'note' => 'Status updated by vendor',
        ]);

        return $order->load(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
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
            $orderUnits = 0;
            $itemsSummary = [];

            foreach ($order->items as $item) {
                $subtotal = (float) $item->subtotal;
                $qty = (int) $item->quantity;
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
                        'quantity_sold' => 0,
                        'revenue' => 0.0,
                    ];
                }
                $topProductsMap[$pid]['quantity_sold'] += $qty;
                $topProductsMap[$pid]['revenue'] = round($topProductsMap[$pid]['revenue'] + $subtotal, 2);

                // Category breakdown
                $cat = ucfirst(strtolower($item->category ?? 'Other'));
                if (! isset($categoryMap[$cat])) {
                    $categoryMap[$cat] = [
                        'category' => $cat,
                        'revenue' => 0.0,
                        'quantity' => 0,
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
