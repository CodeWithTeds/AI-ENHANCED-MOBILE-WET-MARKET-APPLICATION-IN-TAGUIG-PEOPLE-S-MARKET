<?php

namespace App\Services\Admin;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class PaymentManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = Order::query()->with([
            'user:id,name,email',
            'items:id,order_id,vendor_id,product_name,quantity,status',
            'items.vendor:id,stall_name,stall_location',
        ]);

        $this->applyFilters($query, $filters);

        $payments = $query
            ->orderByDesc('created_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Order $order) => $this->present($order));

        return [
            'payments' => $payments,
            'stats' => $this->getStats(),
            'filters' => $filters,
            'payment_methods' => collect([
                ['cash', 'Cash'], ['gcash', 'GCash'], ['maya', 'Maya'],
            ])->map(fn (array $method) => ['value' => $method[0], 'label' => $method[1]]),
            'payment_statuses' => collect([
                ['value' => 'pending', 'label' => 'Pending'],
                ['value' => 'successful', 'label' => 'Successful'],
                ['value' => 'failed', 'label' => 'Failed'],
            ]),
            'order_statuses' => collect([
                'pending', 'confirmed', 'ready', 'completed', 'cancelled',
            ])->map(fn (string $status) => ['value' => $status, 'label' => ucfirst($status)]),
            'method_breakdown' => $this->getMethodBreakdown(),
            'vendor_payouts' => $this->getVendorPayouts(),
        ];
    }

    private function present(Order $order): array
    {
        // Use explicit payment_status if present, else derive from order status for legacy records
        $paymentStatus = $order->payment_status
            ? $this->resolvePaymentStatusFromPayment($order->payment_status)
            : $this->resolvePaymentStatus($order->status);

        // Group items by vendor (order counts only — amounts are private to vendors)
        $payouts = $order->items->groupBy('vendor_id')->map(function ($items, $vendorId) {
            $vendor = $items->first()->vendor;
            return [
                'vendor_id' => $vendorId,
                'stall_name' => $vendor?->stall_name ?? 'Unknown Vendor',
                'stall_location' => $vendor?->stall_location ?? null,
                'items_count' => $items->count(),
                'items' => $items->map(fn ($i) => [
                    'product_name' => $i->product_name,
                    'quantity' => $i->quantity,
                    'status' => $i->status,
                ])->all(),
            ];
        })->values()->all();

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $paymentStatus,
            'payment_status_raw' => $order->payment_status ?? 'unpaid',
            'payment_method' => $order->payment_method,
            'payment_reference_number' => $order->payment_reference_number,
            'payment_submitted_at' => $order->payment_submitted_at,
            'payment_verified_at' => $order->payment_verified_at,
            'payment_verified_by' => $order->payment_verified_by,
            'notes' => $order->notes,
            'created_at' => $order->created_at,
            'updated_at' => $order->updated_at,
            'customer' => $order->user ? [
                'id' => $order->user->id,
                'name' => $order->user->name,
                'email' => $order->user->email,
            ] : null,
            'item_count' => $order->items->count(),
            'vendors' => $order->items->pluck('vendor.stall_name')->filter()->unique()->values()->all(),
            'payouts' => $payouts,
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'quantity' => $item->quantity,
                'status' => $item->status,
                'vendor_stall' => $item->vendor?->stall_name,
            ])->all(),
        ];
    }

    private function resolvePaymentStatus(string $orderStatus): string
    {
        return match ($orderStatus) {
            'completed' => 'successful',
            'cancelled' => 'failed',
            default => 'pending',
        };
    }

    private function resolvePaymentStatusFromPayment(string $paymentStatus): string
    {
        return match ($paymentStatus) {
            'paid' => 'successful',
            'pending_verification' => 'pending_verification',
            'rejected' => 'failed',
            'unpaid' => 'pending',
            default => 'pending',
        };
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }

        if (! empty($filters['payment_status'])) {
            // Support both legacy order-status mapping and new payment_status
            if (in_array($filters['payment_status'], ['paid', 'successful'])) {
                // Check explicit payment_status or completed orders
                $query->where(function (Builder $q) {
                    $q->where('payment_status', 'paid')
                      ->orWhere(function (Builder $qq) {
                          $qq->whereNull('payment_status')->where('status', 'completed');
                      });
                });
            } elseif (in_array($filters['payment_status'], ['pending_verification'])) {
                $query->where('payment_status', 'pending_verification');
            } elseif (in_array($filters['payment_status'], ['failed', 'rejected'])) {
                $query->where(function (Builder $q) {
                    $q->where('payment_status', 'rejected')
                      ->orWhere(function (Builder $qq) {
                          $qq->whereNull('payment_status')->where('status', 'cancelled');
                      });
                });
            } elseif ($filters['payment_status'] === 'pending') {
                $query->where(function (Builder $q) {
                    $q->where('payment_status', 'unpaid')
                      ->orWhere(function (Builder $qq) {
                          $qq->whereNull('payment_status')->whereIn('status', ['pending', 'confirmed', 'ready']);
                      });
                });
            } else {
                $statusMap = [
                    'successful' => ['completed'],
                    'failed' => ['cancelled'],
                    'pending' => ['pending', 'confirmed', 'ready'],
                ];
                $orderStatuses = $statusMap[$filters['payment_status']] ?? null;
                if ($orderStatuses) {
                    $query->whereIn('status', $orderStatuses);
                }
            }
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function (Builder $q) use ($term) {
                $q->where('order_number', 'like', "%{$term}%")
                    ->orWhereHas('user', fn (Builder $uq) => $uq->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"));
            });
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }
    }

    private function getStats(): array
    {
        // Counts only — revenue and vendor payouts are private to vendors.
        return [
            'total_transactions' => Order::count(),
            'successful_count' => Order::where('status', 'completed')->count(),
            'pending_count' => Order::whereIn('status', ['pending', 'confirmed', 'ready'])->count(),
            'failed_count' => Order::where('status', 'cancelled')->count(),
        ];
    }

    private function getMethodBreakdown(): array
    {
        $methods = ['cash' => 'Cash', 'gcash' => 'GCash', 'maya' => 'Maya'];
        $total = Order::where('status', '!=', 'cancelled')->count() ?: 1;

        return Order::select('payment_method', DB::raw('COUNT(*) as count'))
            ->where('status', '!=', 'cancelled')
            ->groupBy('payment_method')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method,
                'label' => $methods[$row->payment_method] ?? ucfirst($row->payment_method),
                'count' => (int) $row->count,
                'percent' => round(((int) $row->count / $total) * 100, 1),
            ])
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    private function getVendorPayouts(): array
    {
        // Order counts per vendor only — payout amounts are private to vendors.
        return OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('vendors', 'order_items.vendor_id', '=', 'vendors.id')
            ->where('orders.status', 'completed')
            ->select(
                'vendors.id',
                'vendors.stall_name',
                'vendors.stall_location',
                DB::raw('COUNT(DISTINCT order_items.order_id) as orders_count')
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
            ])
            ->all();
    }
}
