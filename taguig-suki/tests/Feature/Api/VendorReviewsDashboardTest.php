<?php

use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use App\Models\Vendor;
use Laravel\Sanctum\Sanctum;

test('vendor reviews dashboard endpoint returns stall and product reviews', function () {
    $vendorUser = User::factory()->create(['name' => 'Stall Owner']);
    $customerUser1 = User::factory()->create(['name' => 'Customer Ana']);
    $customerUser2 = User::factory()->create(['name' => 'Customer Bob']);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Rosa Fish Stall',
        'stall_location' => 'Fish Section 5',
        'product_categories' => ['fish'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Tilapia',
        'description' => 'Fresh tilapias',
        'category' => 'Fish',
        'price' => 120.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    // Create a stall review
    Review::create([
        'user_id' => $customerUser1->id,
        'reviewable_type' => Vendor::class,
        'reviewable_id' => $vendor->id,
        'rating' => 5,
        'comment' => 'Very clean stall and friendly seller!',
    ]);

    // Create a product review
    Review::create([
        'user_id' => $customerUser2->id,
        'reviewable_type' => Product::class,
        'reviewable_id' => $product->id,
        'rating' => 4,
        'comment' => 'Fresh fish, cooked well.',
    ]);

    Sanctum::actingAs($vendorUser);

    $response = $this->getJson('/api/v1/vendor/reviews');

    $response->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.stall.average_rating', 5)
        ->assertJsonPath('data.stall.total', 1)
        ->assertJsonPath('data.stall.reviews.0.user', 'Customer Ana')
        ->assertJsonPath('data.stall.reviews.0.comment', 'Very clean stall and friendly seller!')
        ->assertJsonPath('data.products.average_rating', 4)
        ->assertJsonPath('data.products.total', 1)
        ->assertJsonPath('data.products.reviews.0.user', 'Customer Bob')
        ->assertJsonPath('data.products.reviews.0.product_name', 'Tilapia')
        ->assertJsonPath('data.products.reviews.0.comment', 'Fresh fish, cooked well.');
});
