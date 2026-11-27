<?php

namespace App\Services;

use App\Enums\VendorStatus;
use App\Models\CustomerVerification;
use App\Models\User;
use App\Models\Vendor;
use App\Notifications\AccountApprovalRequestedNotification;
use App\Notifications\AccountApprovedNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class AdminNotificationService
{
    /**
     * Notify all active administrators when a customer or vendor requests account approval.
     */
    public function notifyAccountApprovalRequested(User $applicant, string $accountType, ?string $stallName = null): void
    {
        try {
            $admins = User::where('is_admin', true)->active()->get();

            if ($admins->isEmpty()) {
                return;
            }

            Notification::send(
                $admins,
                new AccountApprovalRequestedNotification($applicant, $accountType, $stallName)
            );
        } catch (\Throwable $e) {
            Log::warning('[AdminNotificationService] Failed to notify admins of approval request', [
                'applicant_user_id' => $applicant->id,
                'account_type' => $accountType,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Mark unread account approval request notifications as read once an applicant is reviewed.
     */
    public function markApprovalRequestsReadForApplicant(int $applicantUserId, ?string $accountType = null): void
    {
        try {
            DatabaseNotification::query()
                ->whereNull('read_at')
                ->where('type', AccountApprovalRequestedNotification::class)
                ->get()
                ->each(function (DatabaseNotification $notification) use ($applicantUserId, $accountType): void {
                    $data = $notification->data ?? [];
                    $matchesUser = (int) ($data['applicant_user_id'] ?? 0) === $applicantUserId;
                    $matchesType = $accountType === null || ($data['account_type'] ?? null) === $accountType;

                    if ($matchesUser && $matchesType) {
                        $notification->markAsRead();
                    }
                });
        } catch (\Throwable) {
            // Never block approval/rejection if clearing read flags fails
        }
    }

    /**
     * Retrieve recent notifications and pending approval counts for an admin user.
     *
     * @return array<string, mixed>
     */
    public function getForAdmin(User $admin, int $limit = 20): array
    {
        $items = $admin->notifications()
            ->latest()
            ->limit($limit)
            ->get()
            ->map(function (DatabaseNotification $notification): array {
                $data = $notification->data ?? [];

                return [
                    'id' => $notification->id,
                    'category' => $data['category'] ?? $notification->type,
                    'account_type' => $data['account_type'] ?? null,
                    'applicant_user_id' => $data['applicant_user_id'] ?? null,
                    'applicant_name' => $data['applicant_name'] ?? null,
                    'applicant_email' => $data['applicant_email'] ?? null,
                    'stall_name' => $data['stall_name'] ?? null,
                    'title' => $data['title'] ?? 'Notification',
                    'message' => $data['message'] ?? '',
                    'action_url' => $data['action_url'] ?? '/admin/dashboard',
                    'is_read' => $notification->read_at !== null,
                    'read_at' => $notification->read_at?->toIso8601String(),
                    'time_ago' => $notification->created_at?->diffForHumans() ?? 'just now',
                    'created_at' => $notification->created_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();

        return [
            'unread_count' => $admin->unreadNotifications()->count(),
            'pending_customers_count' => CustomerVerification::where('status', CustomerVerification::STATUS_PENDING)->count(),
            'pending_vendors_count' => Vendor::where('status', VendorStatus::Pending->value)->count(),
            'items' => $items,
        ];
    }

    /**
     * Mark a single notification as read for the admin.
     *
     * @return array<string, mixed>
     */
    public function markAsRead(User $admin, string $notificationId): array
    {
        $notification = $admin->notifications()->whereKey($notificationId)->firstOrFail();
        $notification->markAsRead();

        return $this->getForAdmin($admin);
    }

    /**
     * Mark all unread notifications as read for the admin.
     *
     * @return array<string, mixed>
     */
    public function markAllAsRead(User $admin): array
    {
        $admin->unreadNotifications()->update(['read_at' => now()]);

        return $this->getForAdmin($admin);
    }

    /**
     * Clear pending admin approval alerts and notify an approved customer or vendor via database and email.
     *
     * @return array{email_sent: bool, warning: ?string}
     */
    public function notifyAccountApproved(User $user, string $accountType, ?string $stallName = null): array
    {
        $this->markApprovalRequestsReadForApplicant($user->id, $accountType);

        if (! $user->email) {
            return [
                'email_sent' => false,
                'warning' => 'Account approved, but this user has no email address configured.',
            ];
        }

        $mailer = (string) config('mail.default', 'log');
        $host = (string) config("mail.mailers.{$mailer}.host", '');
        $port = (string) config("mail.mailers.{$mailer}.port", '');
        $endpoint = $host !== '' ? " ({$host}".($port !== '' ? ":{$port}" : '').')' : '';

        try {
            $user->notify(new AccountApprovedNotification($accountType, $stallName));
        } catch (\Throwable $e) {
            Log::warning('[AdminNotificationService] Failed to send approval notification email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'account_type' => $accountType,
                'mailer' => $mailer,
                'host' => $host,
                'port' => $port,
                'error' => $e->getMessage(),
            ]);

            return [
                'email_sent' => false,
                'warning' => "Account approved, but SMTP/email via \"{$mailer}\"{$endpoint} to {$user->email} failed: {$e->getMessage()}",
            ];
        }

        if ($mailer === 'log') {
            Log::warning('[AdminNotificationService] Approval email written to log only because MAIL_MAILER=log', [
                'user_id' => $user->id,
                'email' => $user->email,
                'account_type' => $accountType,
            ]);

            return [
                'email_sent' => false,
                'warning' => "Account approved, but MAIL_MAILER is set to \"log\" on this server so no email was sent to {$user->email}. Add MAIL_MAILER=smtp, MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS in Railway Variables.",
            ];
        }

        return [
            'email_sent' => true,
            'warning' => null,
        ];
    }
}
