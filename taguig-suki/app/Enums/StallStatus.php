<?php

namespace App\Enums;

enum StallStatus: string
{
    case Occupied = 'occupied';
    case Vacant = 'vacant';
    case UnderMaintenance = 'under_maintenance';

    public function label(): string
    {
        return match ($this) {
            self::Occupied => 'Occupied',
            self::Vacant => 'Vacant',
            self::UnderMaintenance => 'Under Maintenance',
        };
    }
}
