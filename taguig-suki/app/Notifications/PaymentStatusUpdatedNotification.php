<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class PaymentStatusUpdatedNotification extends Notification
{
    public function __construct(
        protected int $orderId,
        protected string $orderNumber,
        protected int $vendorId,
        protected string $stallName,
        protected float $amount,
        protected string $paymentMethod,
        protected string $reference,
        protected bool $approved,
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

        $message = $this->approved
            ? "Your ₱{$amount} {$paymentMethod} payment to {$this->stallName} for Order #{$this->orderNumber} has been verified successfully."
            : "Your ₱{$amount} {$paymentMethod} payment to {$this->stallName} for Order #{$this->orderNumber} was rejected. Please submit a valid reference.";

        return [
            'category' => 'payment_received',
            'title' => $this->approved ? 'Payment successful' : 'Payment proof rejected',
            'message' => $message,
            'order_id' => $this->orderId,
            'order_number' => $this->orderNumber,
            'vendor_id' => $this->vendorId,
            'stall_name' => $this->stallName,
            'amount' => $this->amount,
            'payment_method' => $this->paymentMethod,
            'payment_reference_number' => $this->reference,
            'payment_status' => $this->approved ? 'paid' : 'rejected',
        ];
    }
}
