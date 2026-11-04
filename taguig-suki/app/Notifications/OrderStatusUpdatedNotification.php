<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class OrderStatusUpdatedNotification extends Notification
{
    public function __construct(
        protected int $orderId,
        protected string $orderNumber,
        protected int $vendorId,
        protected string $stallName,
        protected float $amount,
        protected string $status,
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

        [$title, $message] = match ($this->status) {
            'confirmed' => [
                'Order confirmed',
                "{$this->stallName} confirmed your Order #{$this->orderNumber} worth ₱{$amount}.",
            ],
            'ready' => [
                'Order ready for pickup',
                "Your Order #{$this->orderNumber} from {$this->stallName} (₱{$amount}) is ready for pickup.",
            ],
            'completed' => [
                'Order completed',
                "Your Order #{$this->orderNumber} from {$this->stallName} (₱{$amount}) has been completed. Thank you!",
            ],
            'cancelled' => [
                'Order cancelled',
                "Your Order #{$this->orderNumber} from {$this->stallName} (₱{$amount}) has been cancelled.",
            ],
            default => [
                'Order updated',
                "Your Order #{$this->orderNumber} from {$this->stallName} was updated to {$this->status}.",
            ],
        };

        return [
            'category' => 'order_status',
            'title' => $title,
            'message' => $message,
            'order_id' => $this->orderId,
            'order_number' => $this->orderNumber,
            'vendor_id' => $this->vendorId,
            'stall_name' => $this->stallName,
            'amount' => $this->amount,
            'status' => $this->status,
        ];
    }
}
