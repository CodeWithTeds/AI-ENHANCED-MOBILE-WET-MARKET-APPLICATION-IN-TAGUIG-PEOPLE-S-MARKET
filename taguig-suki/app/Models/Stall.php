<?php

namespace App\Models;

use App\Enums\StallSize;
use App\Enums\StallStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stall extends Model
{
    use HasFactory;

    protected $fillable = [
        'section_id',
        'section',
        'stall_number',
        'store_name',
        'vendor_id',
        'status',
        'size',
        'monthly_rent',
        'description',
        'is_active',
        'image',
    ];

    protected function casts(): array
    {
        return [
            'status' => StallStatus::class,
            'size' => StallSize::class,
            'monthly_rent' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    public function sectionRelation(): BelongsTo
    {
        return $this->belongsTo(Section::class, 'section_id');
    }
}
