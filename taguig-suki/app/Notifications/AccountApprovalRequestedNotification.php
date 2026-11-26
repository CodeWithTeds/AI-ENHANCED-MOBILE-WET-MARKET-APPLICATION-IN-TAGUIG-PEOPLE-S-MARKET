<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Notification;

class AccountApprovalRequestedNotification extends Notification
{
    public function __construct(
        protected User $applicant,
        protected string $accountType = 'customer',
        protected ?string $stallName = null,
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
        $isVendor = $this->accountType === 'vendor';
        $roleLabel = $isVendor ? 'Vendor' : 'Customer';
        $actionUrl = $isVendor
            ? '/admin/dashboard/vendors/pending'
            : '/admin/dashboard/users?verification_status=pending';

        $message = $isVendor && $this->stallName
            ? "{$this->applicant->name} ({$this->applicant->email}) registered stall \"{$this->stallName}\" and requested account approval."
            : "{$this->applicant->name} ({$this->applicant->email}) submitted a {$roleLabel} registration and requested account approval.";

        return [
            'category' => 'account_approval_requested',
            'account_type' => $this->accountType,
            'applicant_user_id' => $this->applicant->id,
            'applicant_name' => $this->applicant->name,
            'applicant_email' => $this->applicant->email,
            'stall_name' => $this->stallName,
            'title' => "New {$roleLabel} Approval Request",
            'message' => $message,
            'action_url' => $actionUrl,
        ];
    }
}
