<?php

namespace App\Models;

use App\Enums\VendorStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    protected $fillable = [
        'user_id',
        'stall_name',
        'stall_location',
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
}
