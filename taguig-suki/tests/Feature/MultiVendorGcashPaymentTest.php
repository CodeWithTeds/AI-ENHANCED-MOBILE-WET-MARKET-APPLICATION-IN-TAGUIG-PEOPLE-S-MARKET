<?php

use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;

function setupMultiVendorEnv(): array
{
    $customer = User::factory()->create(['name' => 'Juan Customer', 'email' => 'juan@example.com']);

    $vendorUser1 = User::factory()->create(['name' => 'Mang Tomas']);
    $vendor1 = Vendor::create([
        'user_id' => $vendorUser1->id,
        'stall_name' => "Tomas Meat Shop",
        'stall_location' => 'Meat Section Stall 10',
        'product_categories' => ['meat'],
        'status' => 'approved',
        'approved_at' => now(),
        'gcash_number' => '09171111111',
    ]);

    $vendorUser2 = User::factory()->create(['name' => 'Aling Maria']);
    $vendor2 = Vendor::create([
        'user_id' => $vendorUser2->id,
        'stall_name' => "Maria Vegetables",
        'stall_location' => 'Vegetable Section Stall 5',
        'product_categories' => ['vegetables'],
        'status' => 'approved',
        'approved_at' => now(),
        'gcash_number' => '09172222222',
    ]);

    $pork = Product::create([
        'vendor_id' => $vendor1->id,
        'name' => 'Pork Belly',
        'category' => 'meat',
        'price' => 350.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);
    Inventory::create([
        'product_id' => $pork->id,
        'vendor_id' => $vendor1->id,
        'stock_quantity' => 50,
        'reorder_level' => 5,
        'selling_price' => 350.00,
        'cost_price' => 280.00,
        'status' => 'active',
    ]);

    $onions = Product::create([
        'vendor_id' => $vendor2->id,
        'name' => 'Red Onions',
        'category' => 'vegetables',
        'price' => 80.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);
    Inventory::create([
        'product_id' => $onions->id,
        'vendor_id' => $vendor2->id,
        'stock_quantity' => 100,
        'reorder_level' => 10,
        'selling_price' => 80.00,
        'cost_price' => 50.00,
        'status' => 'active',
    ]);

    return [$customer, $vendorUser1, $vendor1, $pork, $vendorUser2, $vendor2, $onions];
}

test('vendors payment details endpoint returns correct individual vendor subtotals', function () {
    [$customer, $vendorUser1, $vendor1, $pork, $vendorUser2, $vendor2, $onions] = setupMultiVendorEnv();
    $service = app(OrderService::class);

    $details = $service->getVendorsPaymentDetails(
        [$pork->id, $onions->id],
        [$pork->id => 2, $onions->id => 1.5]
    );

    expect(count($details))->toBe(2);

    $v1Details = collect($details)->firstWhere('vendor_id', $vendor1->id);
    $v2Details = collect($details)->firstWhere('vendor_id', $vendor2->id);

    expect($v1Details['stall_name'])->toBe('Tomas Meat Shop');
    expect($v1Details['subtotal'])->toBe(700.0); // 350 * 2
    expect($v1Details['gcash_number'])->toBe('09171111111');

    expect($v2Details['stall_name'])->toBe('Maria Vegetables');
    expect($v2Details['subtotal'])->toBe(120.0); // 80 * 1.5
    expect($v2Details['gcash_number'])->toBe('09172222222');
});

test('multi-vendor order records separate GCash references per vendor and vendor portions', function () {
    [$customer, $vendorUser1, $vendor1, $pork, $vendorUser2, $vendor2, $onions] = setupMultiVendorEnv();
    $service = app(OrderService::class);

    $order = $service->placeOrder(
        $customer,
        [
            ['product_id' => $pork->id, 'product_name' => $pork->name, 'quantity' => 1],
            ['product_id' => $onions->id, 'product_name' => $onions->name, 'quantity' => 0.5],
        ],
        'gcash',
        'Please deliver fresh',
        null,
        [
            ['vendor_id' => $vendor1->id, 'payment_reference_number' => 'GCASH-TOMAS-001'],
            ['vendor_id' => $vendor2->id, 'payment_reference_number' => 'GCASH-MARIA-002'],
        ]
    );

    expect((float) $order->total_amount)->toBe(390.0); // 350 + 40
    expect($order->payment_status)->toBe('pending_verification');

    $porkItem = $order->items->firstWhere('vendor_id', $vendor1->id);
    $onionItem = $order->items->firstWhere('vendor_id', $vendor2->id);

    expect($porkItem->payment_reference_number)->toBe('GCASH-TOMAS-001');
    expect($porkItem->payment_status)->toBe('pending_verification');
    expect($onionItem->payment_reference_number)->toBe('GCASH-MARIA-002');
    expect($onionItem->payment_status)->toBe('pending_verification');

    // Vendor portions attribute
    $portions = $order->vendor_portions;
    expect(count($portions))->toBe(2);

    $portion1 = collect($portions)->firstWhere('vendor_id', $vendor1->id);
    expect($portion1['subtotal'])->toBe(350.0);
    expect($portion1['payment_status'])->toBe('pending_verification');
    expect($portion1['payment_reference_number'])->toBe('GCASH-TOMAS-001');

    $portion2 = collect($portions)->firstWhere('vendor_id', $vendor2->id);
    expect($portion2['subtotal'])->toBe(40.0);
    expect($portion2['payment_status'])->toBe('pending_verification');
    expect($portion2['payment_reference_number'])->toBe('GCASH-MARIA-002');
});

test('vendor 1 verifying payment sets order to partially_paid without affecting vendor 2', function () {
    [$customer, $vendorUser1, $vendor1, $pork, $vendorUser2, $vendor2, $onions] = setupMultiVendorEnv();
    $service = app(OrderService::class);

    $order = $service->placeOrder(
        $customer,
        [
            ['product_id' => $pork->id, 'product_name' => $pork->name, 'quantity' => 1],
            ['product_id' => $onions->id, 'product_name' => $onions->name, 'quantity' => 0.5],
        ],
        'gcash',
        null,
        null,
        [
            ['vendor_id' => $vendor1->id, 'payment_reference_number' => 'GCASH-TOMAS-001'],
            ['vendor_id' => $vendor2->id, 'payment_reference_number' => 'GCASH-MARIA-002'],
        ]
    );

    // Vendor 1 verifies their own payment
    $service->verifyPayment($vendorUser1, $order->id, 'verify');

    $order->refresh();
    $porkItem = $order->items->firstWhere('vendor_id', $vendor1->id);
    $onionItem = $order->items->firstWhere('vendor_id', $vendor2->id);

    expect($porkItem->payment_status)->toBe('paid');
    expect($onionItem->payment_status)->toBe('pending_verification');
    expect($order->payment_status)->toBe('partially_paid');

    // Vendor 2 still sees order in their pending payments list
    $pendingV2 = $service->getVendorPendingPayments($vendorUser2);
    expect($pendingV2->contains('id', $order->id))->toBeTrue();

    // Vendor 1 no longer sees order in pending payments
    $pendingV1 = $service->getVendorPendingPayments($vendorUser1);
    expect($pendingV1->contains('id', $order->id))->toBeFalse();

    // Vendor 2 verifies their payment
    $service->verifyPayment($vendorUser2, $order->id, 'verify');
    $order->refresh();

    expect($order->payment_status)->toBe('paid');
    expect($order->fresh()->items->firstWhere('vendor_id', $vendor2->id)->payment_status)->toBe('paid');
});

test('customer can submit payment reference for a specific vendor portion', function () {
    [$customer, $vendorUser1, $vendor1, $pork, $vendorUser2, $vendor2, $onions] = setupMultiVendorEnv();
    $service = app(OrderService::class);

    // Place order without payment reference (unpaid)
    $order = $service->placeOrder(
        $customer,
        [
            ['product_id' => $pork->id, 'product_name' => $pork->name, 'quantity' => 1],
            ['product_id' => $onions->id, 'product_name' => $onions->name, 'quantity' => 1],
        ],
        'gcash',
        null,
        null
    );

    expect($order->payment_status)->toBe('unpaid');
    expect($order->items->firstWhere('vendor_id', $vendor1->id)->payment_status)->toBe('unpaid');
    expect($order->items->firstWhere('vendor_id', $vendor2->id)->payment_status)->toBe('unpaid');

    // Customer submits proof for Vendor 1 first
    $service->submitPaymentReference($customer, $order->id, 'GCASH-TOMAS-999', $vendor1->id);

    $order->refresh();
    expect($order->items->firstWhere('vendor_id', $vendor1->id)->payment_status)->toBe('pending_verification');
    expect($order->items->firstWhere('vendor_id', $vendor1->id)->payment_reference_number)->toBe('GCASH-TOMAS-999');
    expect($order->items->firstWhere('vendor_id', $vendor2->id)->payment_status)->toBe('unpaid');
    expect($order->payment_status)->toBe('pending_verification');

    // Customer submits proof for Vendor 2
    $service->submitPaymentReference($customer, $order->id, 'GCASH-MARIA-888', $vendor2->id);

    $order->refresh();
    expect($order->items->firstWhere('vendor_id', $vendor2->id)->payment_status)->toBe('pending_verification');
    expect($order->items->firstWhere('vendor_id', $vendor2->id)->payment_reference_number)->toBe('GCASH-MARIA-888');
});
