<?php

use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;

function makeOutOfStockSetup(): array
{
    $customer = User::factory()->create(['is_active' => true]);
    $vendorUser = User::factory()->create(['is_active' => true]);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Pedro Meat Stall',
        'stall_location' => 'Stall 1, Meat Section',
        'product_categories' => ['Meat'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Whole Chicken',
        'description' => 'Fresh dressed chicken',
        'category' => 'Meat',
        'price' => 150.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $inventory = Inventory::create([
        'vendor_id' => $vendor->id,
        'product_id' => $product->id,
        'stock_quantity' => 0.0,
        'reorder_level' => 5.0,
        'cost_price' => 110.00,
        'selling_price' => 150.00,
        'status' => 'active',
    ]);

    return [$customer, $vendor, $product, $inventory];
}

test('zero stock products immediately flag is_out_of_stock across all marketplace endpoints', function () {
    [$customer, $vendor, $product, $inventory] = makeOutOfStockSetup();

    // Featured
    $featured = $this->getJson('/api/v1/marketplace/featured')->assertOk();
    expect($featured->json('data.0.is_out_of_stock'))->toBeTrue()
        ->and($featured->json('data.0.is_available'))->toBeFalse()
        ->and((float) $featured->json('data.0.stock_quantity'))->toBe(0.0);

    // Browse
    $browse = $this->getJson('/api/v1/marketplace/products')->assertOk();
    expect($browse->json('data.data.0.is_out_of_stock'))->toBeTrue()
        ->and($browse->json('data.data.0.is_available'))->toBeFalse();

    // Search
    $search = $this->getJson('/api/v1/marketplace/products/search?q=Chicken')->assertOk();
    expect($search->json('data.data.0.is_out_of_stock'))->toBeTrue()
        ->and($search->json('data.data.0.is_available'))->toBeFalse();

    // Detail + comparison vendors
    $detail = $this->getJson("/api/v1/marketplace/products/{$product->id}")->assertOk();
    expect($detail->json('data.is_out_of_stock'))->toBeTrue()
        ->and($detail->json('data.is_available'))->toBeFalse()
        ->and($detail->json('data.comparison_vendors.0.is_out_of_stock'))->toBeTrue()
        ->and($detail->json('data.comparison_vendors.0.is_available'))->toBeFalse();

    // Vendor store
    $store = $this->getJson("/api/v1/marketplace/vendors/{$vendor->id}")->assertOk();
    expect($store->json('data.products.0.is_out_of_stock'))->toBeTrue()
        ->and($store->json('data.products.0.is_available'))->toBeFalse();
});

test('placing an order on an out-of-stock product is rejected with 422', function () {
    [$customer, $vendor, $product] = makeOutOfStockSetup();

    $this->actingAs($customer, 'sanctum')
        ->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1.0],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', "\"{$product->name}\" is currently out of stock.");
});

test('restocking zero-stock product clears is_out_of_stock and re-enables ordering', function () {
    [$customer, $vendor, $product, $inventory] = makeOutOfStockSetup();

    $inventory->update(['stock_quantity' => 15.0]);

    $detail = $this->getJson("/api/v1/marketplace/products/{$product->id}")->assertOk();
    expect($detail->json('data.is_out_of_stock'))->toBeFalse()
        ->and($detail->json('data.is_available'))->toBeTrue()
        ->and((float) $detail->json('data.stock_quantity'))->toBe(15.0);
});
