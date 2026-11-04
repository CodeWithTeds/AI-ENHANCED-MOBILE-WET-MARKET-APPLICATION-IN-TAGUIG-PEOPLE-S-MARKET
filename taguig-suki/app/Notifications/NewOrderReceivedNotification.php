<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class NewOrderReceivedNotification extends Notification
{
    public function __construct(
        protected int $orderId,
        protected string $orderNumber,
        protected int $vendorId,
        protected string $stallName,
        protected string $customerName,
        protected float $amount,
        protected int $itemsCount,
        protected string $paymentMethod,
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $amount = number_format($this->amount, 2);
        $paymentMethod = strtoupper($this->paymentMethod);

        return [
            'category' => 'order_placed',
            'title' => 'New order received',
            'message' => "{$this->customerName} placed Order #{$this->orderNumber} — ₱{$amount} for {$this->itemsCount} item(s) via {$paymentMethod}.",
            'order_id' => $this->orderId,
            'order_number' => $this->orderNumber,
            'vendor_id' => $this->vendorId,
            'stall_name' => $this->stallName,
            'customer_name' => $this->customerName,
            'amount' => $this->amount,
            'items_count' => $this->itemsCount,
            'payment_method' => $this->paymentMethod,
        ];
    }
}
