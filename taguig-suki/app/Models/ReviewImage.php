<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ReviewImage extends Model
{
    protected $fillable = [
        'review_id',
        'path',
        'order',
    ];

    protected $appends = [
        'url',
    ];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
        ];
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class);
    }
}
