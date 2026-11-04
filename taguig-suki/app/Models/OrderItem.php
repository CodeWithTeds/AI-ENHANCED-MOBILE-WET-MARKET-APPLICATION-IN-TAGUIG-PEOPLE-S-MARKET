<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'vendor_id',
        'product_name',
        'category',
        'unit',
        'quantity',
        'unit_price',
        'subtotal',
        'status',
        'confirmation_status',
        'payment_status',
        'payment_reference_number',
        'payment_submitted_at',
        'payment_verified_at',
        'payment_verified_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity'             => 'decimal:2',
            'unit_price'           => 'decimal:2',
            'subtotal'             => 'decimal:2',
            'payment_submitted_at' => 'datetime',
            'payment_verified_at'  => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function paymentVerifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'payment_verified_by');
    }
}
