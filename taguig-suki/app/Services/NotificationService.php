<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\StallRentalPayment;
use App\Models\User;
use App\Models\Vendor;
use App\Notifications\NewOrderReceivedNotification;
use App\Notifications\NewReviewReceivedNotification;
use App\Notifications\OrderCancelledNotification;
use App\Notifications\OrderStatusUpdatedNotification;
use App\Notifications\PaymentProofSubmittedNotification;
use App\Notifications\PaymentStatusUpdatedNotification;
use App\Notifications\ProductDeletedNotification;
use App\Notifications\RentalBillGeneratedNotification;
use App\Notifications\RentalPaymentStatusUpdatedNotification;
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
    public function notifyCustomerOrderStatus(Order $order, Vendor $vendor, Collection $items, string $status, ?string $reason = null): void
    {
        $customer = $order->user;

        if (! $customer || (int) $customer->id === (int) $vendor->user_id) {
            return;
        }

        if (! $this->customerWantsOrderAlerts($customer)) {
            return;
        }

        $notification = $status === 'cancelled'
            ? new OrderCancelledNotification(
                orderId: $order->id,
                orderNumber: $order->order_number,
                vendorId: $vendor->id,
                stallName: $vendor->stall_name,
                amount: $this->itemsTotal($items),
                cancelledBy: 'vendor',
                reason: $reason,
            )
            : new OrderStatusUpdatedNotification(
                orderId: $order->id,
                orderNumber: $order->order_number,
                vendorId: $vendor->id,
                stallName: $vendor->stall_name,
                amount: $this->itemsTotal($items),
                status: $status,
            );

        $this->safeNotify($customer, $notification);
    }

    /**
     * Notify each affected vendor when a customer cancels an unconfirmed order.
     *
     * @param  Collection<int, OrderItem>  $items
     */
    public function notifyVendorsOrderCancelled(Order $order, Collection $items, ?string $reason = null): void
    {
        $items->loadMissing('vendor.user');

        foreach ($items->groupBy('vendor_id') as $vendorItems) {
            $vendor = $vendorItems->first()->vendor;
            $vendorUser = $vendor?->user;

            if (! $vendor || ! $vendorUser || (int) $vendorUser->id === (int) $order->user_id) {
                continue;
            }

            if (! $this->vendorWantsOrderAlerts($vendor)) {
                continue;
            }

            $this->safeNotify($vendorUser, new OrderCancelledNotification(
                orderId: $order->id,
                orderNumber: $order->order_number,
                vendorId: $vendor->id,
                stallName: $vendor->stall_name,
                amount: $this->itemsTotal($vendorItems),
                cancelledBy: 'customer',
                reason: $reason,
            ));
        }
    }

    /**
     * Notify both the customer and affected vendors when an order auto-cancels after 1 hour.
     *
     * @param  Collection<int, OrderItem>  $items
     */
    public function notifyOrderAutoCancelled(Order $order, Collection $items, string $reason): void
    {
        $items->loadMissing('vendor.user');
        $customer = $order->user;

        foreach ($items->groupBy('vendor_id') as $vendorItems) {
            $vendor = $vendorItems->first()->vendor;
            if (! $vendor) {
                continue;
            }

            $amount = $this->itemsTotal($vendorItems);
            $notification = new OrderCancelledNotification(
                orderId: $order->id,
                orderNumber: $order->order_number,
                vendorId: $vendor->id,
                stallName: $vendor->stall_name,
                amount: $amount,
                cancelledBy: 'system',
                reason: $reason,
            );

            if ($customer && $this->customerWantsOrderAlerts($customer)) {
                $this->safeNotify($customer, $notification);
            }

            $vendorUser = $vendor->user;
            if ($vendorUser && (int) $vendorUser->id !== (int) $order->user_id && $this->vendorWantsOrderAlerts($vendor)) {
                $this->safeNotify($vendorUser, $notification);
            }
        }
    }

    /**
     * Notify the vendor when a customer rates their stall or one of their products.
     */
    public function notifyVendorNewReview(Review $review): void
    {
        $vendor = null;
        $product = null;

        if ($review->reviewable_type === Vendor::class) {
            $vendor = Vendor::find($review->reviewable_id);
        } elseif ($review->reviewable_type === Product::class) {
            $product = Product::with('vendor')->find($review->reviewable_id);
            $vendor = $product?->vendor;
        }

        $vendorUser = $vendor?->user;
        $customer = $review->user;

        if (! $vendor || ! $vendorUser || ! $customer) {
            return;
        }

        if ((int) $vendorUser->id === (int) $customer->id) {
            return;
        }

        if (! $this->vendorWantsReviewAlerts($vendor)) {
            return;
        }

        $this->safeNotify($vendorUser, new NewReviewReceivedNotification(
            reviewId: $review->id,
            rating: (int) $review->rating,
            comment: $review->comment,
            vendorId: $vendor->id,
            stallName: $vendor->stall_name,
            customerName: $customer->name,
            productId: $product?->id,
            productName: $product?->name,
        ));
    }

    /**
     * Notify the vendor that their product was removed by an administrator, including reason.
     */
    public function notifyVendorProductDeleted(Product $product, Vendor $vendor, string $reason, User $admin): void
    {
        $vendorUser = $vendor->user;

        if (! $vendorUser) {
            return;
        }

        $this->safeNotify($vendorUser, new ProductDeletedNotification(
            productId: (int) $product->id,
            productName: (string) $product->name,
            category: (string) ($product->category ?? 'General'),
            vendorId: (int) $vendor->id,
            stallName: (string) ($vendor->stall_name ?? 'Vendor Stall'),
            reason: $reason,
            adminName: (string) ($admin->name ?? 'Market Administrator'),
        ));
    }

    /**
     * Notify vendor that a monthly stall rental bill has been generated.
     */
    public function notifyVendorRentalBillGenerated(StallRentalPayment $rental): void
    {
        $vendorUser = $rental->vendor?->user;

        if (! $vendorUser) {
            return;
        }

        $this->safeNotify($vendorUser, new RentalBillGeneratedNotification($rental));
    }

    /**
     * Notify vendor that their stall rental payment status has been updated.
     */
    public function notifyVendorRentalPaymentStatusUpdated(StallRentalPayment $rental, string $previousStatus = 'unpaid', ?User $admin = null): void
    {
        $vendorUser = $rental->vendor?->user;

        if (! $vendorUser) {
            return;
        }

        $this->safeNotify($vendorUser, new RentalPaymentStatusUpdatedNotification(
            $rental,
            $previousStatus,
            $admin?->name
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

    private function vendorWantsReviewAlerts(Vendor $vendor): bool
    {
        return (bool) ($vendor->notification_preferences['review_alerts'] ?? true);
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
