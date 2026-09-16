<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CustomerReportService
{
    /**
     * Generate purchase report for a customer within optional date range.
     *
     * @return array{
     *   summary: array,
     *   date_range: array,
     *   orders: array,
     *   top_products: array,
     *   vendor_breakdown: array,
     *   category_breakdown: array,
     *   payment_breakdown: array,
     *   status_breakdown: array,
     *   daily_spending: array,
     * }
     */
    public function getReport(User $user, ?string $dateFrom, ?string $dateTo): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom)->startOfDay() : null;
        $to = $dateTo ? Carbon::parse($dateTo)->endOfDay() : null;

        // Guard: if from > to, swap
        if ($from && $to && $from->gt($to)) {
            [$from, $to] = [$to, $from];
            // re-normalize
            $from = $from->copy()->startOfDay();
            $to = $to->copy()->endOfDay();
        }

        $query = Order::where('user_id', $user->id)
            ->with(['items.vendor:id,stall_name,stall_location'])
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to))
            ->orderByDesc('created_at');

        /** @var Collection<int, Order> $orders */
        $orders = $query->get();

        $totalOrders = $orders->count();
        $cancelledOrders = $orders->where('status', 'cancelled')->count();
        $completedOrders = $orders->where('status', 'completed')->count();
        $pendingOrders = $orders->whereIn('status', ['pending', 'confirmed', 'ready'])->count();

        // Total spent excludes cancelled orders
        $nonCancelled = $orders->where('status', '!=', 'cancelled');
        $totalSpent = round($nonCancelled->sum(fn ($o) => (float) $o->total_amount), 2);
        $averageOrderValue = $nonCancelled->count() > 0 ? round($totalSpent / $nonCancelled->count(), 2) : 0;

        $totalItemsPurchased = 0;
        $totalUniqueProducts = collect();
        foreach ($nonCancelled as $order) {
            foreach ($order->items as $item) {
                $totalItemsPurchased += (float) $item->quantity;
                $totalUniqueProducts->push($item->product_id);
            }
        }
        $uniqueProductsCount = $totalUniqueProducts->unique()->count();

        // Payment breakdown (non-cancelled)
        $paymentMethods = ['cash' => 'Cash', 'gcash' => 'GCash', 'maya' => 'Maya'];
        $paymentBreakdown = $nonCancelled->groupBy(fn ($o) => strtolower($o->payment_method ?? 'cash'))
            ->map(fn ($group, $method) => [
                'method' => $method,
                'label' => $paymentMethods[$method] ?? ucfirst($method),
                'count' => $group->count(),
                'total' => round($group->sum(fn ($o) => (float) $o->total_amount), 2),
                'percent' => $totalOrders > 0 ? round(($group->count() / $nonCancelled->count()) * 100, 1) : 0,
            ])->values()->all();

        // Ensure all methods appear even if zero (for consistent UI)
        foreach ($paymentMethods as $key => $label) {
            $exists = collect($paymentBreakdown)->firstWhere('method', $key);
            if (! $exists) {
                $paymentBreakdown[] = [
                    'method' => $key,
                    'label' => $label,
                    'count' => 0,
                    'total' => 0,
                    'percent' => 0,
                ];
            }
        }

        // Status breakdown
        $statusLabels = [
            'pending' => 'Pending',
            'confirmed' => 'Confirmed',
            'ready' => 'Ready',
            'completed' => 'Completed',
            'cancelled' => 'Cancelled',
        ];
        $statusBreakdown = $orders->groupBy('status')
            ->map(fn ($group, $status) => [
                'status' => $status,
                'label' => $statusLabels[$status] ?? ucfirst($status),
                'count' => $group->count(),
                'total' => round($group->sum(fn ($o) => (float) $o->total_amount), 2),
            ])->values()->all();

        // Category breakdown (non-cancelled items)
        $categoryMap = [];
        $vendorMap = [];
        $productMap = [];

        foreach ($nonCancelled as $order) {
            foreach ($order->items as $item) {
                // Category
                $cat = strtolower($item->category ?? 'other');
                $catLabel = ucfirst($cat);
                if (! isset($categoryMap[$cat])) {
                    $categoryMap[$cat] = ['category' => $catLabel, 'quantity' => 0, 'total' => 0];
                }
                $categoryMap[$cat]['quantity'] += (float) $item->quantity;
                $categoryMap[$cat]['total'] = round($categoryMap[$cat]['total'] + (float) $item->subtotal, 2);

                // Vendor
                $vendorId = $item->vendor_id ?? 0;
                $vendorName = $item->vendor?->stall_name ?? 'Unknown Vendor';
                if (! isset($vendorMap[$vendorId])) {
                    $vendorMap[$vendorId] = [
                        'vendor_id' => $vendorId,
                        'stall_name' => $vendorName,
                        'stall_location' => $item->vendor?->stall_location ?? null,
                        'orders_count' => 0,
                        'items_count' => 0,
                        'total' => 0,
                    ];
                }
                $vendorMap[$vendorId]['items_count'] += (float) $item->quantity;
                $vendorMap[$vendorId]['total'] = round($vendorMap[$vendorId]['total'] + (float) $item->subtotal, 2);

                // Product
                $pid = $item->product_id;
                if (! isset($productMap[$pid])) {
                    $productMap[$pid] = [
                        'product_id' => $pid,
                        'product_name' => $item->product_name,
                        'category' => $item->category,
                        'unit' => $item->unit,
                        'quantity' => 0,
                        'total' => 0,
                        'orders_count' => 0,
                    ];
                }
                $productMap[$pid]['quantity'] += (float) $item->quantity;
                $productMap[$pid]['total'] = round($productMap[$pid]['total'] + (float) $item->subtotal, 2);
            }
        }

        // Vendor orders count (distinct orders per vendor)
        $vendorOrdersCount = [];
        foreach ($nonCancelled as $order) {
            $seen = [];
            foreach ($order->items as $item) {
                $vid = $item->vendor_id ?? 0;
                if (! isset($seen[$vid])) {
                    $vendorMap[$vid]['orders_count'] = ($vendorMap[$vid]['orders_count'] ?? 0) + 1;
                    $seen[$vid] = true;
                }
                // For product orders_count, count per product occurrence? We'll increment per order per product
            }
        }

        // For product orders_count: count distinct orders containing product
        $productOrders = [];
        foreach ($nonCancelled as $order) {
            $seenPids = [];
            foreach ($order->items as $item) {
                if (! isset($seenPids[$item->product_id])) {
                    $productMap[$item->product_id]['orders_count'] = ($productMap[$item->product_id]['orders_count'] ?? 0) + 1;
                    $seenPids[$item->product_id] = true;
                }
            }
        }

        $categoryBreakdown = array_values($categoryMap);
        usort($categoryBreakdown, fn ($a, $b) => $b['total'] <=> $a['total']);
        // Add percentage
        foreach ($categoryBreakdown as &$c) {
            $c['percent'] = $totalSpent > 0 ? round(($c['total'] / $totalSpent) * 100, 1) : 0;
        }
        unset($c);

        $vendorBreakdown = array_values($vendorMap);
        usort($vendorBreakdown, fn ($a, $b) => $b['total'] <=> $a['total']);
        $vendorBreakdown = array_slice($vendorBreakdown, 0, 10);

        $topProducts = array_values($productMap);
        usort($topProducts, fn ($a, $b) => $b['total'] <=> $a['total']);
        $topProducts = array_slice($topProducts, 0, 10);

        // Daily spending for chart (last 30 days or within range)
        $dailySpending = $this->buildDailySpending($orders, $from, $to);

        // Detailed orders list
        $ordersDetailed = $orders->map(function (Order $order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'payment_reference_number' => $order->payment_reference_number,
                'total_amount' => (float) $order->total_amount,
                'created_at' => $order->created_at?->toIso8601String(),
                'updated_at' => $order->updated_at?->toIso8601String(),
                'notes' => $order->notes,
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'category' => $item->category,
                    'unit' => $item->unit,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'subtotal' => (float) $item->subtotal,
                    'vendor_id' => $item->vendor_id,
                    'vendor_stall' => $item->vendor?->stall_name ?? null,
                ])->all(),
                'item_count' => $order->items->count(),
                'total_units' => $order->items->sum(fn ($i) => (int) $i->quantity),
            ];
        })->all();

        $effectiveFrom = $from?->toDateString();
        $effectiveTo = $to?->toDateString();

        // If no explicit range, set to min/max order dates
        if (! $effectiveFrom && ! $effectiveTo && $orders->isNotEmpty()) {
            $effectiveFrom = $orders->min('created_at')?->toDateString();
            $effectiveTo = $orders->max('created_at')?->toDateString();
        }

        return [
            'summary' => [
                'total_spent' => $totalSpent,
                'total_orders' => $totalOrders,
                'completed_orders' => $completedOrders,
                'pending_orders' => $pendingOrders,
                'cancelled_orders' => $cancelledOrders,
                'average_order_value' => $averageOrderValue,
                'total_items_purchased' => $totalItemsPurchased,
                'unique_products' => $uniqueProductsCount,
            ],
            'date_range' => [
                'from' => $effectiveFrom,
                'to' => $effectiveTo,
                'requested_from' => $dateFrom,
                'requested_to' => $dateTo,
            ],
            'orders' => $ordersDetailed,
            'top_products' => $topProducts,
            'vendor_breakdown' => $vendorBreakdown,
            'category_breakdown' => $categoryBreakdown,
            'payment_breakdown' => $paymentBreakdown,
            'status_breakdown' => $statusBreakdown,
            'daily_spending' => $dailySpending,
        ];
    }

    private function buildDailySpending(Collection $orders, ?Carbon $from, ?Carbon $to): array
    {
        // Determine range for chart: if explicit from/to, use that; else last 7/14 days?
        $nonCancelled = $orders->where('status', '!=', 'cancelled');
        if ($nonCancelled->isEmpty() && ! $from && ! $to) {
            return [];
        }

        if ($from && $to) {
            $start = $from->copy()->startOfDay();
            $end = $to->copy()->endOfDay();
            // Limit to 90 days to avoid huge payload; if longer, bucket by week? For now daily up to 90
            $daysDiff = $start->diffInDays($end);
            if ($daysDiff > 90) {
                // Switch to weekly bucketing for long ranges
                return $this->buildWeeklySpending($nonCancelled, $start, $end);
            }
        } elseif ($from) {
            $start = $from->copy()->startOfDay();
            $end = $to ? $to->copy()->endOfDay() : now()->endOfDay();
        } elseif ($to) {
            $end = $to->copy()->endOfDay();
            if ($from) {
                $start = $from->copy()->startOfDay();
            } else {
                $minCreated = $nonCancelled->min('created_at');
                $start = $minCreated ? Carbon::parse($minCreated)->startOfDay() : $end->copy()->subDays(6)->startOfDay();
            }
        } else {
            // No range: show last 7 days
            $end = now()->endOfDay();
            $start = now()->subDays(6)->startOfDay();
        }

        $daysDiff = $start->diffInDays($end);
        // Cap at 60 days daily
        if ($daysDiff > 60) {
            $start = $end->copy()->subDays(59)->startOfDay();
        }

        $daily = [];
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m-d');
            $dayStart = $cursor->copy()->startOfDay();
            $dayEnd = $cursor->copy()->endOfDay();
            $dayOrders = $nonCancelled->filter(fn ($o) => $o->created_at >= $dayStart && $o->created_at <= $dayEnd);
            $daily[] = [
                'date' => $key,
                'label' => $cursor->format('M j'),
                'day' => $cursor->format('D'),
                'total' => round($dayOrders->sum(fn ($o) => (float) $o->total_amount), 2),
                'orders_count' => $dayOrders->count(),
            ];
            $cursor->addDay();
        }

        return $daily;
    }

    private function buildWeeklySpending(Collection $orders, Carbon $start, Carbon $end): array
    {
        $weekly = [];
        $cursor = $start->copy()->startOfWeek();
        $endWeek = $end->copy()->endOfWeek();
        while ($cursor->lte($endWeek)) {
            $weekStart = $cursor->copy()->startOfWeek();
            $weekEnd = $cursor->copy()->endOfWeek();
            $weekOrders = $orders->filter(fn ($o) => $o->created_at >= $weekStart && $o->created_at <= $weekEnd);
            $weekly[] = [
                'date' => $weekStart->format('Y-m-d'),
                'label' => $weekStart->format('M j') . ' - ' . $weekEnd->format('M j'),
                'day' => 'Wk ' . $weekStart->format('M j'),
                'total' => round($weekOrders->sum(fn ($o) => (float) $o->total_amount), 2),
                'orders_count' => $weekOrders->count(),
            ];
            $cursor->addWeek();
        }
        return $weekly;
    }
}
