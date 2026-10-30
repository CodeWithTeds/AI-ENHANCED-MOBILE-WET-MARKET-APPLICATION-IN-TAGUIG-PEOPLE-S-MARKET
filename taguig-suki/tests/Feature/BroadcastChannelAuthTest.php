<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BroadcastChannelAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test-app',
        ]);

        \Illuminate\Support\Facades\Broadcast::purge();
        require base_path('routes/channels.php');
    }

    public function test_customer_can_authenticate_for_their_order_channel(): void
    {
        $customer = User::factory()->create(['is_admin' => false]);
        $otherCustomer = User::factory()->create(['is_admin' => false]);

        $vendorUser = User::factory()->create(['is_admin' => false]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'stall_name' => 'Stall 1',
            'stall_location' => 'Section A',
            'product_categories' => ['Meat'],
            'status' => 'approved',
        ]);

        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => Order::generateOrderNumber(),
            'status' => 'pending',
            'total_amount' => 100.00,
            'payment_method' => 'cash',
        ]);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Meat',
            'category' => 'Meat',
            'price' => 100.00,
            'unit' => 'kg',
            'is_available' => true,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'vendor_id' => $vendor->id,
            'product_name' => 'Meat',
            'category' => 'Meat',
            'unit' => 'kg',
            'quantity' => 1.0,
            'unit_price' => 100.00,
            'subtotal' => 100.00,
            'status' => 'pending',
        ]);

        // Customer of order is authorized -> 200 OK
        $response = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/broadcasting/auth', [
            'channel_name' => "private-orders.{$order->id}.vendor.{$vendor->id}",
            'socket_id' => '1234.5678',
        ]);
        $response->assertOk();

        // Vendor of order is authorized -> 200 OK
        $vendorResponse = $this->actingAs($vendorUser, 'sanctum')->postJson('/api/v1/broadcasting/auth', [
            'channel_name' => "private-orders.{$order->id}.vendor.{$vendor->id}",
            'socket_id' => '1234.5678',
        ]);
        $vendorResponse->assertOk();

        // Other customer is forbidden -> 403 Forbidden
        $otherResponse = $this->actingAs($otherCustomer, 'sanctum')->postJson('/api/v1/broadcasting/auth', [
            'channel_name' => "private-orders.{$order->id}.vendor.{$vendor->id}",
            'socket_id' => '1234.5678',
        ]);
        $otherResponse->assertForbidden();
    }
}
