<?php

namespace App\Notifications;

use App\Models\StallRentalPayment;
use Illuminate\Notifications\Notification;

class RentalBillGeneratedNotification extends Notification
{
    public function __construct(
        protected StallRentalPayment $rental
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
        $stallLabel = $stall?->stall_number ? "for {$stall->stall_number}" : '';
        $amountFormatted = number_format((float) $this->rental->amount, 2);
        $dueDateFormatted = $this->rental->due_date
            ? date('M d, Y', strtotime((string) $this->rental->due_date))
            : 'the due date';

        return [
            'category' => 'rental_bill_generated',
            'title' => "Monthly Stall Rent Due ({$this->rental->billing_period})",
            'message' => "A stall rental bill of ₱{$amountFormatted} {$stallLabel} has been generated for period {$this->rental->billing_period}. Payment is due on {$dueDateFormatted}. Please settle your outstanding payment.",
            'rental_id' => $this->rental->id,
            'vendor_id' => $this->rental->vendor_id,
            'stall_id' => $this->rental->stall_id,
            'stall_number' => $stall?->stall_number,
            'stall_name' => $vendor?->stall_name,
            'billing_period' => $this->rental->billing_period,
            'amount' => (float) $this->rental->amount,
            'due_date' => (string) $this->rental->due_date,
            'status' => $this->rental->status,
        ];
    }
}
