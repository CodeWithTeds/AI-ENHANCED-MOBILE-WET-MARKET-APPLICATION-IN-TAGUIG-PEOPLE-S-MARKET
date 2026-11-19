<?php

namespace App\Notifications;

use App\Models\Vendor;
use Illuminate\Notifications\Notification;

class ContractExpiredNotification extends Notification
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
            : 'recently';

        return [
            'category' => 'contract_expired',
            'title' => 'Stall Lease Contract Expired',
            'message' => "Your stall lease contract for {$stallName} expired on {$endDate}. Please submit a Contract Renewal (1, 3, 6, or 12 months) or Contract Cancellation request to update your stall status.",
            'vendor_id' => $this->vendor->id,
            'stall_name' => $stallName,
            'stall_location' => $this->vendor->stall_location,
            'contract_end_date' => (string) $this->vendor->contract_end_date,
            'contract_status' => $this->vendor->contract_status,
            'action_url' => '/(vendor)/profile',
        ];
    }
}
