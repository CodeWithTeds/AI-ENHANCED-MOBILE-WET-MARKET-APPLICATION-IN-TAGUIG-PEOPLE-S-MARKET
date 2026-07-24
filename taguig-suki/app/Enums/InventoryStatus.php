<?php

namespace App\Enums;

enum InventoryStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Seasonal = 'seasonal';
    case Discontinued = 'discontinued';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Inactive => 'Inactive',
            self::Seasonal => 'Seasonal',
            self::Discontinued => 'Discontinued',
        };
    }
}
