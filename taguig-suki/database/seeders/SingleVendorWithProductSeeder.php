<?php

namespace Database\Seeders;

use App\Enums\VendorStatus;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Stall;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorDocument;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;

class SingleVendorWithProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Create or retrieve vendor user account
        $user = User::firstOrCreate(
            ['email' => 'mangkanor@taguig-suki.com'],
            [
                'name' => 'Mang Kanor',
                'password' => Hash::make('password'),
                'is_admin' => false,
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        // 2. Assign vacant stall or create one if none vacant
        $stall = Stall::where('status', 'vacant')->first();
        if ($stall) {
            $stall->update([
                'vendor_id' => $user->id,
                'store_name' => 'Mang Kanor Fresh Meat',
                'status' => 'occupied',
            ]);
            $stallLocation = "Stall {$stall->stall_number}, {$stall->section}";
        } else {
            $stallLocation = 'Stall 1, Meat Section';
        }

        // 3. Create or update Vendor profile
        $vendor = Vendor::firstOrCreate(
            ['user_id' => $user->id],
            [
                'stall_name' => 'Mang Kanor Fresh Meat',
                'stall_location' => $stallLocation,
                'opening_time' => '05:00',
                'closing_time' => '19:00',
                'gcash_number' => '+639171234567',
                'maya_number' => '+639171234567',
                'product_categories' => ['Meat', 'Poultry'],
                'status' => VendorStatus::Approved->value,
                'approved_at' => now(),
            ]
        );

        // Ensure vendor status is approved
        if ($vendor->status !== VendorStatus::Approved->value) {
            $vendor->update([
                'status' => VendorStatus::Approved->value,
                'approved_at' => now(),
            ]);
        }

        // 4. Attach valid ID document if not already present
        if ($vendor->documents()->where('document_type', 'valid_id')->doesntExist()) {
            // Find existing sample image if any
            $existingDoc = VendorDocument::first();
            VendorDocument::create([
                'vendor_id' => $vendor->id,
                'document_type' => 'valid_id',
                'file_path' => $existingDoc?->file_path ?? 'vendors/default_valid_id.jpg',
                'original_name' => 'valid_id.jpg',
            ]);
        }

        // 5. Setup product image
        $imagePath = 'products/sample_pork_liempo.jpg';
        $sourceSample = storage_path('app/public/products/3/j7zAme13FFQWjdP0zd80nFOWww4H8H5IdRiTMYg4.jpg');
        $targetDir = storage_path("app/public/products/{$vendor->id}");
        if (! File::isDirectory($targetDir)) {
            File::makeDirectory($targetDir, 0755, true);
        }

        if (File::exists($sourceSample)) {
            $targetSample = "{$targetDir}/pork_liempo.jpg";
            File::copy($sourceSample, $targetSample);
            $imagePath = "products/{$vendor->id}/pork_liempo.jpg";
        }

        // 6. Create product for vendor
        $product = Product::firstOrCreate(
            [
                'vendor_id' => $vendor->id,
                'name' => 'Fresh Pork Liempo',
            ],
            [
                'description' => 'Premium fresh pork belly (liempo), carefully cut and freshly supplied daily.',
                'category' => 'Meat',
                'price' => 320.00,
                'unit' => 'kg',
                'image' => $imagePath,
                'is_available' => true,
            ]
        );

        // 7. Create or update inventory
        Inventory::updateOrCreate(
            [
                'product_id' => $product->id,
                'vendor_id' => $vendor->id,
            ],
            [
                'stock_quantity' => 50.00,
                'reorder_level' => 10.00,
                'cost_price' => 270.00,
                'selling_price' => 320.00,
                'markup_percentage' => 18.52,
                'status' => 'active',
            ]
        );

        $this->command->info("Seeded Vendor: {$vendor->stall_name} (User: {$user->email})");
        $this->command->info("Seeded Product: {$product->name} (₱{$product->price}/{$product->unit}) with 50 units stock.");
    }
}
