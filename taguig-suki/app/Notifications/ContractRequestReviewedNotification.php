<?php

namespace App\Notifications;

use App\Models\VendorContractRequest;
use Illuminate\Notifications\Notification;

class ContractRequestReviewedNotification extends Notification
{
    public function __construct(
        protected VendorContractRequest $contractRequest
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $vendor = $this->contractRequest->vendor;
        $stallName = $vendor?->stall_name ?? 'Your stall';
        $type = $this->contractRequest->type; // 'renewal' or 'cancellation'
        $status = $this->contractRequest->status; // 'approved' or 'rejected'
        $isRenewal = $type === 'renewal';
        $isApproved = $status === 'approved';

        if ($isRenewal && $isApproved) {
            $category = 'contract_approved';
            $duration = $this->contractRequest->requested_duration_months;
            $newEnd = $vendor?->contract_end_date ? date('M d, Y', strtotime((string) $vendor->contract_end_date)) : 'updated';
            $title = 'Contract Renewal Approved!';
            $message = "Your request to renew the lease contract for {$stallName} ({$duration} month" . ($duration > 1 ? 's' : '') . ") has been APPROVED by market administration. Your new contract end date is {$newEnd}." . ($this->contractRequest->admin_notes ? " Admin Notes: {$this->contractRequest->admin_notes}" : '');
        } elseif (!$isRenewal && $isApproved) {
            $category = 'contract_approved';
            $title = 'Contract Cancellation Approved';
            $message = "Your request to cancel the lease contract for {$stallName} has been APPROVED by market administration. Your stall lease has been officially concluded." . ($this->contractRequest->admin_notes ? " Admin Notes: {$this->contractRequest->admin_notes}" : '');
        } elseif ($isRenewal && !$isApproved) {
            $category = 'contract_rejected';
            $title = 'Contract Renewal Request Rejected';
            $reasonText = $this->contractRequest->admin_notes ? " Reason: {$this->contractRequest->admin_notes}" : ' Please visit the market administration office for more details.';
            $message = "Your request to renew the lease contract for {$stallName} was NOT approved by market administration.{$reasonText}";
        } else {
            $category = 'contract_rejected';
            $title = 'Contract Cancellation Request Rejected';
            $reasonText = $this->contractRequest->admin_notes ? " Reason: {$this->contractRequest->admin_notes}" : ' Please settle any outstanding obligations or consult the market office.';
            $message = "Your request to cancel the lease contract for {$stallName} was NOT approved by market administration.{$reasonText}";
        }

        return [
            'category' => $category,
            'title' => $title,
            'message' => $message,
            'request_id' => $this->contractRequest->id,
            'type' => $type,
            'status' => $status,
            'requested_duration_months' => $this->contractRequest->requested_duration_months,
            'vendor_id' => $vendor?->id,
            'stall_name' => $stallName,
            'contract_status' => $vendor?->contract_status,
            'contract_end_date' => $vendor?->contract_end_date ? \Carbon\Carbon::parse($vendor->contract_end_date)->toDateString() : null,
            'admin_notes' => $this->contractRequest->admin_notes,
            'reviewed_at' => (string) $this->contractRequest->reviewed_at,
        ];
    }
}
