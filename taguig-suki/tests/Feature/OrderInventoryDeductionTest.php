<?php

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/*
 * Uses DatabaseTransactions: every record created here is rolled back when the
 * test finishes. Nothing in the real MySQL database is touched or deleted.
 */

function makeFishSetup(): array
{
    $admin = User::factory()->create(['name' => 'Admin Tester', 'is_admin' => true]);
    $customer = User::factory()->create(['name' => 'Test Customer']);
    $vendorUser = User::factory()->create(['name' => 'Aling Rosa']);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Aling Rosa Fresh Fish',
        'stall_location' => 'Stall 12, Fish Section',
        'product_categories' => ['fish'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Bangus',
        'description' => 'Fresh milkfish',
        'category' => 'Fish',
        'price' => 180.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $inventory = Inventory::create([
        'product_id' => $product->id,
        'vendor_id' => $vendor->id,
        'stock_quantity' => 25,
        'reorder_level' => 5,
        'max_stock_level' => 40,
        'cost_price' => 120.00,
        'selling_price' => 180.00,
        'markup_percentage' => 50.00,
        'status' => 'active',
    ]);

    return [$admin, $customer, $vendorUser, $vendor, $product, $inventory];
}

function placeFishOrder(User $customer, Product $product, float $qty = 3): Order
{
    return app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => $qty],
    ], 'gcash', 'Feature test order');
}

test('placing an order deducts the vendor inventory and logs the sale', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $inventory] = makeFishSetup();

    $order = placeFishOrder($customer, $product, 3);

    // Order created with a pending start
    expect($order->status)->toBe('pending');
    expect($order->total_amount)->toBe('540.00');
    expect($order->items)->toHaveCount(1);

    // Stock deducted: 25 - 3 = 22 (decimal cast returns string)
    $inventory->refresh();
    expect((float) $inventory->stock_quantity)->toBe(22.0);

    // Sale is logged
    $log = InventoryLog::where('inventory_id', $inventory->id)->latest()->first();
    expect($log->type)->toBe('sold');
    expect((float) $log->quantity_before)->toBe(25.0);
    expect((float) $log->quantity_change)->toBe(-3.0);
    expect((float) $log->quantity_after)->toBe(22.0);
    expect($log->reference_number)->toBe($order->order_number);
});

test('vendor can progress an order to completed and every status is recorded', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $inventory] = makeFishSetup();

    $order = placeFishOrder($customer, $product, 2);
    $service = app(OrderService::class);

    // Processing removed: pending → confirmed (auto → ready) → completed
    $service->updateOrderStatus($vendorUser, $order->id, 'confirmed');
    $order->refresh();
    // Confirm automatically advances to Ready (one-click vendor flow)
    expect($order->status)->toBe('ready');

    $service->updateOrderStatus($vendorUser, $order->id, 'completed');

    $order->refresh();
    expect($order->status)->toBe('completed');

    $timeline = OrderStatusHistory::where('order_id', $order->id)->orderBy('id')->pluck('status')->all();
    expect($timeline)->toBe(['pending', 'confirmed', 'ready', 'completed']);

    // Stock stays deducted: 25 - 2 = 23
    $inventory->refresh();
    expect((float) $inventory->stock_quantity)->toBe(23.0);
});

test('admin inventory monitoring shows the deducted stock after a completed order', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $inventory] = makeFishSetup();

    $order = placeFishOrder($customer, $product, 3);
    app(OrderService::class)->updateOrderStatus($vendorUser, $order->id, 'completed');

    $this->actingAs($admin)
        ->get('/admin/dashboard/inventory?category=Fish&stock_status=in')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/inventory/index')
            ->where('stats.total', 1)
            ->where('stats.in_stock', 1)
            ->where('stats.low_stock', 0)
            ->where('stats.out_of_stock', 0)
            ->where('inventories.data.0.product.name', 'Bangus')
            ->where('inventories.data.0.product.category', 'Fish')
            ->where('inventories.data.0.stock_quantity', fn ($v) => (float) $v === 22.0)
            ->where('inventories.data.0.stock_status', 'in')
            ->where('inventories.data.0.vendor.stall_name', 'Aling Rosa Fresh Fish')
        );
});

test('ordering more than available stock is rejected without touching inventory', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $inventory] = makeFishSetup();

    $this->expectException(UnprocessableEntityHttpException::class);

    placeFishOrder($customer, $product, 999);

    // Never allow negative stock
    $inventory->refresh();
    expect((float) $inventory->stock_quantity)->toBe(25.0);
});
