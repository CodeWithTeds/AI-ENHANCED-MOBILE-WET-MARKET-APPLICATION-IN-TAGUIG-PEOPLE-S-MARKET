<?php

namespace App\Services;

use App\Events\NewOrderMessageEvent;
use App\Events\OrderConfirmationUpdatedEvent;
use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderConversation;
use App\Models\OrderItem;
use App\Models\OrderMessage;
use App\Models\OrderStatusHistory;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class OrderChatService
{
    public function __construct(private readonly OrderService $orderService) {}

    /**
     * Get or create a conversation linked to a specific order and vendor.
     */
    public function getOrCreateConversation(int $orderId, int $vendorId, User $user): OrderConversation
    {
        $order = Order::with(['items.vendor', 'user'])->findOrFail($orderId);
        $vendor = Vendor::findOrFail($vendorId);

        // Verify this vendor actually has items in this order
        $hasItems = $order->items->contains('vendor_id', $vendorId);
        if (!$hasItems) {
            throw new NotFoundHttpException("Vendor #{$vendorId} does not have any items in Order #{$orderId}.");
        }

        // Verify authorization
        $this->authorizeAccess($user, $order, $vendorId);

        // Find or create conversation
        $conversation = OrderConversation::firstOrCreate(
            [
                'order_id' => $order->id,
                'vendor_id' => $vendor->id,
                'customer_id' => $order->user_id,
            ],
            [
                'confirmation_status' => $order->confirmation_status !== 'not_required'
                    ? $order->confirmation_status
                    : 'none',
                'last_message_at' => now(),
            ]
        );

        return $conversation->load([
            'order:id,order_number,status,confirmation_status,total_amount,payment_method,payment_status,created_at',
            'vendor:id,stall_name,stall_location,user_id',
            'customer:id,name,email',
        ]);
    }

    /**
     * Get conversation and its full message history.
     */
    public function getConversation(User $user, int $orderId, int $vendorId): OrderConversation
    {
        $conversation = $this->getOrCreateConversation($orderId, $vendorId, $user);

        // Load full message history with sender details
        $conversation->load([
            'messages' => fn ($q) => $q->with('sender:id,name,email')->orderBy('created_at', 'asc'),
        ]);

        // Mark counterparty messages as read
        $conversation->markAsReadFor($user);

        return $conversation;
    }

    /**
     * Get all conversations for an order accessible by the user.
     */
    public function getConversationsForOrder(User $user, int $orderId): Collection
    {
        $order = Order::with(['items.vendor', 'user'])->findOrFail($orderId);

        if (!$user->isAdmin() && (int) $order->user_id !== (int) $user->id) {
            $userVendor = $user->vendor;
            if (!$userVendor || !$order->items->contains('vendor_id', $userVendor->id)) {
                throw new AccessDeniedHttpException('You are not authorized to access conversations for this order.');
            }
        }

        // Distinct vendor IDs with items in this order
        $vendorIds = $order->items->pluck('vendor_id')->unique()->filter()->values();

        // If user is a vendor, restrict only to their own vendor ID
        if (!$user->isAdmin() && (int) $order->user_id !== (int) $user->id) {
            $userVendor = $user->vendor;
            $vendorIds = $vendorIds->filter(fn ($vId) => (int) $vId === (int) $userVendor->id)->values();
        }

        $conversations = collect();
        foreach ($vendorIds as $vId) {
            try {
                $conv = $this->getOrCreateConversation($order->id, (int) $vId, $user);
                $conv->load(['latestMessage.sender:id,name', 'vendor:id,stall_name,stall_location']);
                $conv->unread_count = $conv->unreadCountFor($user);
                $conversations->push($conv);
            } catch (\Throwable $e) {
                Log::warning("Could not load conversation for order {$orderId} vendor {$vId}: " . $e->getMessage());
            }
        }

        return $conversations;
    }

    /**
     * Send a message in the order chat.
     */
    public function sendMessage(
        User $user,
        int $orderId,
        int $vendorId,
        string $messageText,
        string $messageType = 'text',
        ?array $metadata = null
    ): OrderMessage {
        $conversation = $this->getOrCreateConversation($orderId, $vendorId, $user);
        $order = $conversation->order;

        $trimmed = trim($messageText);
        if ($trimmed === '' && $messageType === 'text') {
            throw new UnprocessableEntityHttpException('Message text cannot be empty.');
        }

        $senderType = $this->determineSenderType($user, $conversation);
        $recipientUserId = $this->determineRecipientUserId($conversation, $senderType);

        $message = DB::transaction(function () use ($conversation, $user, $senderType, $trimmed, $messageType, $metadata) {
            $msg = OrderMessage::create([
                'order_conversation_id' => $conversation->id,
                'sender_id' => $user->id,
                'sender_type' => $senderType,
                'message' => $trimmed,
                'message_type' => $messageType,
                'metadata' => $metadata,
                'is_read' => false,
            ]);

            $conversation->update(['last_message_at' => now()]);

            return $msg;
        });

        $message->load('sender:id,name,email');

        // Broadcast to both customer and vendor via Laravel Broadcasting
        $this->broadcastSafely(new NewOrderMessageEvent(
            $message,
            $orderId,
            $vendorId,
            $recipientUserId
        ));

        return $message;
    }

    /**
     * Vendor requests order confirmation from customer before preparing fresh items.
     */
    public function requestOrderConfirmation(User $user, int $orderId, int $vendorId): OrderMessage
    {
        $conversation = $this->getOrCreateConversation($orderId, $vendorId, $user);
        $order = Order::with('items')->findOrFail($orderId);
        $vendor = Vendor::findOrFail($vendorId);

        // Only vendor or admin can request confirmation
        if (!$user->isAdmin()) {
            $userVendor = $user->vendor;
            if (!$userVendor || (int) $userVendor->id !== (int) $vendorId) {
                throw new AccessDeniedHttpException('Only the vendor can request order confirmation.');
            }
        }

        if ($order->status === 'cancelled') {
            throw new UnprocessableEntityHttpException('Cannot request confirmation for a cancelled order.');
        }

        if ($order->status === 'completed') {
            throw new UnprocessableEntityHttpException('Order is already completed.');
        }

        // Update confirmation status on conversation, order, and vendor's items
        DB::transaction(function () use ($conversation, $order, $vendorId) {
            $conversation->update(['confirmation_status' => 'pending_confirmation']);

            $order->update(['confirmation_status' => 'pending_confirmation']);

            $order->items()
                ->where('vendor_id', $vendorId)
                ->update(['confirmation_status' => 'pending_confirmation']);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $order->status,
                'note' => "Vendor {$conversation->vendor->stall_name} requested customer confirmation before preparing COD items.",
            ]);
        });

        // Send official confirmation request message
        $promptMessage = "Hello {$order->user->name}! Please confirm that you will claim Order #{$order->order_number}. We will begin preparing your fresh items as soon as you confirm.";

        $metadata = [
            'action' => 'confirmation_request',
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'vendor_id' => $vendorId,
            'vendor_stall' => $conversation->vendor->stall_name,
            'payment_method' => $order->payment_method,
            'total_amount' => (float) $order->total_amount,
        ];

        $message = OrderMessage::create([
            'order_conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'sender_type' => 'vendor',
            'message' => $promptMessage,
            'message_type' => 'confirmation_request',
            'metadata' => $metadata,
            'is_read' => false,
        ]);

        $conversation->update(['last_message_at' => now()]);
        $message->load('sender:id,name,email');

        // Broadcast New Message
        $this->broadcastSafely(new NewOrderMessageEvent(
            $message,
            $orderId,
            $vendorId,
            $order->user_id
        ));

        // Broadcast Order Confirmation Status Update
        $this->broadcastSafely(new OrderConfirmationUpdatedEvent(
            $orderId,
            $vendorId,
            'pending_confirmation',
            $order->status,
            'vendor',
            "Confirmation requested by {$conversation->vendor->stall_name}",
            $order->user_id,
            $vendor->user_id
        ));

        return $message;
    }

    /**
     * Customer (or authorized vendor) confirms the order.
     */
    public function confirmOrder(User $user, int $orderId, int $vendorId, ?string $note = null): array
    {
        $conversation = $this->getOrCreateConversation($orderId, $vendorId, $user);
        $order = Order::with('items')->findOrFail($orderId);
        $vendor = Vendor::findOrFail($vendorId);

        if ($order->status === 'cancelled') {
            throw new UnprocessableEntityHttpException('Cannot confirm a cancelled order.');
        }

        $senderType = $this->determineSenderType($user, $conversation);

        DB::transaction(function () use ($conversation, $order, $vendorId, $user, $note) {
            $conversation->update(['confirmation_status' => 'confirmed']);

            $order->update([
                'confirmation_status' => 'confirmed',
                'confirmed_at' => now(),
                'confirmed_by' => $user->id,
            ]);

            // If order status was pending or pending_confirmation, update to confirmed
            if (in_array($order->status, ['pending', 'pending_confirmation'])) {
                $order->update(['status' => 'confirmed']);
            }

            // Update vendor's portion
            $order->items()
                ->where('vendor_id', $vendorId)
                ->update([
                    'status' => 'confirmed',
                    'confirmation_status' => 'confirmed',
                ]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'confirmed',
                'note' => "Order confirmed by {$user->name}." . ($note ? " Note: {$note}" : ""),
            ]);
        });

        $confirmText = "Order #{$order->order_number} has been CONFIRMED by customer. Vendor {$vendor->stall_name} may now proceed with preparing the items.";

        $metadata = [
            'action' => 'order_confirmed',
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'vendor_id' => $vendorId,
            'confirmed_by' => $user->name,
            'note' => $note,
        ];

        $message = OrderMessage::create([
            'order_conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'sender_type' => $senderType,
            'message' => $confirmText,
            'message_type' => 'order_confirmed',
            'metadata' => $metadata,
            'is_read' => false,
        ]);

        $conversation->update(['last_message_at' => now()]);
        $message->load('sender:id,name,email');

        $recipientUserId = $this->determineRecipientUserId($conversation, $senderType);

        // Broadcast New Message
        $this->broadcastSafely(new NewOrderMessageEvent(
            $message,
            $orderId,
            $vendorId,
            $recipientUserId
        ));

        // Broadcast Order Confirmation Status Update
        $this->broadcastSafely(new OrderConfirmationUpdatedEvent(
            $orderId,
            $vendorId,
            'confirmed',
            'confirmed',
            $senderType,
            "Order confirmed by {$user->name}",
            $order->user_id,
            $vendor->user_id
        ));

        return [
            'status' => 'confirmed',
            'order' => $order->fresh(['items']),
            'conversation' => $conversation->fresh(),
            'message' => $message,
        ];
    }

    /**
     * Customer (or authorized vendor) cancels the order through chat before items are prepared.
     * Restores deducted inventory stock.
     */
    public function cancelOrder(User $user, int $orderId, int $vendorId, ?string $reason = null): array
    {
        $conversation = $this->getOrCreateConversation($orderId, $vendorId, $user);
        $order = Order::with(['items.product', 'user'])->findOrFail($orderId);
        $vendor = Vendor::findOrFail($vendorId);

        if ($order->status === 'completed') {
            throw new UnprocessableEntityHttpException('Cannot cancel an order that is already completed.');
        }

        $senderType = $this->determineSenderType($user, $conversation);

        DB::transaction(function () use ($conversation, $order, $vendorId, $user, $reason) {
            $conversation->update(['confirmation_status' => 'cancelled']);

            // Get vendor's items to restore inventory
            $vendorItems = $order->items()->where('vendor_id', $vendorId)->get();

            foreach ($vendorItems as $item) {
                $inventory = Inventory::where('product_id', $item->product_id)
                    ->where('vendor_id', $vendorId)
                    ->lockForUpdate()
                    ->first();

                if ($inventory) {
                    $before = (float) $inventory->stock_quantity;
                    $restored = (float) $item->quantity;
                    $after = round($before + $restored, 2);

                    $inventory->update(['stock_quantity' => $after]);

                    InventoryLog::create([
                        'inventory_id' => $inventory->id,
                        'vendor_id' => $vendorId,
                        'product_id' => $item->product_id,
                        'type' => 'returned',
                        'quantity_before' => $before,
                        'quantity_change' => $restored,
                        'quantity_after' => $after,
                        'reason' => "Order #{$order->order_number} cancelled by {$user->name}" . ($reason ? ": {$reason}" : ""),
                        'reference_number' => $order->order_number,
                        'unit_cost' => $inventory->cost_price,
                        'performed_by' => $user->name,
                    ]);
                }
            }

            // Update vendor's item status
            $order->items()
                ->where('vendor_id', $vendorId)
                ->update([
                    'status' => 'cancelled',
                    'confirmation_status' => 'cancelled',
                ]);

            // Recompute overall order status
            $this->orderService->refreshOverallStatus($order->fresh('items'), "Vendor {$vendorId} portion cancelled.");

            // If all items in the order are cancelled, ensure whole order is cancelled
            $nonCancelledItems = $order->fresh('items')->items->where('status', '!=', 'cancelled');
            if ($nonCancelledItems->isEmpty()) {
                $order->update(['status' => 'cancelled', 'confirmation_status' => 'cancelled']);
            }

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'cancelled',
                'note' => "Portion cancelled by {$user->name}." . ($reason ? " Reason: {$reason}" : ""),
            ]);
        });

        $cancelText = "Order #{$order->order_number} portion for {$vendor->stall_name} has been CANCELLED by {$user->name}." .
            ($reason ? " Reason: {$reason}." : "") . " Items were not prepared and stock was restored.";

        $metadata = [
            'action' => 'order_cancelled',
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'vendor_id' => $vendorId,
            'cancelled_by' => $user->name,
            'reason' => $reason,
        ];

        $message = OrderMessage::create([
            'order_conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'sender_type' => $senderType,
            'message' => $cancelText,
            'message_type' => 'order_cancelled',
            'metadata' => $metadata,
            'is_read' => false,
        ]);

        $conversation->update(['last_message_at' => now()]);
        $message->load('sender:id,name,email');

        $recipientUserId = $this->determineRecipientUserId($conversation, $senderType);

        // Broadcast New Message
        $this->broadcastSafely(new NewOrderMessageEvent(
            $message,
            $orderId,
            $vendorId,
            $recipientUserId
        ));

        // Broadcast Order Confirmation Status Update
        $this->broadcastSafely(new OrderConfirmationUpdatedEvent(
            $orderId,
            $vendorId,
            'cancelled',
            $order->fresh()->status,
            $senderType,
            "Order cancelled by {$user->name}",
            $order->user_id,
            $vendor->user_id
        ));

        return [
            'status' => 'cancelled',
            'order' => $order->fresh(['items']),
            'conversation' => $conversation->fresh(),
            'message' => $message,
        ];
    }

    /**
     * Mark all unread messages in a conversation as read for the user.
     */
    public function markConversationRead(User $user, int $conversationId): int
    {
        $conversation = OrderConversation::findOrFail($conversationId);

        if (!$conversation->isAuthorized($user)) {
            throw new AccessDeniedHttpException('You are not authorized to access this conversation.');
        }

        return $conversation->markAsReadFor($user);
    }

    /**
     * Get total unread messages count for a user across all their order conversations.
     */
    public function getUnreadCount(User $user): int
    {
        $query = OrderMessage::where('is_read', false)
            ->where('sender_id', '!=', $user->id);

        if ($user->isAdmin()) {
            return $query->count();
        }

        $userVendor = $user->vendor;

        $query->whereHas('conversation', function ($q) use ($user, $userVendor) {
            $q->where('customer_id', $user->id);
            if ($userVendor) {
                $q->orWhere('vendor_id', $userVendor->id);
            }
        });

        return $query->count();
    }

    /**
     * Verify authorization to view/participate in order conversation.
     */
    private function authorizeAccess(User $user, Order $order, int $vendorId): void
    {
        if ($user->isAdmin()) {
            return;
        }

        if ((int) $order->user_id === (int) $user->id) {
            return;
        }

        $userVendor = $user->vendor;
        if ($userVendor && (int) $userVendor->id === (int) $vendorId) {
            return;
        }

        throw new AccessDeniedHttpException('You are not authorized to view or message this order conversation.');
    }

    /**
     * Determine sender role: 'customer', 'vendor', or 'system'.
     */
    private function determineSenderType(User $user, OrderConversation $conversation): string
    {
        if ($user->isAdmin()) {
            return 'system';
        }

        $userVendor = $user->vendor;
        if ($userVendor && (int) $userVendor->id === (int) $conversation->vendor_id) {
            return 'vendor';
        }

        if ((int) $user->id === (int) $conversation->customer_id) {
            return 'customer';
        }

        return 'system';
    }

    /**
     * Determine recipient user ID for direct notification broadcast.
     */
    private function determineRecipientUserId(OrderConversation $conversation, string $senderType): ?int
    {
        if ($senderType === 'customer') {
            return $conversation->vendor?->user_id;
        }

        if ($senderType === 'vendor') {
            return $conversation->customer_id;
        }

        return null;
    }

    /**
     * Broadcast an event safely, logging any connection error without crashing the request.
     */
    private function broadcastSafely(object $event): void
    {
        try {
            broadcast($event);
        } catch (\Throwable $e) {
            Log::warning('Broadcast failed: ' . $e->getMessage(), [
                'event' => get_class($event),
                'error' => $e->getMessage(),
            ]);
        }
    }
}
