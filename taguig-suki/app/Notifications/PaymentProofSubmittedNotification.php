<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class PaymentProofSubmittedNotification extends Notification
{
    public function __construct(
        protected int $orderId,
        protected string $orderNumber,
        protected int $vendorId,
        protected string $stallName,
        protected string $customerName,
        protected float $amount,
        protected string $paymentMethod,
        protected string $reference,
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
            'category' => 'payment_submitted',
            'title' => 'Payment proof submitted',
            'message' => "{$this->customerName} submitted a {$paymentMethod} payment of ₱{$amount} for Order #{$this->orderNumber} (Ref: {$this->reference}). Please verify the payment.",
            'order_id' => $this->orderId,
            'order_number' => $this->orderNumber,
            'vendor_id' => $this->vendorId,
            'stall_name' => $this->stallName,
            'customer_name' => $this->customerName,
            'amount' => $this->amount,
            'payment_method' => $this->paymentMethod,
            'payment_reference_number' => $this->reference,
        ];
    }
}
