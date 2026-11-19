<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class ProductDeletedNotification extends Notification
{
    public function __construct(
        protected int $productId,
        protected string $productName,
        protected string $category,
        protected int $vendorId,
        protected string $stallName,
        protected string $reason,
        protected string $adminName,
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'category' => 'product_deleted',
            'title' => 'Product Removed by Administrator',
            'message' => "Your product \"{$this->productName}\" was removed by the administrator. Reason: {$this->reason}",
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'product_category' => $this->category,
            'vendor_id' => $this->vendorId,
            'stall_name' => $this->stallName,
            'reason' => $this->reason,
            'admin_name' => $this->adminName,
            'deleted_at' => now()->toIso8601String(),
        ];
    }
}
