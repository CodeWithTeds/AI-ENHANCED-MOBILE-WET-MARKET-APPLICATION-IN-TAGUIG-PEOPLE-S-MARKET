<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Laravel\Sanctum\Sanctum;

function setupReviewNotificationEnv(array $vendorPreferences = []): array
{
    $vendorUser = User::factory()->create(['name' => 'Review Vendor']);
    $customer = User::factory()->create(['name' => 'Review Customer']);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Review Stall',
        'stall_location' => 'Fish Section 4',
        'product_categories' => ['fish'],
        'status' => 'approved',
        'approved_at' => now(),
        'notification_preferences' => $vendorPreferences ?: null,
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Fresh Tilapia',
        'category' => 'Fish',
        'price' => 120.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $order = Order::create([
        'user_id' => $customer->id,
        'order_number' => 'ORD-REVIEW-001',
        'status' => 'completed',
        'total_amount' => 120.00,
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
        'unit_price' => 120.00,
        'subtotal' => 120.00,
    ]);

    return [$customer, $vendorUser, $vendor, $product, $order];
}

test('vendor is notified when a customer submits a stall review', function () {
    [$customer, $vendorUser, $vendor, $product, $order] = setupReviewNotificationEnv();

    Sanctum::actingAs($customer);

    $this->postJson('/api/v1/reviews/vendor', [
        'vendor_id' => $vendor->id,
        'order_id' => $order->id,
        'rating' => 5,
        'comment' => 'Very accommodating seller and clean stall!',
    ])->assertCreated();

    $notification = $vendorUser->notifications()->first();

    expect($notification)->not->toBeNull();
    expect($notification->data['category'])->toBe('new_review');
    expect($notification->data['target'])->toBe('stall');
    expect($notification->data['rating'])->toBe(5);
    expect($notification->data['vendor_id'])->toBe($vendor->id);
    expect($notification->data['stall_name'])->toBe('Review Stall');
    expect($notification->data['customer_name'])->toBe('Review Customer');
    expect($notification->data['message'])->toContain('Review Customer rated your stall 5/5');
    expect($notification->data['message'])->toContain('Very accommodating seller');
});

test('vendor is notified when a customer submits a product review', function () {
    [$customer, $vendorUser, $vendor, $product, $order] = setupReviewNotificationEnv();

    Sanctum::actingAs($customer);

    $this->postJson('/api/v1/reviews/product', [
        'product_id' => $product->id,
        'order_id' => $order->id,
        'rating' => 2,
        'comment' => 'Fish was not fresh.',
    ])->assertCreated();

    $notification = $vendorUser->notifications()->first();

    expect($notification)->not->toBeNull();
    expect($notification->data['category'])->toBe('new_review');
    expect($notification->data['target'])->toBe('product');
    expect($notification->data['product_id'])->toBe($product->id);
    expect($notification->data['product_name'])->toBe('Fresh Tilapia');
    expect($notification->data['message'])->toContain('Review Customer rated Fresh Tilapia 2/5');
});

test('vendor is not notified when review alerts are disabled', function () {
    [$customer, $vendorUser, $vendor, $product, $order] = setupReviewNotificationEnv([
        'review_alerts' => false,
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/v1/reviews/vendor', [
        'vendor_id' => $vendor->id,
        'order_id' => $order->id,
        'rating' => 4,
        'comment' => 'Good service.',
    ])->assertCreated();

    expect($vendorUser->notifications()->count())->toBe(0);
});

test('recipe reviews do not notify a vendor', function () {
    $customer = User::factory()->create(['name' => 'Recipe Customer']);
    $vendorUser = User::factory()->create();

    Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Unrelated Stall',
        'stall_location' => 'Section 1',
        'product_categories' => ['fish'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    Sanctum::actingAs($customer);

    $this->postJson('/api/v1/reviews/recipe', [
        'recipe_name' => 'Sinigang na Bangus',
        'rating' => 5,
        'comment' => 'Sarap!',
    ])->assertCreated();

    expect($vendorUser->notifications()->count())->toBe(0);
});

test('new review notifications are returned to the vendor notification feed', function () {
    [$customer, $vendorUser, $vendor, $product, $order] = setupReviewNotificationEnv();

    Sanctum::actingAs($customer);

    $this->postJson('/api/v1/reviews/vendor', [
        'vendor_id' => $vendor->id,
        'order_id' => $order->id,
        'rating' => 5,
        'comment' => 'Best stall in the market!',
    ])->assertCreated();

    Sanctum::actingAs($vendorUser);

    $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('data.unread_count', 1)
        ->assertJsonPath('data.notifications.0.category', 'new_review')
        ->assertJsonPath('data.notifications.0.data.review_id', $vendorUser->notifications()->first()->data['review_id']);
});
