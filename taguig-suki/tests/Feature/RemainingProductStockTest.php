<?php

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;

function makeStockWorkflowSetup(float $initialStock = 15.0): array
{
    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true]);
    $customer = User::factory()->create(['name' => 'Marco Santos', 'is_active' => true]);
    $vendorUser = User::factory()->create(['name' => 'Aling Maria', 'is_active' => true]);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Aling Maria Pork Stall',
        'stall_location' => 'Building A, Stall 1',
        'product_categories' => ['Meat'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Liempo',
        'description' => 'Fresh pork belly cut',
        'category' => 'Meat',
        'price' => 200.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $inventory = Inventory::create([
        'vendor_id' => $vendor->id,
        'product_id' => $product->id,
        'stock_quantity' => $initialStock,
        'reorder_level' => 5.0,
        'max_stock_level' => 30.0,
        'cost_price' => 150.00,
        'selling_price' => 200.00,
        'status' => 'active',
    ]);

    return [$admin, $customer, $vendorUser, $vendor, $product, $inventory];
}

test('placing and cancelling an order leaves vendor remaining stock completely untouched', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $inventory] = makeStockWorkflowSetup(15.0);

    $placeRes = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 4.0],
        ],
    ]);

    $placeRes->assertCreated();
    $orderId = $placeRes->json('data.id');

    // Stock remains 15 on placement
    expect((float) $inventory->fresh()->stock_quantity)->toBe(15.0)
        ->and(InventoryLog::where('inventory_id', $inventory->id)->count())->toBe(0);

    // Customer cancels before vendor confirms -> stock STILL 15 (neither deducted nor inflated)
    $this->actingAs($customer, 'sanctum')
        ->postJson("/api/v1/orders/{$orderId}/cancel", ['reason' => 'Changed plan'])
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    expect((float) $inventory->fresh()->stock_quantity)->toBe(15.0)
        ->and(InventoryLog::where('inventory_id', $inventory->id)->count())->toBe(0);
});

test('vendor stock is deducted only when order is marked completed and idempotency holds', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $inventory] = makeStockWorkflowSetup(15.0);

    $order1 = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 4.0],
    ], 'cash');

    // Confirm -> Ready still keeps stock untouched at 15
    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$order1->id}/status", ['status' => 'confirmed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'ready');

    expect((float) $inventory->fresh()->stock_quantity)->toBe(15.0);

    // Mark Completed -> stock now deducts 15 - 4 = 11
    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$order1->id}/status", ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed');

    expect((float) $inventory->fresh()->stock_quantity)->toBe(11.0);

    // Re-marking completed must not double-deduct
    $this->actingAs($vendorUser, 'sanctum')
        ->patchJson("/api/v1/vendor/orders/{$order1->id}/status", ['status' => 'completed'])
        ->assertOk();

    expect((float) $inventory->fresh()->stock_quantity)->toBe(11.0)
        ->and(InventoryLog::where('reference_number', $order1->order_number)->where('type', 'sold')->count())->toBe(1);

    // Admin completing a second order also deducts 11 - 2 = 9
    $order2 = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2.0],
    ], 'gcash', null, 'GCASH-777');

    $this->actingAs($admin)
        ->patch("/admin/dashboard/orders/{$order2->id}/status", ['status' => 'completed'])
        ->assertRedirect();

    expect((float) $inventory->fresh()->stock_quantity)->toBe(9.0);
});

test('marketplace endpoints expose remaining available stock before and after completion', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $inventory] = makeStockWorkflowSetup(15.0);

    // Customer browses featured, products, search, product detail, and store — all show 15
    $featured = $this->getJson('/api/v1/marketplace/featured')->assertOk();
    expect((float) $featured->json('data.0.stock_quantity'))->toBe(15.0);

    $browse = $this->getJson('/api/v1/marketplace/products')->assertOk();
    expect((float) $browse->json('data.data.0.stock_quantity'))->toBe(15.0);

    $search = $this->getJson('/api/v1/marketplace/products/search?q=Liempo')->assertOk();
    expect((float) $search->json('data.data.0.stock_quantity'))->toBe(15.0);

    $detail = $this->getJson("/api/v1/marketplace/products/{$product->id}")->assertOk();
    expect((float) $detail->json('data.stock_quantity'))->toBe(15.0)
        ->and((float) $detail->json('data.comparison_vendors.0.stock_quantity'))->toBe(15.0);

    $store = $this->getJson("/api/v1/marketplace/vendors/{$vendor->id}")->assertOk();
    expect((float) $store->json('data.products.0.stock_quantity'))->toBe(15.0);

    // Place order for 5 kg -> remains 15 until completed
    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 5.0],
    ], 'cash');

    $detailBeforeComplete = $this->getJson("/api/v1/marketplace/products/{$product->id}")->assertOk();
    expect((float) $detailBeforeComplete->json('data.stock_quantity'))->toBe(15.0);

    // Complete order -> remaining stock updates to 10
    app(OrderService::class)->updateOrderStatus($vendorUser, $order->id, 'completed');

    $detailAfterComplete = $this->getJson("/api/v1/marketplace/products/{$product->id}")->assertOk();
    expect((float) $detailAfterComplete->json('data.stock_quantity'))->toBe(10.0)
        ->and((float) $detailAfterComplete->json('data.comparison_vendors.0.stock_quantity'))->toBe(10.0);
});
