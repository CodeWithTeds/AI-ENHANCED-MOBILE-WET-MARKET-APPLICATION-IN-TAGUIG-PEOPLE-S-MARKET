<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'user_id',
        'order_number',
        'status',
        'confirmation_status',
        'confirmed_at',
        'confirmed_by',
        'total_amount',
        'payment_method',
        'payment_reference_number',
        'payment_status',
        'payment_submitted_at',
        'payment_verified_at',
        'payment_verified_by',
        'notes',
    ];

    protected $appends = [
        'vendor_portions',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'payment_submitted_at' => 'datetime',
            'payment_verified_at' => 'datetime',
            'confirmed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'payment_verified_by');
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(OrderConversation::class);
    }

    /**
     * Compute per-vendor order portions with subtotal, fulfillment status, and payment status.
     */
    public function getVendorPortionsAttribute(): array
    {
        if (!$this->relationLoaded('items')) {
            return [];
        }

        $grouped = $this->items->groupBy('vendor_id');

        return $grouped->map(function ($items, $vendorId) {
            $vendor = $items->first()->vendor;
            $firstItem = $items->first();
            $subtotal = round((float) $items->sum('subtotal'), 2);

            $host = null;
            try {
                $host = request()->getSchemeAndHttpHost();
            } catch (\Throwable $e) {}

            $gcashUrl = null;
            if ($vendor?->gcash_qr_path) {
                $gcashUrl = $host ? rtrim($host, '/') . '/storage/' . ltrim($vendor->gcash_qr_path, '/') : asset('storage/' . $vendor->gcash_qr_path);
            }
            $mayaUrl = null;
            if ($vendor?->maya_qr_path) {
                $mayaUrl = $host ? rtrim($host, '/') . '/storage/' . ltrim($vendor->maya_qr_path, '/') : asset('storage/' . $vendor->maya_qr_path);
            }

            return [
                'vendor_id' => (int) $vendorId,
                'stall_name' => $vendor?->stall_name ?? "Stall #{$vendorId}",
                'stall_location' => $vendor?->stall_location,
                'subtotal' => $subtotal,
                'status' => $firstItem->status ?? $this->status,
                'confirmation_status' => $firstItem->confirmation_status ?? $this->confirmation_status ?? 'not_required',
                'payment_status' => $firstItem->payment_status ?? $this->payment_status ?? 'unpaid',
                'payment_reference_number' => $firstItem->payment_reference_number ?? $this->payment_reference_number,
                'payment_submitted_at' => $firstItem->payment_submitted_at?->toISOString() ?? $this->payment_submitted_at?->toISOString(),
                'payment_verified_at' => $firstItem->payment_verified_at?->toISOString() ?? $this->payment_verified_at?->toISOString(),
                'gcash_number' => $vendor?->gcash_number,
                'gcash_qr_url' => $gcashUrl,
                'maya_number' => $vendor?->maya_number,
                'maya_qr_url' => $mayaUrl,
                'has_gcash' => !empty($vendor?->gcash_number) || !empty($vendor?->gcash_qr_path),
                'has_maya' => !empty($vendor?->maya_number) || !empty($vendor?->maya_qr_path),
                'items' => $items->values()->all(),
            ];
        })->values()->all();
    }

    /**
     * Generate a unique, human-readable order number.
     */
    public static function generateOrderNumber(): string
    {
        $date = now()->format('Ymd');
        $last = static::whereDate('created_at', today())->count() + 1;

        return 'ORD-'.$date.'-'.str_pad($last, 4, '0', STR_PAD_LEFT);
    }
}
