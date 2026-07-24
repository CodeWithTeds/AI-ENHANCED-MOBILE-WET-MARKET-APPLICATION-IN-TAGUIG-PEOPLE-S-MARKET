<?php

namespace App\Enums;

enum StockAdjustmentType: string
{
    case Restock = 'restock';
    case Sold = 'sold';
    case Spoiled = 'spoiled';
    case Adjustment = 'adjustment';

    public function label(): string
    {
        return match ($this) {
            self::Restock => 'Restock (Bagong Dating)',
            self::Sold => 'Sold (Nabenta)',
            self::Spoiled => 'Spoiled (Nasira)',
            self::Adjustment => 'Adjustment',
        };
    }

    public function isOutgoing(): bool
    {
        return in_array($this, [self::Sold, self::Spoiled]);
    }

    public function isIncoming(): bool
    {
        return $this === self::Restock;
    }
}
