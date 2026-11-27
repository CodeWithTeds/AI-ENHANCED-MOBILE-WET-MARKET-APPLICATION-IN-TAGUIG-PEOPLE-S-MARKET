<?php

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Notifications\OrderCancelledNotification;
use App\Services\OrderService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

afterEach(function () {
    Carbon::setTestNow();
});

function makeCancellationSetup(float $initialStock = 10.0): array
{
    $customer = User::factory()->create([
        'name' => 'Ana Reyes',
        'is_admin' => false,
        'is_active' => true,
    ]);

    $vendorUser = User::factory()->create([
        'name' => 'Mang Jose',
        'is_admin' => false,
        'is_active' => true,
    ]);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Mang Jose Fresh Meat',
        'stall_location' => 'Building A, Stall 5',
        'product_categories' => ['Meat'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Pork Liempo',
        'category' => 'Meat',
        'price' => 340.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $inventory = Inventory::create([
        'vendor_id' => $vendor->id,
        'product_id' => $product->id,
        'stock_quantity' => $initialStock,
        'reorder_level' => 5.0,
        'cost_price' => 260.00,
        'selling_price' => 340.00,
        'status' => 'active',
    ]);

    return [$customer, $vendorUser, $vendor, $product, $inventory];
}

test('customer can cancel a pending order before vendor confirms and stock is restored', function () {
    Notification::fake();

    [$customer, $vendorUser, $vendor, $product, $inventory] = makeCancellationSetup(10.0);

    $orderResponse = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2.5],
        ],
    ]);

    $orderResponse->assertCreated();
    $orderId = $orderResponse->json('data.id');

    expect((float) $inventory->fresh()->stock_quantity)->toBe(10.0);

    $cancelResponse = $this->actingAs($customer, 'sanctum')->postJson("/api/v1/orders/{$orderId}/cancel", [
        'reason' => 'Ordered the wrong weight',
    ]);

    $cancelResponse->assertOk()
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.cancelled_by', 'customer')
        ->assertJsonPath('data.cancellation_reason', 'Ordered the wrong weight');

    // Stock stays untouched because transaction did not complete
    expect((float) $inventory->fresh()->stock_quantity)->toBe(10.0)
        ->and(InventoryLog::where('product_id', $product->id)->count())->toBe(0);

    $this->assertDatabaseHas('order_status_histories', [
        'order_id' => $orderId,
        'status' => 'cancelled',
    ]);

    Notification::assertSentTo($vendorUser, OrderCancelledNotification::class);
});

test('customer cannot cancel an order once vendor has confirmed it', function () {
    [$customer, $vendorUser, $vendor, $product, $inventory] = makeCancellationSetup(10.0);

    $orderResponse = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2.0],
        ],
    ]);
    $orderId = $orderResponse->json('data.id');

    // Vendor confirms the order -> automatically advances to Ready for Pickup
    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$orderId}/status", ['status' => 'confirmed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'ready');

    $order = Order::with('items')->findOrFail($orderId);
    expect($order->ready_at)->not->toBeNull()
        ->and($order->pickup_expires_at)->not->toBeNull()
        ->and($order->items->first()->vendor_confirmed_at)->not->toBeNull();

    // Customer direct cancel is rejected
    $this->actingAs($customer, 'sanctum')
        ->postJson("/api/v1/orders/{$orderId}/cancel", ['reason' => 'Too late'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Order can no longer be cancelled once confirmed by the vendor.');

    // Customer chat cancel is also rejected once vendor confirmed
    $this->actingAs($customer, 'sanctum')
        ->postJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat/cancel", ['reason' => 'Too late'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Order can no longer be cancelled once confirmed by the vendor.');

    expect((float) $inventory->fresh()->stock_quantity)->toBe(10.0)
        ->and($order->fresh()->status)->toBe('ready');
});

test('vendor cannot cancel ready order before 1 hour passes, but can cancel after 1 hour unclaimed', function () {
    Notification::fake();

    $start = Carbon::parse('2026-11-26 09:00:00', 'Asia/Manila');
    Carbon::setTestNow($start);

    [$customer, $vendorUser, $vendor, $product, $inventory] = makeCancellationSetup(12.0);

    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 3.0],
    ], 'gcash', null, 'GCASHREF-888');

    // Vendor confirms -> Ready for Pickup at 09:00
    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'confirmed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'ready');

    // At 09:59 (59 minutes elapsed) -> still blocked
    Carbon::setTestNow($start->copy()->addMinutes(59));

    $this->actingAs($vendorUser, 'sanctum')
        ->postJson("/api/v1/vendor/orders/{$order->id}/cancel")
        ->assertStatus(422)
        ->assertJsonPath(
            'message',
            'You can cancel a Ready for Pickup order only after 1 hour has passed without customer pickup.',
        );

    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'cancelled'])
        ->assertStatus(422);

    expect((float) $inventory->fresh()->stock_quantity)->toBe(12.0);

    // At 10:00 (1 full hour elapsed without customer pickup) -> vendor cancel succeeds!
    Carbon::setTestNow($start->copy()->addHour());

    $cancelRes = $this->actingAs($vendorUser, 'sanctum')
        ->postJson("/api/v1/vendor/orders/{$order->id}/cancel", [
            'reason' => 'Unclaimed 1 hour after Ready for Pickup',
        ]);

    $cancelRes->assertOk()
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.cancelled_by', 'vendor');

    expect((float) $inventory->fresh()->stock_quantity)->toBe(12.0);

    Notification::assertSentTo($customer, OrderCancelledNotification::class);
});

test('cod checkout marks confirmation as confirmed immediately without secondary customer confirmation step', function () {
    [$customer, $vendorUser, $vendor, $product, $inventory] = makeCancellationSetup(10.0);

    $orderRes = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2.0],
        ],
    ]);

    $orderRes->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.confirmation_status', 'confirmed')
        ->assertJsonPath('data.confirmed_by', $customer->id)
        ->assertJsonPath('data.payment_status', 'unpaid')
        ->assertJsonPath('data.items.0.payment_status', 'unpaid');

    $orderId = $orderRes->json('data.id');

    // Immediately visible to vendor as pending and ready to process, still unpaid until completed
    $vendorList = $this->actingAs($vendorUser, 'sanctum')->getJson('/api/v1/vendor/orders');
    $vendorList->assertOk()
        ->assertJsonPath('data.0.id', $orderId)
        ->assertJsonPath('data.0.status', 'pending')
        ->assertJsonPath('data.0.confirmation_status', 'confirmed')
        ->assertJsonPath('data.0.payment_status', 'unpaid');

    // Confirming (auto-moves to Ready) still keeps COD payment_status as unpaid
    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$orderId}/status", ['status' => 'confirmed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'ready')
        ->assertJsonPath('data.payment_status', 'unpaid');

    // Completing pickup marks the COD order as paid
    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$orderId}/status", ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.payment_status', 'paid');
});

test('admin completing a cod order transitions payment_status from unpaid to paid', function () {
    [$customer, $vendorUser, $vendor, $product] = makeCancellationSetup(10.0);

    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1.0],
    ], 'cash');

    expect($order->payment_status)->toBe('unpaid');

    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true, 'email_verified_at' => now()]);
    $this->actingAs($admin)
        ->patch("/admin/dashboard/orders/{$order->id}/status", ['status' => 'completed'])
        ->assertRedirect();

    $order->refresh();
    expect($order->status)->toBe('completed')
        ->and($order->payment_status)->toBe('paid')
        ->and($order->items()->firstOrFail()->payment_status)->toBe('paid');
});

test('pending_confirmation order automatically cancels after 1 hour countdown for both customer and vendor', function () {
    Notification::fake();

    $start = Carbon::parse('2026-11-26 10:00:00', 'Asia/Manila');
    Carbon::setTestNow($start);

    [$customer, $vendorUser, $vendor, $product, $inventory] = makeCancellationSetup(10.0);

    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2.0],
    ], 'cash');
    $orderId = $order->id;

    // Simulate an order explicitly awaiting confirmation with a 1-hour expiry window
    $order->update([
        'confirmation_status' => 'pending_confirmation',
        'confirmation_expires_at' => now()->addHour(),
    ]);

    expect((float) $inventory->fresh()->stock_quantity)->toBe(10.0);

    // At +59 mins -> still pending
    Carbon::setTestNow($start->copy()->addMinutes(59));

    $this->artisan('orders:cancel-expired')->assertExitCode(0);
    expect(Order::findOrFail($orderId)->status)->toBe('pending');

    // At +60 mins -> automatic cancellation triggers cleanly for both customer & vendor
    Carbon::setTestNow($start->copy()->addHour());

    $customerList = $this->actingAs($customer, 'sanctum')->getJson('/api/v1/orders');
    $customerList->assertOk()
        ->assertJsonPath('data.data.0.status', 'cancelled')
        ->assertJsonPath('data.data.0.cancelled_by', 'system');

    $vendorList = $this->actingAs($vendorUser, 'sanctum')->getJson('/api/v1/vendor/orders');
    $vendorList->assertOk()
        ->assertJsonPath('data.0.status', 'cancelled')
        ->assertJsonPath('data.0.cancelled_by', 'system');

    expect((float) $inventory->fresh()->stock_quantity)->toBe(10.0);

    // Idempotent check: running scheduler after auto-cancel never alters stock
    $this->artisan('orders:cancel-expired')->assertExitCode(0);
    expect((float) $inventory->fresh()->stock_quantity)->toBe(10.0)
        ->and(InventoryLog::where('reference_number', Order::findOrFail($orderId)->order_number)->count())->toBe(0);

    Notification::assertSentTo($customer, OrderCancelledNotification::class);
    Notification::assertSentTo($vendorUser, OrderCancelledNotification::class);
});

test('multi-vendor order blocks customer cancel once one vendor confirms and isolates vendor 1hr ready cancel', function () {
    $start = Carbon::parse('2026-11-26 11:00:00', 'Asia/Manila');
    Carbon::setTestNow($start);

    [$customer, $vendorUser1, $vendor1, $product1, $inventory1] = makeCancellationSetup(10.0);

    $vendorUser2 = User::factory()->create(['is_active' => true]);
    $vendor2 = Vendor::create([
        'user_id' => $vendorUser2->id,
        'stall_name' => 'Aling Nena Veggies',
        'stall_location' => 'Building B, Stall 3',
        'product_categories' => ['Vegetables'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);
    $product2 = Product::create([
        'vendor_id' => $vendor2->id,
        'name' => 'Sitaw',
        'category' => 'Vegetables',
        'price' => 60.00,
        'unit' => 'bundle',
        'is_available' => true,
    ]);
    $inventory2 = Inventory::create([
        'vendor_id' => $vendor2->id,
        'product_id' => $product2->id,
        'stock_quantity' => 15.0,
        'cost_price' => 40.00,
        'selling_price' => 60.00,
        'status' => 'active',
    ]);

    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product1->id, 'product_name' => $product1->name, 'quantity' => 2.0],
        ['product_id' => $product2->id, 'product_name' => $product2->name, 'quantity' => 3.0],
    ], 'gcash', null, 'MULTI-REF-123');

    // Vendor 1 confirms their portion; Vendor 2 remains pending
    $this->actingAs($vendorUser1, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'confirmed'])
        ->assertOk();

    // Whole-order customer cancel blocked because Vendor 1 confirmed
    $this->actingAs($customer, 'sanctum')
        ->postJson("/api/v1/orders/{$order->id}/cancel")
        ->assertStatus(422);

    // After 1 hour, Vendor 1 cancels their unclaimed Ready portion without cancelling Vendor 2
    Carbon::setTestNow($start->copy()->addHour());

    $this->actingAs($vendorUser1, 'sanctum')
        ->postJson("/api/v1/vendor/orders/{$order->id}/cancel")
        ->assertOk();

    expect((float) $inventory1->fresh()->stock_quantity)->toBe(10.0)
        ->and((float) $inventory2->fresh()->stock_quantity)->toBe(15.0)
        ->and($order->fresh()->status)->toBe('pending');
});

test('other customers and unrelated vendors cannot cancel another users order', function () {
    [$customer, $vendorUser, $vendor, $product] = makeCancellationSetup(10.0);
    $strangerCustomer = User::factory()->create(['is_active' => true]);
    $strangerVendorUser = User::factory()->create(['is_active' => true]);
    Vendor::create([
        'user_id' => $strangerVendorUser->id,
        'stall_name' => 'Other Stall',
        'stall_location' => 'Stall 99',
        'product_categories' => ['Meat'],
        'status' => 'approved',
    ]);

    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1.0],
    ], 'cash');

    $this->actingAs($strangerCustomer, 'sanctum')
        ->postJson("/api/v1/orders/{$order->id}/cancel")
        ->assertNotFound();

    $this->actingAs($strangerVendorUser, 'sanctum')
        ->postJson("/api/v1/vendor/orders/{$order->id}/cancel")
        ->assertNotFound();
});
