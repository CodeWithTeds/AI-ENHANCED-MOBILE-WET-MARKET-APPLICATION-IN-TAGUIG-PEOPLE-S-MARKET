<?php

namespace Tests\Feature\Api;

use App\Events\NewOrderMessageEvent;
use App\Events\OrderConfirmationUpdatedEvent;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\OrderConversation;
use App\Models\OrderItem;
use App\Models\OrderMessage;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class OrderChatMessagingTest extends TestCase
{
    use RefreshDatabase;

    private function createCustomer(): User
    {
        return User::factory()->create([
            'is_admin' => false,
            'is_active' => true,
        ]);
    }

    private function createVendor(string $stallName = 'Fresh Meat Stall'): array
    {
        $user = User::factory()->create([
            'is_admin' => false,
            'is_active' => true,
        ]);

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'stall_name' => $stallName,
            'stall_location' => 'Building A, Stall 12',
            'product_categories' => ['Meat'],
            'status' => 'approved',
        ]);

        return [$user, $vendor];
    }

    private function createProductWithStock(Vendor $vendor, string $name = 'Pork Belly', float $price = 320.00, float $stock = 10.0): array
    {
        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'category' => 'Meat',
            'price' => $price,
            'unit' => 'kg',
            'is_available' => true,
        ]);

        $inventory = Inventory::create([
            'vendor_id' => $vendor->id,
            'product_id' => $product->id,
            'stock_quantity' => $stock,
            'cost_price' => 280.00,
            'selling_price' => $price,
            'status' => 'active',
        ]);

        return [$product, $inventory];
    }

    public function test_placing_cod_order_initializes_conversation_and_sets_pending_confirmation(): void
    {
        Event::fake([NewOrderMessageEvent::class, OrderConfirmationUpdatedEvent::class]);

        $customer = $this->createCustomer();
        [$vendorUser, $vendor] = $this->createVendor();
        [$product, $inventory] = $this->createProductWithStock($vendor);

        $response = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'quantity' => 1.0,
                ],
            ],
            'notes' => 'Please give fresh cut',
        ]);

        $response->assertCreated();
        $orderId = $response->json('data.id');

        $order = Order::findOrFail($orderId);
        $this->assertEquals('pending_confirmation', $order->confirmation_status);

        $this->assertDatabaseHas('order_conversations', [
            'order_id' => $orderId,
            'vendor_id' => $vendor->id,
            'customer_id' => $customer->id,
            'confirmation_status' => 'pending_confirmation',
        ]);

        $this->assertDatabaseHas('order_messages', [
            'sender_type' => 'system',
            'message_type' => 'confirmation_request',
        ]);
    }

    public function test_vendor_can_request_order_confirmation_via_chat_with_broadcasting(): void
    {
        Event::fake([NewOrderMessageEvent::class, OrderConfirmationUpdatedEvent::class]);

        $customer = $this->createCustomer();
        [$vendorUser, $vendor] = $this->createVendor();
        [$product, $inventory] = $this->createProductWithStock($vendor);

        $orderResponse = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1.0],
            ],
        ]);
        $orderId = $orderResponse->json('data.id');

        // Vendor requests confirmation
        $response = $this->actingAs($vendorUser, 'sanctum')
            ->postJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat/request-confirmation");

        $response->assertOk()
            ->assertJsonPath('data.message_type', 'confirmation_request');

        Event::assertDispatched(NewOrderMessageEvent::class, function ($event) use ($orderId, $vendor) {
            return $event->orderId === $orderId && $event->vendorId === $vendor->id;
        });

        Event::assertDispatched(OrderConfirmationUpdatedEvent::class, function ($event) use ($orderId, $vendor) {
            return $event->orderId === $orderId &&
                   $event->vendorId === $vendor->id &&
                   $event->confirmationStatus === 'pending_confirmation';
        });

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $orderId,
            'note' => "Vendor {$vendor->stall_name} requested customer confirmation before preparing COD items.",
        ]);
    }

    public function test_customer_can_confirm_order_through_chat_with_realtime_broadcasting(): void
    {
        Event::fake([NewOrderMessageEvent::class, OrderConfirmationUpdatedEvent::class]);

        $customer = $this->createCustomer();
        [$vendorUser, $vendor] = $this->createVendor();
        [$product, $inventory] = $this->createProductWithStock($vendor);

        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => Order::generateOrderNumber(),
            'status' => 'pending',
            'confirmation_status' => 'pending_confirmation',
            'total_amount' => 320.00,
            'payment_method' => 'cash',
            'payment_status' => 'unpaid',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'vendor_id' => $vendor->id,
            'product_name' => $product->name,
            'category' => 'Meat',
            'unit' => 'kg',
            'quantity' => 1.0,
            'unit_price' => 320.00,
            'subtotal' => 320.00,
            'status' => 'pending',
            'confirmation_status' => 'pending_confirmation',
        ]);

        $response = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/vendors/{$vendor->id}/chat/confirm", [
                'note' => 'Confirmed, will pick up at 11 AM.',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'confirmed');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'confirmed',
            'confirmation_status' => 'confirmed',
            'confirmed_by' => $customer->id,
        ]);

        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'vendor_id' => $vendor->id,
            'status' => 'confirmed',
            'confirmation_status' => 'confirmed',
        ]);

        Event::assertDispatched(OrderConfirmationUpdatedEvent::class, function ($event) use ($order) {
            return $event->orderId === $order->id && $event->confirmationStatus === 'confirmed';
        });

        Event::assertDispatched(NewOrderMessageEvent::class, function ($event) use ($order) {
            return $event->orderId === $order->id && $event->messageData['message_type'] === 'order_confirmed';
        });
    }

    public function test_customer_can_cancel_order_through_chat_and_restores_inventory(): void
    {
        Event::fake([NewOrderMessageEvent::class, OrderConfirmationUpdatedEvent::class]);

        $customer = $this->createCustomer();
        [$vendorUser, $vendor] = $this->createVendor();
        [$product, $inventory] = $this->createProductWithStock($vendor, 'Pork Chop', 300.00, 10.0);

        // Place order (deducts 2 kg)
        $orderResponse = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 2.0],
            ],
        ]);
        $orderId = $orderResponse->json('data.id');

        $this->assertEquals(8.0, (float) $inventory->fresh()->stock_quantity);

        // Customer cancels order via chat
        $cancelResponse = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat/cancel", [
                'reason' => 'Changed my mind, will reorder tomorrow',
            ]);

        $cancelResponse->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        // Verify stock is restored to 10.0 kg!
        $this->assertEquals(10.0, (float) $inventory->fresh()->stock_quantity);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => 'cancelled',
            'confirmation_status' => 'cancelled',
        ]);

        Event::assertDispatched(OrderConfirmationUpdatedEvent::class, function ($event) use ($orderId) {
            return $event->orderId === $orderId && $event->confirmationStatus === 'cancelled';
        });
    }

    public function test_customer_and_vendor_can_exchange_messages_and_track_read_status(): void
    {
        Event::fake([NewOrderMessageEvent::class]);

        $customer = $this->createCustomer();
        [$vendorUser, $vendor] = $this->createVendor();
        [$product, $inventory] = $this->createProductWithStock($vendor);

        $orderResponse = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1.0],
            ],
        ]);
        $orderId = $orderResponse->json('data.id');

        // Customer sends clarification
        $msg1 = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat/messages", [
                'message' => 'Can you please slice the pork into cubes for menudo?',
            ]);

        $msg1->assertCreated()
            ->assertJsonPath('data.sender_type', 'customer')
            ->assertJsonPath('data.is_read', false);

        // Vendor checks chat -> marks messages as read
        $vendorChat = $this->actingAs($vendorUser, 'sanctum')
            ->getJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat");

        $vendorChat->assertOk();

        // Vendor replies
        $msg2 = $this->actingAs($vendorUser, 'sanctum')
            ->postJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat/messages", [
                'message' => 'Sure po! Menudo cut will be prepared freshly for you.',
            ]);

        $msg2->assertCreated()
            ->assertJsonPath('data.sender_type', 'vendor');

        // Unread count for customer should be 1
        $unreadCustomer = $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/chats/unread');

        $unreadCustomer->assertOk()
            ->assertJsonPath('data.unread_count', 1);

        // Customer views chat -> marks as read
        $this->actingAs($customer, 'sanctum')
            ->getJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat");

        $unreadCustomerAfter = $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/chats/unread');

        $unreadCustomerAfter->assertOk()
            ->assertJsonPath('data.unread_count', 0);
    }

    public function test_unauthorized_users_cannot_access_chat(): void
    {
        $customer1 = $this->createCustomer();
        $customer2 = $this->createCustomer();
        [$vendorUser1, $vendor1] = $this->createVendor('Stall 1');
        [$vendorUser2, $vendor2] = $this->createVendor('Stall 2');
        [$product, $inventory] = $this->createProductWithStock($vendor1);

        // Guest check first before actingAs
        $this->getJson("/api/v1/orders/1/vendors/{$vendor1->id}/chat")
            ->assertUnauthorized();

        $orderResponse = $this->actingAs($customer1, 'sanctum')->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1.0],
            ],
        ]);
        $orderId = $orderResponse->json('data.id');

        // Customer 2 tries to access Customer 1's chat -> 403 Forbidden
        $this->actingAs($customer2, 'sanctum')
            ->getJson("/api/v1/orders/{$orderId}/vendors/{$vendor1->id}/chat")
            ->assertForbidden();

        // Vendor 2 (not belonging to this order) tries to access -> 403 Forbidden
        $this->actingAs($vendorUser2, 'sanctum')
            ->getJson("/api/v1/orders/{$orderId}/vendors/{$vendor1->id}/chat")
            ->assertForbidden();
    }

    public function test_chat_history_is_retained_in_database_for_dispute_resolution(): void
    {
        $customer = $this->createCustomer();
        [$vendorUser, $vendor] = $this->createVendor();
        [$product, $inventory] = $this->createProductWithStock($vendor);

        $orderResponse = $this->actingAs($customer, 'sanctum')->postJson('/api/v1/orders', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1.0],
            ],
        ]);
        $orderId = $orderResponse->json('data.id');

        // Customer sends a message
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat/messages", [
                'message' => 'Please include extra fat portion.',
            ]);

        // Complete order
        $order = Order::findOrFail($orderId);
        $order->update(['status' => 'completed']);

        // Chat history is still fully preserved
        $chat = $this->actingAs($customer, 'sanctum')
            ->getJson("/api/v1/orders/{$orderId}/vendors/{$vendor->id}/chat");

        $chat->assertOk()
            ->assertJsonPath('data.messages.1.message', 'Please include extra fat portion.');
    }
}
