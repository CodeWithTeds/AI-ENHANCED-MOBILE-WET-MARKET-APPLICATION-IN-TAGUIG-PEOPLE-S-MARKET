<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryLog extends Model
{
    protected $fillable = [
        'inventory_id',
        'vendor_id',
        'product_id',
        'type',
        'quantity_before',
        'quantity_change',
        'quantity_after',
        'reason',
        'reference_number',
        'unit_cost',
        'performed_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity_before' => 'integer',
            'quantity_change' => 'integer',
            'quantity_after' => 'integer',
            'unit_cost' => 'decimal:2',
        ];
    }

    /* ─── Relationships ─── */

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /* ─── Helpers ─── */

    public function isStockIn(): bool
    {
        return $this->quantity_change > 0;
    }

    public function isStockOut(): bool
    {
        return $this->quantity_change < 0;
    }

    /**
     * Get the Filipino-friendly label for the log type.
     */
    public function getTypeLabelAttribute(): string
    {
        return match ($this->type) {
            'restock' => 'Restock (Bagong Dating)',
            'sold' => 'Sold (Nabenta)',
            'returned' => 'Returned (Binalik)',
            'spoiled' => 'Spoiled (Nasira)',
            'adjustment' => 'Adjustment',
            'reserved' => 'Reserved (Naka-reserve)',
            'unreserved' => 'Released',
            'transferred' => 'Transferred (Inilipat)',
            'initial' => 'Initial Stock',
            default => ucfirst($this->type),
        };
    }

    /* ─── Scopes ─── */

    public function scopeForVendor($query, int $vendorId)
    {
        return $query->where('vendor_id', $vendorId);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeRecent($query, int $days = 7)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }
}
