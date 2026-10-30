<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\ReviewImage;
use App\Models\User;
use App\Models\Vendor;
use App\Services\Admin\FeedbackManagementService;
use App\Services\ReviewService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

test('customer can submit a product review with attached evidence photos', function () {
    Storage::fake('public');

    $vendorUser = User::factory()->create();
    $customer = User::factory()->create(['name' => 'Maria Santos']);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Fish Section 1',
        'stall_location' => 'Bldg A',
        'product_categories' => ['fish'],
        'status' => 'approved',
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Fresh Bangus',
        'category' => 'Fish',
        'price' => 180.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    // Create a completed order
    $order = Order::create([
        'user_id' => $customer->id,
        'order_number' => 'ORD-12345',
        'status' => 'completed',
        'total_amount' => 180.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order->id,
        'vendor_id' => $vendor->id,
        'product_id' => $product->id,
        'product_name' => $product->name,
        'category' => 'Fish',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 180.00,
        'subtotal' => 180.00,
    ]);

    Sanctum::actingAs($customer);

    $photo1 = UploadedFile::fake()->image('damaged_fish1.jpg', 600, 600)->size(1200);
    $photo2 = UploadedFile::fake()->image('damaged_fish2.png', 800, 600)->size(1500);

    $response = $this->post('/api/v1/reviews/product', [
        'product_id' => $product->id,
        'order_id' => $order->id,
        'rating' => 1,
        'comment' => 'The fish arrived spoiled and rotten with foul smell.',
        'images' => [$photo1, $photo2],
    ], ['Accept' => 'application/json']);

    $response->assertCreated();

    $this->assertDatabaseHas('reviews', [
        'user_id' => $customer->id,
        'reviewable_id' => $product->id,
        'rating' => 1,
        'comment' => 'The fish arrived spoiled and rotten with foul smell.',
    ]);

    $review = Review::where('user_id', $customer->id)->first();
    expect($review)->not->toBeNull();
    expect($review->images)->toHaveCount(2);

    $this->assertDatabaseHas('review_images', [
        'review_id' => $review->id,
        'order' => 0,
    ]);
    $this->assertDatabaseHas('review_images', [
        'review_id' => $review->id,
        'order' => 1,
    ]);

    foreach ($review->images as $img) {
        Storage::disk('public')->assertExists($img->path);
        expect($img->url)->toContain('/storage/');
    }

    // Public product reviews endpoint should include images
    $pubResponse = $this->getJson('/api/v1/reviews/product/' . $product->id);
    $pubResponse->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.reviews.0.images.0.id', $review->images[0]->id)
        ->assertJsonPath('data.reviews.0.images.1.id', $review->images[1]->id);

    // Vendor reviews dashboard should include images
    Sanctum::actingAs($vendorUser);
    $vendorDashboard = $this->getJson('/api/v1/vendor/reviews');
    $vendorDashboard->assertOk()
        ->assertJsonPath('data.products.reviews.0.images.0.id', $review->images[0]->id);

    // Admin feedback management service presents review images
    $adminData = app(FeedbackManagementService::class)->getIndexData([]);
    expect($adminData['reviews']->items()[0]['images'])->toHaveCount(2);

    // Deleting review removes images and files
    app(ReviewService::class)->deleteReview($customer, $review);
    $this->assertDatabaseMissing('reviews', ['id' => $review->id]);
    $this->assertDatabaseMissing('review_images', ['review_id' => $review->id]);
    foreach ($review->images as $img) {
        Storage::disk('public')->assertMissing($img->path);
    }
});

test('review rejects invalid file types or oversized images', function () {
    Storage::fake('public');

    $vendorUser = User::factory()->create();
    $customer = User::factory()->create();

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Veggie Stall',
        'stall_location' => 'Bldg B',
        'product_categories' => ['vegetables'],
        'status' => 'approved',
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Tomatoes',
        'category' => 'Vegetables',
        'price' => 50.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $order = Order::create([
        'user_id' => $customer->id,
        'order_number' => 'ORD-99999',
        'status' => 'completed',
        'total_amount' => 50.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order->id,
        'vendor_id' => $vendor->id,
        'product_id' => $product->id,
        'product_name' => $product->name,
        'category' => 'Vegetables',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 50.00,
        'subtotal' => 50.00,
    ]);

    Sanctum::actingAs($customer);

    // Rejects PDF file
    $pdf = UploadedFile::fake()->create('document.pdf', 500, 'application/pdf');
    $res = $this->post('/api/v1/reviews/product', [
        'product_id' => $product->id,
        'order_id' => $order->id,
        'rating' => 2,
        'comment' => 'Rotten',
        'images' => [$pdf],
    ], ['Accept' => 'application/json']);

    $res->assertStatus(422);
    expect($res->json('data')['images.0'])->not->toBeEmpty();

    // Rejects oversized file (>5MB, say 6000KB)
    $huge = UploadedFile::fake()->image('huge.jpg')->size(6000);
    $res2 = $this->post('/api/v1/reviews/product', [
        'product_id' => $product->id,
        'order_id' => $order->id,
        'rating' => 2,
        'comment' => 'Rotten',
        'images' => [$huge],
    ], ['Accept' => 'application/json']);

    $res2->assertStatus(422);
    expect($res2->json('data')['images.0'])->not->toBeEmpty();
});
