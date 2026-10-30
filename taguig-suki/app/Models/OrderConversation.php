<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderConversation extends Model
{
    protected $fillable = [
        'order_id',
        'vendor_id',
        'customer_id',
        'confirmation_status',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OrderMessage::class, 'order_conversation_id')->orderBy('created_at', 'asc');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(OrderMessage::class, 'order_conversation_id')->latestOfMany();
    }

    /**
     * Determine if a given user is authorized to participate in or view this conversation.
     * Authorized if:
     *  - The customer who placed the order
     *  - The vendor whose items are in this order
     *  - An admin user
     */
    public function isAuthorized(User $user): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ((int) $this->customer_id === (int) $user->id) {
            return true;
        }

        $userVendor = $user->vendor;
        if ($userVendor && (int) $userVendor->id === (int) $this->vendor_id) {
            return true;
        }

        return false;
    }

    /**
     * Mark unread messages sent by the counterparty as read.
     */
    public function markAsReadFor(User $user): int
    {
        return $this->messages()
            ->where('sender_id', '!=', $user->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
    }

    /**
     * Count unread messages for a given user.
     */
    public function unreadCountFor(User $user): int
    {
        return $this->messages()
            ->where('sender_id', '!=', $user->id)
            ->where('is_read', false)
            ->count();
    }
}
