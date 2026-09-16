<?php

namespace Database\Seeders;

use App\Models\Section;
use Illuminate\Database\Seeder;

class SectionSeeder extends Seeder
{
    public function run(): void
    {
        $sections = [
            ['name' => 'Meat', 'slug' => 'meat', 'color' => '#dc2626', 'is_active' => true],
            ['name' => 'Fish', 'slug' => 'fish', 'color' => '#2563eb', 'is_active' => true],
            ['name' => 'Dry Ingredients', 'slug' => 'dry-ingredients', 'color' => '#d97706', 'is_active' => true],
        ];

        foreach ($sections as $section) {
            Section::firstOrCreate(['slug' => $section['slug']], $section);
        }
    }
}
