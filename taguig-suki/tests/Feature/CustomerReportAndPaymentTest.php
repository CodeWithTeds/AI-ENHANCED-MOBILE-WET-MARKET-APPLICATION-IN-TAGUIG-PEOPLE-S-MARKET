<?php

use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\CustomerReportService;
use App\Services\OrderService;

function makeReportSetup(): array
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
        'gcash_number' => '09123456789',
        'maya_number' => '09987654321',
    ]);
    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Beef',
        'category' => 'meat',
        'price' => 200.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);
    Inventory::create([
        'product_id' => $product->id,
        'vendor_id' => $vendor->id,
        'stock_quantity' => 100,
        'reorder_level' => 5,
        'selling_price' => 200.00,
        'cost_price' => 150.00,
        'status' => 'active',
    ]);
    return [$customer, $vendorUser, $vendor, $product];
}

test('customer can generate purchase report with date range and totals', function () {
    [$customer, $vendorUser, $vendor, $product] = makeReportSetup();
    $orderService = app(OrderService::class);
    $reportService = app(CustomerReportService::class);

    // Place two orders on different dates
    $order1 = $orderService->placeOrder($customer, [['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 0.5]], 'cash');
    $order2 = $orderService->placeOrder($customer, [['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1]], 'gcash', null, 'GCASHREF123');

    // Manually adjust created_at to be within known range for report (use DB to bypass fillable)
    \Illuminate\Support\Facades\DB::table('orders')->where('id', $order1->id)->update(['created_at' => now()->subDays(5), 'updated_at' => now()->subDays(5)]);
    \Illuminate\Support\Facades\DB::table('orders')->where('id', $order2->id)->update(['created_at' => now()->subDays(2), 'updated_at' => now()->subDays(2)]);

    $report = $reportService->getReport($customer, now()->subDays(10)->toDateString(), now()->toDateString());

    expect($report['summary']['total_orders'])->toBe(2);
    expect($report['summary']['total_spent'])->toBe(300.0); // 100 + 200
    expect($report['summary']['total_items_purchased'])->toBe(1.5);
    expect(count($report['orders']))->toBe(2);
    expect($report['orders'][0]['items'][0]['quantity'])->toBe(1.0); // newest first is order2 with 1 kg
    expect($report['payment_breakdown'])->not->toBeEmpty();
    expect($report['daily_spending'])->not->toBeEmpty();
});

test('customer report with custom date range filters correctly', function () {
    [$customer, $vendorUser, $vendor, $product] = makeReportSetup();
    $orderService = app(OrderService::class);
    $reportService = app(CustomerReportService::class);

    $orderOld = $orderService->placeOrder($customer, [['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1]], 'cash');
    $orderRecent = $orderService->placeOrder($customer, [['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 0.5]], 'cash');
    \Illuminate\Support\Facades\DB::table('orders')->where('id', $orderOld->id)->update(['created_at' => now()->subDays(20), 'updated_at' => now()->subDays(20)]);
    \Illuminate\Support\Facades\DB::table('orders')->where('id', $orderRecent->id)->update(['created_at' => now()->subDays(1), 'updated_at' => now()->subDays(1)]);

    // Report last 7 days should only include recent
    $report = $reportService->getReport($customer, now()->subDays(7)->toDateString(), now()->toDateString());
    expect($report['summary']['total_orders'])->toBe(1);
    expect($report['orders'][0]['id'])->toBe($orderRecent->id);
});

test('gcash order requires reference and creates pending_verification then vendor can verify', function () {
    [$customer, $vendorUser, $vendor, $product] = makeReportSetup();
    $service = app(OrderService::class);

    $order = $service->placeOrder($customer, [['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1]], 'gcash', null, 'REF123456');
    expect($order->payment_method)->toBe('gcash');
    expect($order->payment_status)->toBe('pending_verification');
    expect($order->payment_reference_number)->toBe('REF123456');

    // Vendor verifies
    $verified = $service->verifyPayment($vendorUser, $order->id, 'verify');
    expect($verified->payment_status)->toBe('paid');
    expect((float) $verified->payment_verified_by)->toBe((float) $vendorUser->id);
});

test('processing status is removed and confirm auto goes to ready', function () {
    [$customer, $vendorUser, $vendor, $product] = makeReportSetup();
    $service = app(OrderService::class);
    $order = $service->placeOrder($customer, [['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1]], 'cash');
    expect($order->status)->toBe('pending');

    // Try to set processing should fail
    try {
        $service->updateOrderStatus($vendorUser, $order->id, 'processing');
        $this->fail('Should have thrown for processing');
    } catch (Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException $e) {
        expect($e->getMessage())->toContain('Processing');
    }

    // Confirm should auto go to ready
    $service->updateOrderStatus($vendorUser, $order->id, 'confirmed');
    $order->refresh();
    expect($order->status)->toBe('ready');

    $history = \App\Models\OrderStatusHistory::where('order_id', $order->id)->orderBy('id')->pluck('status')->all();
    expect($history)->toBe(['pending', 'confirmed', 'ready']);
});
