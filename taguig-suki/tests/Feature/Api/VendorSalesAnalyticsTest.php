<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Laravel\Sanctum\Sanctum;

test('vendor sales endpoint returns correct revenue and completed transactions', function () {
    $vendorUser = User::factory()->create(['name' => 'Vendor Maria']);
    $customerUser = User::factory()->create(['name' => 'Customer Juan']);

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Maria Veggies',
        'stall_location' => 'Stall 4A',
        'product_categories' => ['vegetables'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Talong',
        'description' => 'Fresh eggplant',
        'category' => 'Vegetables',
        'price' => 50.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $order = Order::create([
        'user_id' => $customerUser->id,
        'order_number' => 'ORD-TEST-0001',
        'status' => 'completed',
        'total_amount' => 150.00,
        'payment_method' => 'gcash',
        'notes' => 'Deliver fresh please',
    ]);

    OrderItem::create([
        'order_id' => $order->id,
        'product_id' => $product->id,
        'vendor_id' => $vendor->id,
        'product_name' => 'Talong',
        'category' => 'Vegetables',
        'unit' => 'kg',
        'quantity' => 3,
        'unit_price' => 50.00,
        'subtotal' => 150.00,
    ]);

    Sanctum::actingAs($vendorUser);

    $response = $this->getJson('/api/v1/vendor/sales');

    $response->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.summary.total_revenue', 150)
        ->assertJsonPath('data.summary.completed_orders_count', 1)
        ->assertJsonPath('data.summary.total_units_sold', 3)
        ->assertJsonPath('data.summary.average_order_value', 150)
        ->assertJsonPath('data.top_products.0.product_name', 'Talong')
        ->assertJsonPath('data.completed_transactions.0.order_number', 'ORD-TEST-0001')
        ->assertJsonPath('data.completed_transactions.0.customer_name', 'Customer Juan')
        ->assertJsonPath('data.completed_transactions.0.vendor_subtotal', 150);
});
