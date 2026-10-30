<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderConfirmationUpdatedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $orderId;
    public int $vendorId;
    public string $confirmationStatus;
    public string $orderStatus;
    public string $updatedBy;
    public ?string $note;
    public ?int $customerUserId;
    public ?int $vendorUserId;

    public function __construct(
        int $orderId,
        int $vendorId,
        string $confirmationStatus,
        string $orderStatus,
        string $updatedBy,
        ?string $note = null,
        ?int $customerUserId = null,
        ?int $vendorUserId = null
    ) {
        $this->orderId = $orderId;
        $this->vendorId = $vendorId;
        $this->confirmationStatus = $confirmationStatus;
        $this->orderStatus = $orderStatus;
        $this->updatedBy = $updatedBy;
        $this->note = $note;
        $this->customerUserId = $customerUserId;
        $this->vendorUserId = $vendorUserId;
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

        if ($this->customerUserId) {
            $channels[] = new PrivateChannel("users.{$this->customerUserId}");
        }

        if ($this->vendorUserId) {
            $channels[] = new PrivateChannel("users.{$this->vendorUserId}");
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'order.confirmation.updated';
    }

    /**
     * Data to broadcast with the event.
     */
    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->orderId,
            'vendor_id' => $this->vendorId,
            'confirmation_status' => $this->confirmationStatus,
            'order_status' => $this->orderStatus,
            'updated_by' => $this->updatedBy,
            'note' => $this->note,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
