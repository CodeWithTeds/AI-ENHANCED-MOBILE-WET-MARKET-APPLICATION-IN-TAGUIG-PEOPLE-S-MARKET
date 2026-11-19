<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Review extends Model
{
    protected $fillable = [
        'user_id',
        'order_id',
        'reviewable_type',
        'reviewable_id',
        'recipe_name',
        'rating',
        'comment',
        'status',
        'admin_response',
        'vendor_response',
        'needs_response',
        'resolved_at',
        'vendor_responded_at',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'needs_response' => 'boolean',
            'resolved_at' => 'datetime',
            'vendor_responded_at' => 'datetime',
        ];
    }

    public function hasComment(): bool
    {
        return ! empty(trim((string) ($this->comment ?? '')));
    }

    public function isComplaint(): bool
    {
        if (! $this->hasComment()) {
            return false;
        }

        return $this->rating <= 3 || (bool) preg_match('/(complain|broken|rotten|dirty|bad|smell|spoil|damage|wrong|kulang|panis|sira|mabaho)/i', (string) $this->comment);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * The reviewed entity — a Vendor or a Product.
     * Recipes have no model, so this is null for recipe reviews.
     */
    public function reviewable(): MorphTo
    {
        return $this->morphTo();
    }

    public function images(): HasMany
    {
        return $this->hasMany(ReviewImage::class)->orderBy('order');
    }
}
