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
}
