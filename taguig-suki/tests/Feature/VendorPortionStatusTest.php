<?php

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;

function makeTwoVendorSetup(): array
{
    $customer = User::factory()->create(['name' => 'Sari Customer', 'email' => 'sari@example.com']);

    $vendorUser1 = User::factory()->create(['name' => 'Gulay Vendor']);
    $vendor1 = Vendor::create([
        'user_id' => $vendorUser1->id,
        'stall_name' => 'Gulay Store',
        'stall_location' => 'Stall 1, Vegetable Section',
        'product_categories' => ['vegetables'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $vendorUser2 = User::factory()->create(['name' => 'Karne Vendor']);
    $vendor2 = Vendor::create([
        'user_id' => $vendorUser2->id,
        'stall_name' => 'Karne Store',
        'stall_location' => 'Stall 2, Meat Section',
        'product_categories' => ['meat'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $veg = Product::create([
        'vendor_id' => $vendor1->id,
        'name' => 'Kangkong',
        'description' => 'Fresh kangkong',
        'category' => 'Vegetables',
        'price' => 40.00,
        'unit' => 'bundle',
        'is_available' => true,
    ]);

    $pork = Product::create([
        'vendor_id' => $vendor2->id,
        'name' => 'Pork',
        'description' => 'Fresh pork',
        'category' => 'Meat',
        'price' => 300.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $veg->id, 'product_name' => 'Kangkong', 'quantity' => 2],
        ['product_id' => $pork->id, 'product_name' => 'Pork', 'quantity' => 1],
    ], 'cash');

    return [$customer, $vendorUser1, $vendor1, $vendorUser2, $vendor2, $order];
}

function portionOf(Order $order, int $vendorId): string
{
    return $order->items->firstWhere('vendor_id', $vendorId)->status;
}

test('vendors advance only their own portion; overall follows the slowest portion', function () {
    [$customer, $vendorUser1, $vendor1, $vendorUser2, $vendor2, $order] = makeTwoVendorSetup();
    $service = app(OrderService::class);

    // Both portions start pending under one shared order number
    expect(portionOf($order, $vendor1->id))->toBe('pending')
        ->and(portionOf($order, $vendor2->id))->toBe('pending')
        ->and($order->status)->toBe('pending');

    // Vendor 1 confirms → their portion jumps to ready; vendor 2 untouched; overall still pending
    $service->updateOrderStatus($vendorUser1, $order->id, 'confirmed');
    $order->refresh();
    expect(portionOf($order, $vendor1->id))->toBe('ready')
        ->and(portionOf($order, $vendor2->id))->toBe('pending')
        ->and($order->fresh()->status)->toBe('pending');

    // Vendor 1 completes → still must not drag vendor 2 or the overall order along
    $service->updateOrderStatus($vendorUser1, $order->id, 'completed');
    expect(portionOf($order->fresh(), $vendor1->id))->toBe('completed')
        ->and(portionOf($order->fresh(), $vendor2->id))->toBe('pending')
        ->and($order->fresh()->status)->toBe('pending');

    // Vendor 2 confirms → overall becomes ready only now (all portions ready+)
    $service->updateOrderStatus($vendorUser2, $order->id, 'confirmed');
    expect(portionOf($order->fresh(), $vendor2->id))->toBe('ready')
        ->and($order->fresh()->status)->toBe('ready');

    // Vendor 2 completes → overall completed only when every portion is done
    $service->updateOrderStatus($vendorUser2, $order->id, 'completed');
    expect($order->fresh()->status)->toBe('completed');
});

test('single-vendor order keeps the old confirm-to-ready behavior', function () {
    [$customer, $vendorUser1, $vendor1] = array_slice(makeTwoVendorSetup(), 0, 3);
    $service = app(OrderService::class);

    $veg = Product::where('vendor_id', $vendor1->id)->first();
    $order = $service->placeOrder($customer, [
        ['product_id' => $veg->id, 'product_name' => 'Kangkong', 'quantity' => 1],
    ], 'cash');

    $service->updateOrderStatus($vendorUser1, $order->id, 'confirmed');
    expect($order->fresh()->status)->toBe('ready');

    $service->updateOrderStatus($vendorUser1, $order->id, 'completed');
    expect($order->fresh()->status)->toBe('completed');
});
