<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RegistrationRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $reason,
        protected string $rejectedByType = 'user',
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
        $typeLabel = $this->rejectedByType === 'vendor' ? 'Vendor' : 'Customer';

        return (new MailMessage)
            ->subject('TaguigSuki — Your Registration Has Been Rejected')
            ->greeting('Hello ' . ($notifiable->name ?? 'User') . ',')
            ->line("We regret to inform you that your {$typeLabel} registration on TaguigSuki has been rejected by the administrator.")
            ->line('**Reason for rejection:**')
            ->line($this->reason)
            ->line('This email address can no longer be used to create a new account on TaguigSuki.')
            ->line('If you believe this was a mistake, please contact the market administration office.')
            ->salutation('Regards, TaguigSuki Admin Team');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'registration_rejected',
            'rejected_by_type' => $this->rejectedByType,
            'reason' => $this->reason,
            'message' => 'Your registration has been rejected. Reason: ' . $this->reason,
        ];
    }
}
