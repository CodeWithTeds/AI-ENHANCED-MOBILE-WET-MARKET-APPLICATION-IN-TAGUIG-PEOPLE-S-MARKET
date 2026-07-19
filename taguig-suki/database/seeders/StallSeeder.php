<?php

namespace Database\Seeders;

use App\Models\Section;
use App\Models\Stall;
use Illuminate\Database\Seeder;

class StallSeeder extends Seeder
{
    public function run(): void
    {
        // Create sections
        $meat = Section::create(['name' => 'Meat', 'slug' => 'meat', 'color' => '#dc2626', 'is_active' => true]);
        $fish = Section::create(['name' => 'Fish', 'slug' => 'fish', 'color' => '#2563eb', 'is_active' => true]);
        $dry = Section::create(['name' => 'Dry Ingredients', 'slug' => 'dry-ingredients', 'color' => '#d97706', 'is_active' => true]);

        $stalls = [
            // Meat Section
            ['section_id' => $meat->id, 'section' => 'meat', 'stall_number' => 'Stall 1', 'store_name' => "Mang Tony's Karne", 'status' => 'occupied', 'size' => 'medium', 'monthly_rent' => 3500, 'is_active' => true, 'description' => 'Fresh pork and beef daily'],
            ['section_id' => $meat->id, 'section' => 'meat', 'stall_number' => 'Stall 2', 'store_name' => "Jun's Pork & Beef", 'status' => 'occupied', 'size' => 'large', 'monthly_rent' => 5000, 'is_active' => true, 'description' => 'Premium cuts and wholesale'],
            ['section_id' => $meat->id, 'section' => 'meat', 'stall_number' => 'Stall 3', 'store_name' => "Aling Lina's Chicken", 'status' => 'occupied', 'size' => 'small', 'monthly_rent' => 2500, 'is_active' => true, 'description' => 'Dressed chicken and eggs'],
            ['section_id' => $meat->id, 'section' => 'meat', 'stall_number' => 'Stall 4', 'store_name' => '—', 'status' => 'vacant', 'size' => 'medium', 'monthly_rent' => 3500, 'is_active' => true, 'description' => null],
            ['section_id' => $meat->id, 'section' => 'meat', 'stall_number' => 'Stall 5', 'store_name' => "Carlo's Meat Shop", 'status' => 'occupied', 'size' => 'large', 'monthly_rent' => 5000, 'is_active' => true, 'description' => 'All kinds of meat products'],
            ['section_id' => $meat->id, 'section' => 'meat', 'stall_number' => 'Stall 6', 'store_name' => '—', 'status' => 'under_maintenance', 'size' => 'small', 'monthly_rent' => 2500, 'is_active' => false, 'description' => 'Under renovation'],

            // Fish Section
            ['section_id' => $fish->id, 'section' => 'fish', 'stall_number' => 'Stall 1', 'store_name' => "Aling Rosa's Fresh Fish", 'status' => 'occupied', 'size' => 'large', 'monthly_rent' => 5000, 'is_active' => true, 'description' => 'Fresh catch daily from Navotas'],
            ['section_id' => $fish->id, 'section' => 'fish', 'stall_number' => 'Stall 2', 'store_name' => "Kuya Ben's Seafood", 'status' => 'occupied', 'size' => 'medium', 'monthly_rent' => 3500, 'is_active' => true, 'description' => 'Shrimp, squid, and shellfish'],
            ['section_id' => $fish->id, 'section' => 'fish', 'stall_number' => 'Stall 3', 'store_name' => "Nena's Bangus", 'status' => 'occupied', 'size' => 'medium', 'monthly_rent' => 3500, 'is_active' => true, 'description' => 'Milkfish specialist - boneless available'],
            ['section_id' => $fish->id, 'section' => 'fish', 'stall_number' => 'Stall 4', 'store_name' => '—', 'status' => 'vacant', 'size' => 'small', 'monthly_rent' => 2500, 'is_active' => true, 'description' => null],
            ['section_id' => $fish->id, 'section' => 'fish', 'stall_number' => 'Stall 5', 'store_name' => "Mang Erning's Tilapia", 'status' => 'occupied', 'size' => 'small', 'monthly_rent' => 2500, 'is_active' => true, 'description' => 'Farm-raised tilapia'],

            // Dry Ingredients Section
            ['section_id' => $dry->id, 'section' => 'dry_ingredients', 'stall_number' => 'Stall 1', 'store_name' => "Manang's Bilihin", 'status' => 'occupied', 'size' => 'large', 'monthly_rent' => 4500, 'is_active' => true, 'description' => 'Rice, sugar, flour, and cooking oil'],
            ['section_id' => $dry->id, 'section' => 'dry_ingredients', 'stall_number' => 'Stall 2', 'store_name' => 'Spice Corner', 'status' => 'occupied', 'size' => 'small', 'monthly_rent' => 2500, 'is_active' => true, 'description' => 'All local and imported spices'],
            ['section_id' => $dry->id, 'section' => 'dry_ingredients', 'stall_number' => 'Stall 3', 'store_name' => 'Pantry Essentials', 'status' => 'occupied', 'size' => 'medium', 'monthly_rent' => 3500, 'is_active' => true, 'description' => 'Canned goods, noodles, sauces'],
            ['section_id' => $dry->id, 'section' => 'dry_ingredients', 'stall_number' => 'Stall 4', 'store_name' => '—', 'status' => 'vacant', 'size' => 'medium', 'monthly_rent' => 3500, 'is_active' => true, 'description' => null],
            ['section_id' => $dry->id, 'section' => 'dry_ingredients', 'stall_number' => 'Stall 5', 'store_name' => "Ate Mely's Grocery", 'status' => 'occupied', 'size' => 'large', 'monthly_rent' => 4500, 'is_active' => true, 'description' => 'Complete grocery items'],
        ];

        foreach ($stalls as $stall) {
            Stall::create($stall);
        }
    }
}
