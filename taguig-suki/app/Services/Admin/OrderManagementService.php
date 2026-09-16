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
            'total_amount' => $order->total_amount,
            'payment_method' => $order->payment_method,
            'notes' => $order->notes,
            'created_at' => $order->created_at,
            'customer' => [
                'id' => $order->user->id,
                'name' => $order->user->name,
                'email' => $order->user->email,
            ],
            'item_count' => $order->items->count(),
            'vendors' => $order->items->pluck('vendor.stall_name')->filter()->unique()->values(),
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'category' => $item->category,
                'unit' => $item->unit,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'subtotal' => $item->subtotal,
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
            $query->where(function ($q) use ($term) {
                $q->where('order_number', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"));
            });
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
}
