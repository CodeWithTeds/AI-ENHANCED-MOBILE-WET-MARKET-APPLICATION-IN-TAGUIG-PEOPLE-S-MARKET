<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RejectedEmail extends Model
{
    protected $fillable = [
        'email',
        'reason',
        'rejected_by_type',
        'rejected_by_admin_id',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by_admin_id');
    }

    /**
     * Check if an email is blocked from registration.
     */
    public static function isBlocked(string $email): bool
    {
        return static::where('email', strtolower($email))->exists();
    }

    /**
     * Get the admin-provided reason an email was blocked, if any.
     */
    public static function reasonFor(string $email): ?string
    {
        $reason = static::where('email', strtolower($email))->value('reason');

        return is_string($reason) && $reason !== '' ? $reason : null;
    }

    /**
     * Build the user-facing message for a blocked email, including the reason.
     */
    public static function blockedMessage(string $email): string
    {
        $reason = static::reasonFor($email);

        return 'This email address has been blocked from registration.'
            . ($reason ? " Reason: {$reason}" : '')
            . ' Please contact the market administration office.';
    }
}
