<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
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
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'resolved_at' => 'datetime',
        ];
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
}
