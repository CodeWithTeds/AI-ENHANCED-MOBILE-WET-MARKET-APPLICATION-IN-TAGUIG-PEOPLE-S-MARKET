<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountApprovedNotification extends Notification
{
    public function __construct(
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
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $isVendor = $this->accountType === 'vendor';
        $typeLabel = $isVendor ? 'Vendor' : 'Customer';

        $mail = (new MailMessage)
            ->subject("TaguigSuki — Your {$typeLabel} Account Has Been Approved")
            ->greeting('Hello '.($notifiable->name ?? 'User').',')
            ->line("Good news! Your {$typeLabel} account ({$notifiable->email}) on TaguigSuki has been approved by the administrator.");

        if ($isVendor && $this->stallName) {
            $mail->line("Your stall \"{$this->stallName}\" is now verified and active on Taguig People's Market.");
        }

        return $mail
            ->line('You can now sign in to the TaguigSuki app using your registered email address and password.')
            ->salutation('Regards, TaguigSuki Admin Team');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $isVendor = $this->accountType === 'vendor';
        $typeLabel = $isVendor ? 'Vendor' : 'Customer';

        return [
            'category' => 'account_approved',
            'account_type' => $this->accountType,
            'stall_name' => $this->stallName,
            'title' => "{$typeLabel} Account Approved",
            'message' => $isVendor && $this->stallName
                ? "Your vendor account for stall \"{$this->stallName}\" has been approved. You may now sign in."
                : 'Your customer account has been approved by the administrator. You may now sign in.',
        ];
    }
}
