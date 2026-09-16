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
            'items:id,order_id,vendor_id,product_name,quantity,unit_price,subtotal',
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
                'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled',
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

        // Group items by vendor for payout breakdown
        $payouts = $order->items->groupBy('vendor_id')->map(function ($items, $vendorId) {
            $vendor = $items->first()->vendor;
            return [
                'vendor_id' => $vendorId,
                'stall_name' => $vendor?->stall_name ?? 'Unknown Vendor',
                'stall_location' => $vendor?->stall_location ?? null,
                'amount' => $items->sum(fn ($i) => (float) $i->subtotal),
                'items_count' => $items->count(),
                'items' => $items->map(fn ($i) => [
                    'product_name' => $i->product_name,
                    'quantity' => $i->quantity,
                    'unit_price' => $i->unit_price,
                    'subtotal' => $i->subtotal,
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
            'total_amount' => $order->total_amount,
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
                'unit_price' => $item->unit_price,
                'subtotal' => $item->subtotal,
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
                          $qq->whereNull('payment_status')->whereIn('status', ['pending', 'confirmed', 'processing', 'ready']);
                      });
                });
            } else {
                $statusMap = [
                    'successful' => ['completed'],
                    'failed' => ['cancelled'],
                    'pending' => ['pending', 'confirmed', 'processing', 'ready'],
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
        $totalTransactions = Order::count();

        $totalRevenue = (float) Order::where('status', '!=', 'cancelled')->sum('total_amount');
        $successfulRevenue = (float) Order::where('status', 'completed')->sum('total_amount');
        $pendingRevenue = (float) Order::whereIn('status', ['pending', 'confirmed', 'processing', 'ready'])->sum('total_amount');
        $failedRevenue = (float) Order::where('status', 'cancelled')->sum('total_amount');

        $pendingCount = Order::whereIn('status', ['pending', 'confirmed', 'processing', 'ready'])->count();
        $successfulCount = Order::where('status', 'completed')->count();
        $failedCount = Order::where('status', 'cancelled')->count();

        // Payout to vendors = sum of order_items for completed orders (actual money vendors receive)
        $totalPayout = (float) OrderItem::whereHas('order', fn (Builder $q) => $q->where('status', 'completed'))->sum('subtotal');
        $pendingPayout = (float) OrderItem::whereHas('order', fn (Builder $q) => $q->whereIn('status', ['pending', 'confirmed', 'processing', 'ready']))->sum('subtotal');

        return [
            'total_transactions' => $totalTransactions,
            'total_revenue' => $totalRevenue,
            'successful_revenue' => $successfulRevenue,
            'pending_revenue' => $pendingRevenue,
            'failed_revenue' => $failedRevenue,
            'successful_count' => $successfulCount,
            'pending_count' => $pendingCount,
            'failed_count' => $failedCount,
            'total_payout' => $totalPayout,
            'pending_payout' => $pendingPayout,
        ];
    }

    private function getMethodBreakdown(): array
    {
        $methods = ['cash' => 'Cash', 'gcash' => 'GCash', 'maya' => 'Maya'];
        $total = Order::where('status', '!=', 'cancelled')->count() ?: 1;

        return Order::select('payment_method', DB::raw('COUNT(*) as count'), DB::raw('SUM(total_amount) as revenue'))
            ->where('status', '!=', 'cancelled')
            ->groupBy('payment_method')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method,
                'label' => $methods[$row->payment_method] ?? ucfirst($row->payment_method),
                'count' => (int) $row->count,
                'revenue' => round((float) $row->revenue, 2),
                'percent' => round(((int) $row->count / $total) * 100, 1),
            ])
            ->sortByDesc('revenue')
            ->values()
            ->all();
    }

    private function getVendorPayouts(): array
    {
        return OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('vendors', 'order_items.vendor_id', '=', 'vendors.id')
            ->where('orders.status', 'completed')
            ->select(
                'vendors.id',
                'vendors.stall_name',
                'vendors.stall_location',
                DB::raw('COUNT(DISTINCT order_items.order_id) as orders_count'),
                DB::raw('SUM(order_items.subtotal) as payout')
            )
            ->groupBy('vendors.id', 'vendors.stall_name', 'vendors.stall_location')
            ->orderByDesc('payout')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'stall_name' => $row->stall_name,
                'stall_location' => $row->stall_location,
                'orders_count' => (int) $row->orders_count,
                'payout' => round((float) $row->payout, 2),
            ])
            ->all();
    }
}
