<?php

use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;

function makeReorderLimitSetup(float $stock = 50.0, float $reorderLevel = 5.0): array
{
    $customer = User::factory()->create(['is_active' => true]);
    $vendorUser = User::factory()->create(['is_active' => true]);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Bangus Corner',
        'stall_location' => 'Stall 4, Fish Section',
        'product_categories' => ['Fish'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Bangus',
        'category' => 'Fish',
        'price' => 150.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $inventory = Inventory::create([
        'vendor_id' => $vendor->id,
        'product_id' => $product->id,
        'stock_quantity' => $stock,
        'reorder_level' => $reorderLevel,
        'max_stock_level' => 50.0,
        'cost_price' => 110.00,
        'selling_price' => 150.00,
        'status' => 'active',
    ]);

    return [$customer, $vendor, $product, $inventory];
}

test('customer cannot place an order exceeding the set reorder level even if stock is higher', function () {
    [$customer, $vendor, $product, $inventory] = makeReorderLimitSetup(50.0, 5.0);

    // Ordering 6 kg when Reorder Level is 5 kg must fail even though 50 kg stock exists
    $this->actingAs($customer, 'sanctum')
        ->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 6.0],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonPath(
            'message',
            'You can only order up to 5 kg(s) of "Bangus" per order (reorder level limit: 5).',
        );

    expect((float) $inventory->fresh()->stock_quantity)->toBe(50.0);
});

test('customer can order up to the exact set reorder level', function () {
    [$customer, $vendor, $product] = makeReorderLimitSetup(50.0, 5.0);

    $res = $this->actingAs($customer, 'sanctum')
        ->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 5.0],
            ],
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.total_amount', '750.00');
});

test('marketplace endpoints expose reorder_level alongside stock_quantity for mobile enforcement', function () {
    [$customer, $vendor, $product] = makeReorderLimitSetup(50.0, 5.0);

    $featured = $this->getJson('/api/v1/marketplace/featured')->assertOk();
    expect((float) $featured->json('data.0.reorder_level'))->toBe(5.0);

    $detail = $this->getJson("/api/v1/marketplace/products/{$product->id}")->assertOk();
    expect((float) $detail->json('data.reorder_level'))->toBe(5.0)
        ->and((float) $detail->json('data.comparison_vendors.0.reorder_level'))->toBe(5.0);
});
