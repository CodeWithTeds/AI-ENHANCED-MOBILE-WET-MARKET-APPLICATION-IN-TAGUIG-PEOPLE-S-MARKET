<?php

namespace App\Models;

use App\Enums\VendorStatus;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    protected $fillable = [
        'user_id',
        'stall_name',
        'stall_location',
        'opening_time',
        'closing_time',
        'gcash_number',
        'gcash_qr_path',
        'maya_number',
        'maya_qr_path',
        'product_categories',
        'status',
        'rejection_reason',
        'approved_at',
        'notification_preferences',
    ];

    protected $attributes = [
        'opening_time' => '04:00',
        'closing_time' => '20:00',
    ];

    protected $appends = [
        'operating_hours',
        'is_open',
    ];

    protected function casts(): array
    {
        return [
            'product_categories' => 'array',
            'notification_preferences' => 'array',
            'approved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(VendorDocument::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(OrderConversation::class);
    }

    public function isApproved(): bool
    {
        return $this->status === VendorStatus::Approved->value;
    }

    public function isPending(): bool
    {
        return $this->status === VendorStatus::Pending->value;
    }

    /**
     * Return public URL for GCash QR if set.
     */
    public function gcashQrUrl(): ?string
    {
        return $this->gcash_qr_path ? asset('storage/'.$this->gcash_qr_path) : null;
    }

    /**
     * Return public URL for Maya QR if set.
     */
    public function mayaQrUrl(): ?string
    {
        return $this->maya_qr_path ? asset('storage/'.$this->maya_qr_path) : null;
    }

    /**
     * Whether vendor has any e-wallet configured.
     */
    public function hasEwalletConfigured(): bool
    {
        return !empty($this->gcash_number) || !empty($this->gcash_qr_path) || !empty($this->maya_number) || !empty($this->maya_qr_path);
    }

    /**
     * Formatted store operating hours (e.g. "4:00 AM - 8:00 PM").
     */
    public function getOperatingHoursAttribute(): string
    {
        $open = Carbon::createFromTimeString($this->opening_time ?: '04:00', 'Asia/Manila')->format('g:i A');
        $close = Carbon::createFromTimeString($this->closing_time ?: '20:00', 'Asia/Manila')->format('g:i A');

        return "{$open} - {$close}";
    }

    /**
     * Check if the vendor store is currently open based on Manila time.
     */
    public function isOpen(): bool
    {
        $now = Carbon::now('Asia/Manila');
        $open = Carbon::createFromTimeString($this->opening_time ?: '04:00', 'Asia/Manila');
        $close = Carbon::createFromTimeString($this->closing_time ?: '20:00', 'Asia/Manila');

        return $now->between($open, $close);
    }

    /**
     * Store availability status attribute.
     */
    public function getIsOpenAttribute(): bool
    {
        return $this->isOpen();
    }
}
