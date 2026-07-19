<?php

namespace App\Enums;

enum StallSection: string
{
    case Meat = 'meat';
    case Fish = 'fish';
    case DryIngredients = 'dry_ingredients';

    public function label(): string
    {
        return match ($this) {
            self::Meat => 'Meat',
            self::Fish => 'Fish',
            self::DryIngredients => 'Dry Ingredients',
        };
    }
}
