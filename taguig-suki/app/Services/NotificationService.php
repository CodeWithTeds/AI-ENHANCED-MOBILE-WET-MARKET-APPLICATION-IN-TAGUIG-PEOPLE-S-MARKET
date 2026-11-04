<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Models\Vendor;
use App\Notifications\NewOrderReceivedNotification;
use App\Notifications\OrderStatusUpdatedNotification;
use App\Notifications\PaymentProofSubmittedNotification;
use App\Notifications\PaymentStatusUpdatedNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Throwable;

class NotificationService
{
    /**
     * Notify every vendor in the order that a customer bought their products.
     */
    public function notifyVendorsNewOrder(Order $order, User $customer): void
    {
        $items = $order->items()->with('vendor.user')->get();

        foreach ($items->groupBy('vendor_id') as $vendorItems) {
            $vendor = $vendorItems->first()->vendor;
            $vendorUser = $vendor?->user;

            if (! $vendor || ! $vendorUser || (int) $vendorUser->id === (int) $customer->id) {
                continue;
            }

            if (! $this->vendorWantsOrderAlerts($vendor)) {
                continue;
            }

            $this->safeNotify($vendorUser, new NewOrderReceivedNotification(
                orderId: $order->id,
                orderNumber: $order->order_number,
                vendorId: $vendor->id,
                stallName: $vendor->stall_name,
                customerName: $customer->name,
                amount: $this->itemsTotal($vendorItems),
                itemsCount: $vendorItems->count(),
                paymentMethod: $order->payment_method,
            ));
        }
    }

    /**
     * Notify vendors when a customer submits GCash/Maya payment proof.
     *
     * @param  Collection<int, OrderItem>  $items
     */
    public function notifyVendorsPaymentSubmitted(Order $order, Collection $items, User $customer, string $reference): void
    {
        $items->loadMissing('vendor.user');

        foreach ($items->groupBy('vendor_id') as $vendorItems) {
            $vendor = $vendorItems->first()->vendor;
            $vendorUser = $vendor?->user;

            if (! $vendor || ! $vendorUser || (int) $vendorUser->id === (int) $customer->id) {
                continue;
            }

            if (! $this->vendorWantsOrderAlerts($vendor)) {
                continue;
            }

            $this->safeNotify($vendorUser, new PaymentProofSubmittedNotification(
                orderId: $order->id,
                orderNumber: $order->order_number,
                vendorId: $vendor->id,
                stallName: $vendor->stall_name,
                customerName: $customer->name,
                amount: $this->itemsTotal($vendorItems),
                paymentMethod: $order->payment_method,
                reference: $reference,
            ));
        }
    }

    /**
     * Notify the customer when their payment is verified or rejected.
     *
     * @param  Collection<int, OrderItem>  $items
     */
    public function notifyCustomerPaymentResult(Order $order, Collection $items, bool $approved, string $reference): void
    {
        $customer = $order->user;

        if (! $customer || ! $this->customerWantsOrderAlerts($customer)) {
            return;
        }

        $items->loadMissing('vendor');

        foreach ($items->groupBy('vendor_id') as $vendorItems) {
            $vendor = $vendorItems->first()->vendor;

            if (! $vendor) {
                continue;
            }

            $this->safeNotify($customer, new PaymentStatusUpdatedNotification(
                orderId: $order->id,
                orderNumber: $order->order_number,
                vendorId: $vendor->id,
                stallName: $vendor->stall_name,
                amount: $this->itemsTotal($vendorItems),
                paymentMethod: $order->payment_method,
                reference: $reference,
                approved: $approved,
            ));
        }
    }

    /**
     * Notify the customer when a vendor moves their order to a new status.
     *
     * @param  Collection<int, OrderItem>  $items
     */
    public function notifyCustomerOrderStatus(Order $order, Vendor $vendor, Collection $items, string $status): void
    {
        $customer = $order->user;

        if (! $customer || (int) $customer->id === (int) $vendor->user_id) {
            return;
        }

        if (! $this->customerWantsOrderAlerts($customer)) {
            return;
        }

        $this->safeNotify($customer, new OrderStatusUpdatedNotification(
            orderId: $order->id,
            orderNumber: $order->order_number,
            vendorId: $vendor->id,
            stallName: $vendor->stall_name,
            amount: $this->itemsTotal($items),
            status: $status,
        ));
    }

    /**
     * @param  Collection<int, OrderItem>  $items
     */
    private function itemsTotal(Collection $items): float
    {
        return round((float) $items->sum(fn ($item) => (float) $item->subtotal), 2);
    }

    private function vendorWantsOrderAlerts(Vendor $vendor): bool
    {
        return (bool) ($vendor->notification_preferences['order_alerts'] ?? true);
    }

    private function customerWantsOrderAlerts(User $user): bool
    {
        return (bool) ($user->notification_preferences['order_alerts'] ?? true);
    }

    private function safeNotify(User $user, Notification $notification): void
    {
        try {
            $user->notify($notification);
        } catch (Throwable $e) {
            Log::warning('Failed to send order notification.', [
                'user_id' => $user->id,
                'notification' => $notification::class,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
