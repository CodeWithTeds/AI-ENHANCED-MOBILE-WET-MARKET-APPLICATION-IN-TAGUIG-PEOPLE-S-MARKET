<?php

namespace App\Services\Admin;

use App\Models\Order;
use App\Models\OrderStatusHistory;

class OrderManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = Order::query()->with([
            'user:id,name,email',
            'items:id,order_id,vendor_id,product_name,category,unit,quantity,unit_price,subtotal',
            'items.vendor:id,stall_name',
            'statusHistory',
        ]);

        $this->applyFilters($query, $filters);

        return [
            'orders' => $query
                ->orderByDesc('created_at')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (Order $order) => $this->present($order)),
            'stats' => $this->getStats(),
            'filters' => $filters,
            'statuses' => collect([
                'pending', 'confirmed', 'ready', 'completed', 'cancelled',
            ])->map(fn (string $status) => ['value' => $status, 'label' => ucfirst($status)]),
            'payment_methods' => collect([
                ['cash', 'Cash'], ['gcash', 'GCash'], ['maya', 'Maya'],
            ])->map(fn (array $method) => ['value' => $method[0], 'label' => $method[1]]),
            'method_breakdown' => $this->getMethodBreakdown(),
            'vendor_distribution' => $this->getVendorDistribution(),
        ];
    }

    public function updateStatus(Order $order, string $status, ?string $note = null): Order
    {
        $order->update(['status' => $status]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $status,
            'note' => $note ?? 'Status updated by admin',
        ]);

        return $order->load([
            'user:id,name,email',
            'items:id,order_id,vendor_id,product_name,category,unit,quantity,unit_price,subtotal',
            'items.vendor:id,stall_name',
            'statusHistory',
        ]);
    }

    private function present(Order $order): array
    {
        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status ?? ($order->status === 'completed' ? 'paid' : ($order->status === 'cancelled' ? 'rejected' : 'unpaid')),
            'notes' => $order->notes,
            'created_at' => $order->created_at,
            'item_count' => $order->items->count(),
            'vendors' => $order->items->pluck('vendor.stall_name')->filter()->unique()->values(),
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'category' => $item->category,
                'unit' => $item->unit,
                'quantity' => $item->quantity,
                'vendor_stall' => $item->vendor?->stall_name,
            ]),
            'status_history' => $order->statusHistory->map(fn ($history) => [
                'status' => $history->status,
                'note' => $history->note,
                'created_at' => $history->created_at,
            ]),
        ];
    }

    private function applyFilters($query, array $filters): void
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where('order_number', 'like', "%{$term}%");
        }
    }

    private function getStats(): array
    {
        return [
            'total' => Order::count(),
            'pending' => Order::where('status', 'pending')->count(),
            'in_progress' => Order::whereIn('status', ['confirmed', 'ready'])->count(),
            'completed' => Order::where('status', 'completed')->count(),
            'cancelled' => Order::where('status', 'cancelled')->count(),
        ];
    }

    private function getMethodBreakdown(): array
    {
        $methods = ['cash' => 'Cash', 'gcash' => 'GCash', 'maya' => 'Maya'];
        $total = Order::where('status', '!=', 'cancelled')->count() ?: 1;

        return Order::select('payment_method', \DB::raw('COUNT(*) as count'))
            ->where('status', '!=', 'cancelled')
            ->groupBy('payment_method')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method,
                'label' => $methods[$row->payment_method] ?? ucfirst((string) $row->payment_method),
                'count' => (int) $row->count,
                'percent' => round(((int) $row->count / $total) * 100, 1),
            ])
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    private function getVendorDistribution(): array
    {
        $totalOrders = Order::where('status', 'completed')->count() ?: 1;

        return \App\Models\OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('vendors', 'order_items.vendor_id', '=', 'vendors.id')
            ->where('orders.status', 'completed')
            ->select(
                'vendors.id',
                'vendors.stall_name',
                'vendors.stall_location',
                \DB::raw('COUNT(DISTINCT order_items.order_id) as orders_count')
            )
            ->groupBy('vendors.id', 'vendors.stall_name', 'vendors.stall_location')
            ->orderByDesc('orders_count')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'stall_name' => $row->stall_name,
                'stall_location' => $row->stall_location,
                'orders_count' => (int) $row->orders_count,
                'percent' => round(((int) $row->orders_count / $totalOrders) * 100, 1),
            ])
            ->all();
    }
}
