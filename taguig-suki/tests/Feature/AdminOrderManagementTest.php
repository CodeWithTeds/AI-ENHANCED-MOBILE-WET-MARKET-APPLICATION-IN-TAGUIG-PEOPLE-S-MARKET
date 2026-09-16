<?php

use App\Models\Inventory;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;
use Inertia\Testing\AssertableInertia as Assert;

/* Same transaction-based setup as OrderInventoryDeductionTest: everything is
 * rolled back afterwards; the real database is never modified. */

function makeOrderSetup(): array
{
    $admin = User::factory()->create(['name' => 'Admin Tester', 'is_admin' => true]);
    $customer = User::factory()->create(['name' => 'Maria Santos', 'email' => 'maria@example.com']);
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

    Inventory::create([
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

    $order = app(OrderService::class)->placeOrder($customer, [
        ['product_id' => $product->id, 'product_name' => 'Bangus', 'quantity' => 2],
    ], 'gcash', 'Resolve at counter');

    return [$admin, $customer, $vendorUser, $vendor, $product, $order];
}

test('admin order management lists customer orders with details and stats', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $order] = makeOrderSetup();

    $this->actingAs($admin)
        ->get('/admin/dashboard/orders')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/orders/index')
            ->where('stats.total', 1)
            ->where('stats.pending', 1)
            ->where('stats.in_progress', 0)
            ->where('stats.completed', 0)
            ->where('stats.cancelled', 0)
            ->where('orders.data.0.order_number', $order->order_number)
            ->where('orders.data.0.status', 'pending')
            ->where('orders.data.0.total_amount', '360.00')
            ->where('orders.data.0.payment_method', 'gcash')
            ->where('orders.data.0.customer.name', 'Maria Santos')
            ->where('orders.data.0.customer.email', 'maria@example.com')
            ->where('orders.data.0.item_count', 1)
            ->where('orders.data.0.vendors.0', 'Aling Rosa Fresh Fish')
            ->where('orders.data.0.items.0.product_name', 'Bangus')
            ->where('orders.data.0.items.0.quantity', fn ($v) => (float) $v === 2.0)
            ->where('orders.data.0.status_history.0.status', 'pending')
        );
});

test('orders can be searched and filtered by status and payment method', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $first] = makeOrderSetup();

    // Second order, cash payment, different customer
    $otherCustomer = User::factory()->create(['name' => 'Juan Dela Cruz', 'email' => 'juan@example.com']);
    $second = app(OrderService::class)->placeOrder($otherCustomer, [
        ['product_id' => $product->id, 'product_name' => 'Bangus', 'quantity' => 1],
    ], 'cash');

    // Search by order number
    $this->actingAs($admin)
        ->get('/admin/dashboard/orders?search='.$second->order_number)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('stats.total', 2)
            ->where('orders.data.0.order_number', $second->order_number)
            ->where('orders.data.0.customer.name', 'Juan Dela Cruz')
        );

    // Search by customer name
    $this->actingAs($admin)
        ->get('/admin/dashboard/orders?search=Maria')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('orders.data.0.customer.name', 'Maria Santos')
            ->where('orders.total', 1)
        );

    // Filter by payment method
    $this->actingAs($admin)
        ->get('/admin/dashboard/orders?payment_method=cash')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('orders.data.0.payment_method', 'cash')
            ->where('orders.total', 1)
        );

    // Filter by status
    $this->actingAs($admin)
        ->get('/admin/dashboard/orders?status=completed')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('orders.total', 0)
            ->where('stats.total', 2)
            ->where('stats.completed', 0)
        );
});

test('admin resolves an order status and it is recorded in the timeline', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $order] = makeOrderSetup();

    $this->actingAs($admin)
        ->patch("/admin/dashboard/orders/{$order->id}/status", ['status' => 'confirmed'])
        ->assertRedirect();

    $order->refresh();
    expect($order->status)->toBe('confirmed');

    $this->actingAs($admin)
        ->patch("/admin/dashboard/orders/{$order->id}/status", ['status' => 'cancelled'])
        ->assertRedirect();

    $order->refresh();
    expect($order->status)->toBe('cancelled');

    $timeline = OrderStatusHistory::where('order_id', $order->id)->orderBy('id')->pluck('status')->all();
    expect($timeline)->toBe(['pending', 'confirmed', 'cancelled']);

    // Admin page reflects the resolution
    $this->actingAs($admin)
        ->get('/admin/dashboard/orders?status=cancelled')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('stats.cancelled', 1)
            ->where('orders.data.0.status', 'cancelled')
            ->where('orders.data.0.status_history.2.status', 'cancelled')
        );
});

test('invalid order status updates are rejected', function () {
    [$admin, $customer, $vendorUser, $vendor, $product, $order] = makeOrderSetup();

    $this->actingAs($admin)
        ->patch("/admin/dashboard/orders/{$order->id}/status", ['status' => 'delivered'])
        ->assertSessionHasErrors('status');

    $order->refresh();
    expect($order->status)->toBe('pending');
});

test('guests cannot access admin order management', function () {
    $this->get('/admin/dashboard/orders')
        ->assertRedirect(route('login'));
});
