<?php

use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;

function makeKgSetup(): array
{
    $customer = User::factory()->create();
    $vendorUser = User::factory()->create();
    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Test Stall',
        'stall_location' => 'Stall 1',
        'product_categories' => ['meat'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);
    $productKg = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Beef',
        'category' => 'meat',
        'price' => 200.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);
    $productPcs = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Egg',
        'category' => 'dairy',
        'price' => 10.00,
        'unit' => 'pcs',
        'is_available' => true,
    ]);
    $invKg = Inventory::create([
        'product_id' => $productKg->id,
        'vendor_id' => $vendor->id,
        'stock_quantity' => 10,
        'reorder_level' => 2,
        'selling_price' => 200.00,
        'cost_price' => 150.00,
        'status' => 'active',
    ]);
    $invPcs = Inventory::create([
        'product_id' => $productPcs->id,
        'vendor_id' => $vendor->id,
        'stock_quantity' => 20,
        'reorder_level' => 5,
        'selling_price' => 10.00,
        'cost_price' => 7.00,
        'status' => 'active',
    ]);
    return [$customer, $vendorUser, $vendor, $productKg, $productPcs, $invKg, $invPcs];
}

test('customer can order 0.5 kg and price is half', function () {
    [$customer, $vendorUser, $vendor, $productKg, $productPcs, $invKg, $invPcs] = makeKgSetup();
    $service = app(OrderService::class);
    $order = $service->placeOrder($customer, [
        ['product_id' => $productKg->id, 'product_name' => $productKg->name, 'quantity' => 0.5],
    ], 'cash');

    expect($order->total_amount)->toBe('100.00');
    expect((float) $order->items->first()->quantity)->toBe(0.5);
    expect((float) $order->items->first()->subtotal)->toBe(100.0);
    $invKg->refresh();
    expect((float) $invKg->stock_quantity)->toBe(9.5);
});

test('customer can order 1 kg and 0.5 kg increments work', function () {
    [$customer, $vendorUser, $vendor, $productKg, $productPcs, $invKg, $invPcs] = makeKgSetup();
    $service = app(OrderService::class);
    $order = $service->placeOrder($customer, [
        ['product_id' => $productKg->id, 'product_name' => $productKg->name, 'quantity' => 1],
    ], 'cash');
    expect((float) $order->items->first()->quantity)->toBe(1.0);
    expect($order->total_amount)->toBe('200.00');

    $order2 = $service->placeOrder($customer, [
        ['product_id' => $productKg->id, 'product_name' => $productKg->name, 'quantity' => 1.5],
    ], 'cash');
    expect((float) $order2->items->first()->quantity)->toBe(1.5);
    expect($order2->total_amount)->toBe('300.00');
});

test('kg product with 0.7 fails', function () {
    [$customer, $vendorUser, $vendor, $productKg, $productPcs, $invKg, $invPcs] = makeKgSetup();
    $service = app(OrderService::class);
    $this->expectException(Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException::class);
    $service->placeOrder($customer, [
        ['product_id' => $productKg->id, 'product_name' => $productKg->name, 'quantity' => 0.7],
    ], 'cash');
});

test('pcs product with 0.5 fails', function () {
    [$customer, $vendorUser, $vendor, $productKg, $productPcs, $invKg, $invPcs] = makeKgSetup();
    $service = app(OrderService::class);
    $this->expectException(Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException::class);
    $service->placeOrder($customer, [
        ['product_id' => $productPcs->id, 'product_name' => $productPcs->name, 'quantity' => 0.5],
    ], 'cash');
});

test('pcs product with integer passes', function () {
    [$customer, $vendorUser, $vendor, $productKg, $productPcs, $invKg, $invPcs] = makeKgSetup();
    $service = app(OrderService::class);
    $order = $service->placeOrder($customer, [
        ['product_id' => $productPcs->id, 'product_name' => $productPcs->name, 'quantity' => 2],
    ], 'cash');
    expect((float) $order->items->first()->quantity)->toBe(2.0);
    expect($order->total_amount)->toBe('20.00');
    $invPcs->refresh();
    expect((float) $invPcs->stock_quantity)->toBe(18.0);
});

test('inventory deduction handles 0.5 correctly for multiple orders', function () {
    [$customer, $vendorUser, $vendor, $productKg, $productPcs, $invKg, $invPcs] = makeKgSetup();
    $service = app(OrderService::class);
    $service->placeOrder($customer, [['product_id' => $productKg->id, 'product_name' => $productKg->name, 'quantity' => 0.5]], 'cash');
    $service->placeOrder($customer, [['product_id' => $productKg->id, 'product_name' => $productKg->name, 'quantity' => 1]], 'cash');
    $invKg->refresh();
    expect((float) $invKg->stock_quantity)->toBe(8.5);
});
