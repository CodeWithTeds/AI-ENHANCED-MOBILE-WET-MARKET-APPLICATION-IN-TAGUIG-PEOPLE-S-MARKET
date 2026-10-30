<?php

namespace App\Events;

use App\Models\OrderMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewOrderMessageEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $conversationId;
    public int $orderId;
    public int $vendorId;
    public ?int $recipientUserId;
    public array $messageData;

    public function __construct(OrderMessage $message, int $orderId, int $vendorId, ?int $recipientUserId = null)
    {
        $this->conversationId = $message->order_conversation_id;
        $this->orderId = $orderId;
        $this->vendorId = $vendorId;
        $this->recipientUserId = $recipientUserId;

        $this->messageData = [
            'id' => $message->id,
            'order_conversation_id' => $message->order_conversation_id,
            'order_id' => $orderId,
            'vendor_id' => $vendorId,
            'sender_id' => $message->sender_id,
            'sender_name' => $message->sender?->name ?? 'System',
            'sender_type' => $message->sender_type,
            'message' => $message->message,
            'message_type' => $message->message_type,
            'metadata' => $message->metadata,
            'is_read' => (bool) $message->is_read,
            'created_at' => $message->created_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel("orders.{$this->orderId}.vendor.{$this->vendorId}"),
            new PrivateChannel("orders.{$this->orderId}"),
        ];

        if ($this->recipientUserId) {
            $channels[] = new PrivateChannel("users.{$this->recipientUserId}");
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'new.order.message';
    }

    /**
     * Data to broadcast with the event.
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'order_id' => $this->orderId,
            'vendor_id' => $this->vendorId,
            'message' => $this->messageData,
        ];
    }
}
