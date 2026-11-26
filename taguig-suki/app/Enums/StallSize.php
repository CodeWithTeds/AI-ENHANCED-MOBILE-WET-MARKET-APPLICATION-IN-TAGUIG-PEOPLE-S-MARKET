<?php

namespace App\Enums;

enum StallSize: string
{
    case Small = 'small';
    case Medium = 'medium';
    case Large = 'large';

    public function label(): string
    {
        return match ($this) {
            self::Small => 'Small',
            self::Medium => 'Medium',
            self::Large => 'Large',
        };
    }

    public function monthlyRent(): float
    {
        return match ($this) {
            self::Small => 1500.00,
            self::Medium => 2000.00,
            self::Large => 3000.00,
        };
    }
}
