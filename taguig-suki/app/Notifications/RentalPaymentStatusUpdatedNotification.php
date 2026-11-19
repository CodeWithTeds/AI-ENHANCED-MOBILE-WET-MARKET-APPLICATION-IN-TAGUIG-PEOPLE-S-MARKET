<?php

namespace App\Notifications;

use App\Models\StallRentalPayment;
use Illuminate\Notifications\Notification;

class RentalPaymentStatusUpdatedNotification extends Notification
{
    public function __construct(
        protected StallRentalPayment $rental,
        protected string $previousStatus = 'unpaid',
        protected ?string $adminName = null
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
        $stall = $this->rental->stall;
        $vendor = $this->rental->vendor;
        $amountFormatted = number_format((float) $this->rental->amount, 2);
        $statusUpper = strtoupper($this->rental->status);
        $admin = $this->adminName ?: 'Market Administration';

        $msg = $this->rental->status === 'paid'
            ? "Your stall rental payment of ₱{$amountFormatted} for period {$this->rental->billing_period} has been verified and marked as PAID by {$admin}. Thank you!"
            : "Your stall rental payment status for period {$this->rental->billing_period} has been updated to {$statusUpper} by {$admin}.";

        return [
            'category' => 'rental_payment_updated',
            'title' => "Stall Rental Status Updated: {$statusUpper}",
            'message' => $msg,
            'rental_id' => $this->rental->id,
            'vendor_id' => $this->rental->vendor_id,
            'stall_id' => $this->rental->stall_id,
            'stall_number' => $stall?->stall_number,
            'stall_name' => $vendor?->stall_name,
            'billing_period' => $this->rental->billing_period,
            'amount' => (float) $this->rental->amount,
            'status' => $this->rental->status,
            'payment_method' => $this->rental->payment_method,
            'payment_reference' => $this->rental->payment_reference,
            'paid_at' => $this->rental->paid_at?->toIso8601String(),
            'updated_by' => $admin,
        ];
    }
}
