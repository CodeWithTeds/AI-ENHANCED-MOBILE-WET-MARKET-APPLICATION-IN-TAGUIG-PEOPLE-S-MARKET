<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class OrderCancelledNotification extends Notification
{
    public function __construct(
        protected int $orderId,
        protected string $orderNumber,
        protected int $vendorId,
        protected string $stallName,
        protected float $amount,
        protected string $cancelledBy,
        protected ?string $reason = null,
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

        $title = match ($this->cancelledBy) {
            'system' => 'Order automatically cancelled',
            'vendor' => 'Order cancelled by vendor',
            default => 'Order cancelled by customer',
        };

        $reasonSuffix = $this->reason ? " Reason: {$this->reason}" : '';
        $message = match ($this->cancelledBy) {
            'system' => "Order #{$this->orderNumber} for {$this->stallName} (₱{$amount}) was automatically cancelled after 1 hour without confirmation. Stock has been restored.",
            'vendor' => "{$this->stallName} cancelled Order #{$this->orderNumber} (₱{$amount}).{$reasonSuffix}",
            default => "Customer cancelled Order #{$this->orderNumber} for {$this->stallName} (₱{$amount}). Stock has been restored.{$reasonSuffix}",
        };

        return [
            'category' => 'order_cancelled',
            'title' => $title,
            'message' => $message,
            'order_id' => $this->orderId,
            'order_number' => $this->orderNumber,
            'vendor_id' => $this->vendorId,
            'stall_name' => $this->stallName,
            'amount' => $this->amount,
            'cancelled_by' => $this->cancelledBy,
            'reason' => $this->reason,
        ];
    }
}
