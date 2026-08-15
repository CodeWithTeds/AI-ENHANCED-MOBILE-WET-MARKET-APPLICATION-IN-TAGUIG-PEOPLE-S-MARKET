<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecipeRecommendation extends Model
{
    use HasFactory;

    public const STATUS_FOUND = 'found';

    public const STATUS_NOT_FOUND = 'not_found';

    public const STATUS_ERROR = 'error';

    protected $fillable = [
        'user_id',
        'query',
        'recipe_name',
        'status',
        'payload',
        'matching_products',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'matching_products' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Customer reviews for this recipe — keyed by the dish name, not the log row.
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class, 'recipe_name', 'recipe_name');
    }
}
