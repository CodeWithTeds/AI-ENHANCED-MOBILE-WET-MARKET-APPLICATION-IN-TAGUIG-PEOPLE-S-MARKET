<?php

namespace App\Notifications;

use App\Models\Vendor;
use Illuminate\Notifications\Notification;

class ContractExpiringNotification extends Notification
{
    public function __construct(
        protected Vendor $vendor
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $stallName = $this->vendor->stall_name;
        $endDate = $this->vendor->contract_end_date
            ? date('M d, Y', strtotime((string) $this->vendor->contract_end_date))
            : 'soon';

        $today = now()->startOfDay();
        $daysRemaining = $this->vendor->contract_end_date
            ? (int) $today->diffInDays(\Carbon\Carbon::parse($this->vendor->contract_end_date)->startOfDay(), false)
            : 0;

        return [
            'category' => 'contract_expiring',
            'title' => 'Stall Lease Contract Expiring Soon',
            'message' => "Your stall lease contract for {$stallName} expires on {$endDate}. You may now submit a Contract Renewal (1, 3, 6, or 12 months) or Contract Cancellation request for administrative review.",
            'vendor_id' => $this->vendor->id,
            'stall_name' => $stallName,
            'stall_location' => $this->vendor->stall_location,
            'contract_end_date' => $this->vendor->contract_end_date ? \Carbon\Carbon::parse($this->vendor->contract_end_date)->toDateString() : null,
            'contract_status' => $this->vendor->contract_status,
            'days_remaining' => $daysRemaining,
            'action_url' => '/(vendor)/profile',
        ];
    }
}
