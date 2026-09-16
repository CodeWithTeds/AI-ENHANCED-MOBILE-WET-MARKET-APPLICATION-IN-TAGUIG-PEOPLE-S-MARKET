<?php

namespace App\Services\Admin;

use App\Enums\TaskStatus;
use App\Enums\VendorStatus;
use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\RecipeRecommendation;
use App\Models\Review;
use App\Models\Task;
use App\Models\User;
use App\Models\Vendor;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportsAnalyticsService
{
    /**
     * Build the full data payload for the Reports & Analytics page.
     */
    public function getOverviewData(array $filters): array
    {
        $range = in_array($filters['range'] ?? '', ['7d', '30d', '90d', '12m', 'all'], true)
            ? $filters['range']
            : '30d';

        [$from, $to, $granularity] = $this->resolveWindow($range);

        return [
            'filters' => ['range' => $range],
            'range' => $range,
            'range_options' => $this->rangeOptions(),
            'overview' => $this->getOverview($from, $to),
            'sales' => $this->getSales($from, $to, $granularity),
            'users' => $this->getUsers($from, $to, $granularity),
            'vendors' => $this->getVendors($from, $to),
            'inventory' => $this->getInventory($from, $to),
            'system' => $this->getSystem($from, $to),
        ];
    }

    private function rangeOptions(): array
    {
        return [
            ['value' => '7d', 'label' => 'Last 7 Days'],
            ['value' => '30d', 'label' => 'Last 30 Days'],
            ['value' => '90d', 'label' => 'Last 90 Days'],
            ['value' => '12m', 'label' => 'Last 12 Months'],
            ['value' => 'all', 'label' => 'All Time'],
        ];
    }

    /**
     * Resolve the reporting window and bucketing granularity for a range key.
     *
     * @return array{0: CarbonInterface|null, 1: CarbonInterface, 2: 'day'|'week'|'month'}
     */
    private function resolveWindow(string $range): array
    {
        $end = now();

        return match ($range) {
            '7d' => [$end->copy()->subDays(6)->startOfDay(), $end->copy()->endOfDay(), 'day'],
            '30d' => [$end->copy()->subDays(29)->startOfDay(), $end->copy()->endOfDay(), 'day'],
            '90d' => [$end->copy()->subDays(89)->startOfDay()->startOfWeek(), $end->copy()->endOfDay(), 'week'],
            '12m' => [$end->copy()->subMonths(11)->startOfMonth(), $end->copy()->endOfDay(), 'month'],
            default => [null, $end->copy()->endOfDay(), 'month'],
        };
    }

    /* ─── Overview KPIs ─── */

    private function getOverview(?CarbonInterface $from, CarbonInterface $to): array
    {
        $revenue = (float) Order::query()
            ->where('status', '!=', 'cancelled')
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->where('created_at', '<=', $to)
            ->sum('total_amount');

        $orders = Order::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->where('created_at', '<=', $to)
            ->count();

        return [
            'total_revenue' => $revenue,
            'total_orders' => $orders,
            'avg_order_value' => $orders > 0 ? round($revenue / $orders, 2) : 0,
            'total_users' => User::count(),
            'total_vendors' => Vendor::count(),
            'total_products' => Product::count(),
            'inventory_value' => (float) Inventory::query()
                ->where('stock_quantity', '>', 0)
                ->select(DB::raw('COALESCE(SUM(cost_price * stock_quantity), 0) as value'))
                ->value('value'),
        ];
    }

    /* ─── Sales ─── */

    private function getSales(?CarbonInterface $from, CarbonInterface $to, string $granularity): array
    {
        $orders = Order::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->where('created_at', '<=', $to)
            ->get(['id', 'status', 'total_amount', 'payment_method', 'created_at']);

        $revenue = $orders->where('status', '!=', 'cancelled')->sum(fn ($o) => (float) $o->total_amount);
        $orderCount = $orders->count();
        $nonCancelled = $orders->where('status', '!=', 'cancelled')->count();

        $revenueTrend = $this->buildTimeSeries(
            $from ?? $orders->min('created_at'),
            $to,
            $granularity,
            $orders->where('status', '!=', 'cancelled'),
            'revenue'
        );

        $statusLabels = [
            'pending' => 'Pending',
            'confirmed' => 'Confirmed',
            'ready' => 'Ready',
            'completed' => 'Completed',
            'cancelled' => 'Cancelled',
        ];

        $statusBreakdown = $orders
            ->groupBy('status')
            ->map(fn ($group, $status) => [
                'status' => $status,
                'label' => $statusLabels[$status] ?? ucfirst($status),
                'count' => $group->count(),
                'revenue' => round($group->where('status', '!=', 'cancelled')->sum(fn ($o) => (float) $o->total_amount), 2),
            ])
            ->sortBy(fn ($row) => array_flip(array_keys($statusLabels))[$row['status']] ?? 99)
            ->values()
            ->all();

        $paymentMethods = [
            'cash' => 'Cash',
            'gcash' => 'GCash',
            'maya' => 'Maya',
        ];

        $paymentTotal = $orders->where('status', '!=', 'cancelled')->count() ?: 1;
        $paymentBreakdown = $orders
            ->groupBy('payment_method')
            ->map(fn ($group, $method) => [
                'method' => $method,
                'label' => $paymentMethods[$method] ?? ucfirst($method),
                'count' => $group->count(),
                'revenue' => round($group->where('status', '!=', 'cancelled')->sum(fn ($o) => (float) $o->total_amount), 2),
                'percent' => round(($group->where('status', '!=', 'cancelled')->count() / $paymentTotal) * 100, 1),
            ])
            ->sortByDesc('revenue')
            ->values()
            ->all();

        return [
            'total_revenue' => round($revenue, 2),
            'total_orders' => $orderCount,
            'avg_order_value' => $nonCancelled > 0 ? round($revenue / $nonCancelled, 2) : 0,
            'completed_orders' => $orders->where('status', 'completed')->count(),
            'cancelled_orders' => $orders->where('status', 'cancelled')->count(),
            'revenue_trend' => $revenueTrend,
            'status_breakdown' => $statusBreakdown,
            'payment_breakdown' => $paymentBreakdown,
            'top_products' => $this->getTopProducts($from, $to),
            'top_vendors' => $this->getTopVendors($from, $to),
        ];
    }

    private function getTopProducts(?CarbonInterface $from, CarbonInterface $to): array
    {
        return OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('vendors', 'order_items.vendor_id', '=', 'vendors.id')
            ->where('orders.status', '!=', 'cancelled')
            ->when($from, fn ($q) => $q->where('order_items.created_at', '>=', $from))
            ->where('order_items.created_at', '<=', $to)
            ->select(
                'order_items.product_name',
                'order_items.category',
                'vendors.stall_name',
                DB::raw('SUM(order_items.quantity) as units_sold'),
                DB::raw('SUM(order_items.subtotal) as revenue')
            )
            ->groupBy('order_items.product_name', 'order_items.category', 'vendors.stall_name')
            ->orderByDesc('revenue')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->product_name,
                'category' => $row->category,
                'vendor' => $row->stall_name,
                'units_sold' => (int) $row->units_sold,
                'revenue' => round((float) $row->revenue, 2),
            ])
            ->all();
    }

    private function getTopVendors(?CarbonInterface $from, CarbonInterface $to): array
    {
        return OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('vendors', 'order_items.vendor_id', '=', 'vendors.id')
            ->where('orders.status', '!=', 'cancelled')
            ->when($from, fn ($q) => $q->where('order_items.created_at', '>=', $from))
            ->where('order_items.created_at', '<=', $to)
            ->select(
                'vendors.id',
                'vendors.stall_name',
                DB::raw('COUNT(DISTINCT order_items.order_id) as orders'),
                DB::raw('SUM(order_items.subtotal) as revenue')
            )
            ->groupBy('vendors.id', 'vendors.stall_name')
            ->orderByDesc('revenue')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'stall_name' => $row->stall_name,
                'orders' => (int) $row->orders,
                'revenue' => round((float) $row->revenue, 2),
            ])
            ->all();
    }

    /* ─── Users ─── */

    private function getUsers(?CarbonInterface $from, CarbonInterface $to, string $granularity): array
    {
        $users = User::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->where('created_at', '<=', $to)
            ->get(['id', 'is_admin', 'created_at']);

        $vendorUserIds = Vendor::query()->pluck('user_id');

        $admins = User::where('is_admin', true)->count();
        $vendors = $vendorUserIds->count();
        $customers = User::where('is_admin', false)
            ->whereNotIn('id', $vendorUserIds)
            ->count();

        return [
            'total' => User::count(),
            'new_users' => $users->count(),
            'customers' => $customers,
            'vendors' => $vendors,
            'admins' => $admins,
            'roles' => [
                ['label' => 'Customers', 'count' => $customers],
                ['label' => 'Vendors', 'count' => $vendors],
                ['label' => 'Admins', 'count' => $admins],
            ],
            'new_users_trend' => $this->buildTimeSeries(
                $from ?? $users->min('created_at'),
                $to,
                $granularity,
                $users,
                'count'
            ),
        ];
    }

    /* ─── Vendors ─── */

    private function getVendors(?CarbonInterface $from, CarbonInterface $to): array
    {
        $vendors = Vendor::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->where('created_at', '<=', $to)
            ->get(['status', 'stall_location', 'created_at']);

        $labels = [
            VendorStatus::Pending->value => 'Pending',
            VendorStatus::Approved->value => 'Approved',
            VendorStatus::Rejected->value => 'Rejected',
            VendorStatus::Suspended->value => 'Suspended',
        ];

        $statusBreakdown = collect($labels)
            ->map(fn ($label, $status) => [
                'status' => $status,
                'label' => $label,
                'count' => Vendor::where('status', $status)->count(),
            ])
            ->values()
            ->all();

        return [
            'total' => Vendor::count(),
            'pending' => Vendor::where('status', VendorStatus::Pending->value)->count(),
            'approved' => Vendor::where('status', VendorStatus::Approved->value)->count(),
            'rejected' => Vendor::where('status', VendorStatus::Rejected->value)->count(),
            'suspended' => Vendor::where('status', VendorStatus::Suspended->value)->count(),
            'new_vendors' => $vendors->count(),
            'status_breakdown' => $statusBreakdown,
            'locations' => Vendor::query()
                ->select('stall_location', DB::raw('COUNT(*) as count'))
                ->groupBy('stall_location')
                ->orderByDesc('count')
                ->limit(6)
                ->get()
                ->map(fn ($row) => [
                    'location' => $row->stall_location ?: 'Unassigned',
                    'count' => (int) $row->count,
                ])
                ->all(),
        ];
    }

    /* ─── Inventory ─── */

    private function getInventory(?CarbonInterface $from, CarbonInterface $to): array
    {
        $totalValue = (float) Inventory::query()
            ->where('stock_quantity', '>', 0)
            ->select(DB::raw('COALESCE(SUM(cost_price * stock_quantity), 0) as value'))
            ->value('value');

        $retailValue = (float) Inventory::query()
            ->where('stock_quantity', '>', 0)
            ->select(DB::raw('COALESCE(SUM(selling_price * stock_quantity), 0) as value'))
            ->value('value');

        $categoryBreakdown = Inventory::query()
            ->join('products', 'inventories.product_id', '=', 'products.id')
            ->select(
                'products.category',
                DB::raw('COUNT(DISTINCT inventories.id) as items'),
                DB::raw('COALESCE(SUM(inventories.cost_price * inventories.stock_quantity), 0) as value')
            )
            ->groupBy('products.category')
            ->orderByDesc('value')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category ?: 'Uncategorized',
                'items' => (int) $row->items,
                'value' => round((float) $row->value, 2),
            ])
            ->all();

        $movementLabels = [
            'restock' => 'Restock',
            'sold' => 'Sold',
            'returned' => 'Returned',
            'spoiled' => 'Spoiled',
            'adjustment' => 'Adjustment',
            'reserved' => 'Reserved',
            'unreserved' => 'Released',
            'transferred' => 'Transferred',
            'initial' => 'Initial',
        ];

        $stockMovements = InventoryLog::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->where('created_at', '<=', $to)
            ->select('type', DB::raw('COUNT(*) as count'), DB::raw('SUM(quantity_change) as net_change'))
            ->groupBy('type')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => [
                'type' => $row->type,
                'label' => $movementLabels[$row->type] ?? ucfirst($row->type),
                'count' => (int) $row->count,
                'net_change' => (int) $row->net_change,
            ])
            ->all();

        $lowStock = Inventory::query()
            ->lowStock()
            ->with(['product:id,name,unit', 'vendor:id,stall_name'])
            ->orderBy('stock_quantity')
            ->limit(6)
            ->get()
            ->map(fn (Inventory $item) => [
                'name' => $item->product->name,
                'vendor' => $item->vendor->stall_name,
                'stock_quantity' => $item->stock_quantity,
                'reorder_level' => $item->reorder_level,
                'unit' => $item->product->unit,
            ])
            ->all();

        return [
            'total_items' => Inventory::count(),
            'in_stock' => Inventory::where('stock_quantity', '>', 0)->whereColumn('stock_quantity', '>', 'reorder_level')->count(),
            'low_stock' => Inventory::lowStock()->count(),
            'out_of_stock' => Inventory::outOfStock()->count(),
            'total_value' => $totalValue,
            'retail_value' => $retailValue,
            'category_breakdown' => $categoryBreakdown,
            'stock_movements' => $stockMovements,
            'low_stock_items' => $lowStock,
        ];
    }

    /* ─── System Performance ─── */

    private function getSystem(?CarbonInterface $from, CarbonInterface $to): array
    {
        $ai = RecipeRecommendation::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->where('created_at', '<=', $to)
            ->get(['status']);

        $aiTotal = $ai->count();
        $aiFound = $ai->where('status', 'found')->count();

        return [
            'active_sessions' => (int) DB::table('sessions')
                ->where('last_activity', '>=', now()->subMinutes(15)->timestamp)
                ->count(),
            'total_sessions' => (int) DB::table('sessions')->count(),
            'failed_jobs' => (int) DB::table('failed_jobs')->count(),
            'pending_jobs' => (int) DB::table('jobs')->count(),
            'ai_requests' => $aiTotal,
            'ai_breakdown' => collect(['found', 'not_found', 'error'])
                ->map(fn ($status) => [
                    'status' => $status,
                    'label' => match ($status) {
                        'found' => 'Found',
                        'not_found' => 'Not Found',
                        default => 'Error',
                    },
                    'count' => $ai->where('status', $status)->count(),
                ])
                ->all(),
            'ai_success_rate' => $aiTotal > 0 ? round(($aiFound / $aiTotal) * 100, 1) : 0,
            'reviews' => Review::query()
                ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
                ->where('created_at', '<=', $to)
                ->count(),
            'average_rating' => round((float) Review::query()
                ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
                ->where('created_at', '<=', $to)
                ->avg('rating'), 1),
            'pending_tasks' => Task::where('status', TaskStatus::PENDING->value)->count(),
        ];
    }

    /* ─── Time Series Helpers ─── */

    /**
     * Build a labeled time series from a collection of dated models.
     *
     * @param  Collection<int, Model>|null  $rows
     * @return array<int, array{label: string, value: float|int}>
     */
    private function buildTimeSeries(?CarbonInterface $from, CarbonInterface $to, string $granularity, $rows, string $metric): array
    {
        $start = $from?->copy() ?? Carbon::parse($rows->min('created_at'))->startOfMonth();

        if ($start->isAfter($to)) {
            $start = $to->copy()->startOfMonth();
        }

        $buckets = collect($this->makeBuckets($start, $to, $granularity));

        $rows?->each(function ($row) use (&$buckets, $granularity, $metric) {
            $created = Carbon::parse($row->created_at);
            $key = $this->bucketKey($created, $granularity);

            if (! $buckets->has($key)) {
                return;
            }

            $current = $buckets->get($key);
            $current['value'] += $metric === 'revenue' ? (float) $row->total_amount : 1;
            $buckets->put($key, $current);
        });

        return $buckets->values()->all();
    }

    /**
     * @return array<string, array{label: string, value: float}>
     */
    private function makeBuckets(CarbonInterface $from, CarbonInterface $to, string $granularity): array
    {
        $buckets = [];
        $cursor = $from->copy();

        while ($cursor->lte($to)) {
            $key = $this->bucketKey($cursor, $granularity);

            $label = match ($granularity) {
                'day' => $cursor->format('M j'),
                'week' => 'Wk '.$cursor->format('M j'),
                default => $cursor->format('M y'),
            };

            $buckets[$key] = ['label' => $label, 'value' => 0];

            $cursor = match ($granularity) {
                'day' => $cursor->addDay(),
                'week' => $cursor->addWeek(),
                default => $cursor->addMonth(),
            };
        }

        return $buckets;
    }

    private function bucketKey(CarbonInterface $date, string $granularity): string
    {
        return match ($granularity) {
            'day' => $date->format('Y-m-d'),
            'week' => $date->copy()->startOfWeek()->format('Y-m-d'),
            default => $date->format('Y-m'),
        };
    }
}
