<?php

use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Notifications\PaymentStatusUpdatedNotification;
use App\Services\OrderService;
use Laravel\Sanctum\Sanctum;

function setupOrderNotificationEnv(array $customerPreferences = [], array $vendorPreferences = []): array
{
    $customer = User::factory()->create([
        'name' => 'Notification Customer',
        'notification_preferences' => $customerPreferences ?: null,
    ]);

    $vendorUser = User::factory()->create(['name' => 'Notification Vendor']);
    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Notification Stall',
        'stall_location' => 'Vegetable Section Stall 1',
        'product_categories' => ['vegetables'],
        'status' => 'approved',
        'approved_at' => now(),
        'notification_preferences' => $vendorPreferences ?: null,
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Notification Tomatoes',
        'category' => 'vegetables',
        'price' => 150.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    Inventory::create([
        'product_id' => $product->id,
        'vendor_id' => $vendor->id,
        'stock_quantity' => 100,
        'reorder_level' => 5,
        'selling_price' => 150.00,
        'cost_price' => 100.00,
        'status' => 'active',
    ]);

    return [$customer, $vendorUser, $vendor, $product];
}

test('vendor receives a notification with the customer and amount when an order is placed', function () {
    [$customer, $vendorUser, $vendor, $product] = setupOrderNotificationEnv();

    $order = app(OrderService::class)->placeOrder(
        $customer,
        [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2],
        ],
        'cash',
    );

    $notification = $vendorUser->notifications()->first();

    expect($notification)->not->toBeNull();
    expect($notification->data['category'])->toBe('order_placed');
    expect($notification->data['order_id'])->toBe($order->id);
    expect($notification->data['vendor_id'])->toBe($vendor->id);
    expect($notification->data['stall_name'])->toBe('Notification Stall');
    expect($notification->data['customer_name'])->toBe('Notification Customer');
    expect((float) $notification->data['amount'])->toBe(300.0);
    expect($notification->data['message'])->toContain('300.00');
});

test('vendor is notified when a customer submits payment proof', function () {
    [$customer, $vendorUser, $vendor, $product] = setupOrderNotificationEnv();

    $service = app(OrderService::class);
    $order = $service->placeOrder(
        $customer,
        [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2],
        ],
        'gcash',
    );

    $service->submitPaymentReference($customer, $order->id, 'GCASH-REF-123');

    $notification = $vendorUser->notifications()
        ->get()
        ->first(fn ($item) => ($item->data['category'] ?? null) === 'payment_submitted');

    expect($notification)->not->toBeNull();
    expect($notification->data['order_id'])->toBe($order->id);
    expect((float) $notification->data['amount'])->toBe(300.0);
    expect($notification->data['payment_reference_number'])->toBe('GCASH-REF-123');
    expect($notification->data['message'])->toContain('Please verify');
});

test('customer is notified with amount and vendor when payment is verified', function () {
    [$customer, $vendorUser, $vendor, $product] = setupOrderNotificationEnv();

    $service = app(OrderService::class);
    $order = $service->placeOrder(
        $customer,
        [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2],
        ],
        'gcash',
        null,
        null,
        [['vendor_id' => $vendor->id, 'payment_reference_number' => 'GCASH-PAID-001']],
    );

    $service->verifyPayment($vendorUser, $order->id, 'verify');

    $notification = $customer->notifications()->first();

    expect($notification)->not->toBeNull();
    expect($notification->data['category'])->toBe('payment_received');
    expect($notification->data['payment_status'])->toBe('paid');
    expect($notification->data['order_id'])->toBe($order->id);
    expect($notification->data['vendor_id'])->toBe($vendor->id);
    expect($notification->data['stall_name'])->toBe('Notification Stall');
    expect((float) $notification->data['amount'])->toBe(300.0);
    expect($notification->data['message'])->toContain('verified successfully');
});

test('customer is notified when a vendor updates the order status', function () {
    [$customer, $vendorUser, $vendor, $product] = setupOrderNotificationEnv();

    $service = app(OrderService::class);
    $order = $service->placeOrder(
        $customer,
        [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2],
        ],
        'cash',
    );

    $service->updateOrderStatus($vendorUser, $order->id, 'confirmed');

    $notification = $customer->notifications()->first();

    expect($notification)->not->toBeNull();
    expect($notification->data['category'])->toBe('order_status');
    expect($notification->data['status'])->toBe('ready');
    expect((float) $notification->data['amount'])->toBe(300.0);
    expect($notification->data['message'])->toContain('ready for pickup');
});

test('order notifications respect the vendor order alert preference', function () {
    [$customer, $vendorUser, $vendor, $product] = setupOrderNotificationEnv([], ['order_alerts' => false]);

    app(OrderService::class)->placeOrder(
        $customer,
        [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1],
        ],
        'cash',
    );

    expect($vendorUser->notifications()->count())->toBe(0);
});

test('notifications api lists, counts, and marks notifications as read', function () {
    $customer = User::factory()->create();

    $customer->notify(new PaymentStatusUpdatedNotification(
        orderId: 99,
        orderNumber: 'ORD-20261101-0001',
        vendorId: 7,
        stallName: 'Notification Stall',
        amount: 250.00,
        paymentMethod: 'gcash',
        reference: 'REF-API-1',
        approved: true,
    ));

    Sanctum::actingAs($customer);

    $response = $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.unread_count', 1)
        ->assertJsonPath('data.notifications.0.category', 'payment_received')
        ->assertJsonPath('data.notifications.0.order_id', 99)
        ->assertJsonPath('data.notifications.0.is_read', false);

    $notificationId = $response->json('data.notifications.0.id');

    $this->getJson('/api/v1/notifications/unread-count')
        ->assertOk()
        ->assertJsonPath('data.unread_count', 1);

    $this->patchJson("/api/v1/notifications/{$notificationId}/read")
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0);

    $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0)
        ->assertJsonPath('data.notifications.0.is_read', true);

    $this->postJson('/api/v1/notifications/read-all')
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0);
});

test('notifications api only exposes the authenticated users notifications', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    $owner->notify(new PaymentStatusUpdatedNotification(
        orderId: 100,
        orderNumber: 'ORD-20261101-0002',
        vendorId: 8,
        stallName: 'Owner Stall',
        amount: 100.00,
        paymentMethod: 'maya',
        reference: 'REF-OWNER',
        approved: true,
    ));

    Sanctum::actingAs($other);

    $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0)
        ->assertJsonCount(0, 'data.notifications');
});
