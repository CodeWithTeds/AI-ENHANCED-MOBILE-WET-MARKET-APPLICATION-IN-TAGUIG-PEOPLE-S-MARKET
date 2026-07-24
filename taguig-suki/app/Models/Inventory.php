<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Inventory extends Model
{
    protected $fillable = [
        'product_id',
        'vendor_id',
        'stock_quantity',
        'reorder_level',
        'max_stock_level',
        'cost_price',
        'selling_price',
        'markup_percentage',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'stock_quantity' => 'integer',
            'reorder_level' => 'integer',
            'max_stock_level' => 'integer',
            'cost_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'markup_percentage' => 'decimal:2',
        ];
    }

    /* ─── Relationships ─── */

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(InventoryLog::class);
    }

    /* ─── Computed Properties ─── */

    /**
     * Profit margin per unit.
     */
    public function getProfitPerUnitAttribute(): ?float
    {
        if (!$this->cost_price || $this->cost_price == 0) {
            return null;
        }

        return (float) $this->selling_price - (float) $this->cost_price;
    }

    /**
     * Total inventory value at cost.
     */
    public function getInventoryValueAttribute(): ?float
    {
        if (!$this->cost_price) {
            return null;
        }

        return (float) $this->cost_price * $this->stock_quantity;
    }

    /* ─── Stock Status Helpers ─── */

    public function isLowStock(): bool
    {
        return $this->stock_quantity > 0 && $this->stock_quantity <= $this->reorder_level;
    }

    public function isOutOfStock(): bool
    {
        return $this->stock_quantity === 0;
    }

    public function needsRestock(): bool
    {
        return $this->stock_quantity <= $this->reorder_level;
    }

    /* ─── Scopes ─── */

    public function scopeForVendor($query, int $vendorId)
    {
        return $query->where('vendor_id', $vendorId);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeLowStock($query)
    {
        return $query->whereColumn('stock_quantity', '<=', 'reorder_level')
            ->where('stock_quantity', '>', 0);
    }

    public function scopeOutOfStock($query)
    {
        return $query->where('stock_quantity', 0);
    }
}
