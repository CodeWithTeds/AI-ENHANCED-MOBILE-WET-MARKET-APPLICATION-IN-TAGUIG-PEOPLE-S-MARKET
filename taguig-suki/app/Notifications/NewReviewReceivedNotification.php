<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class NewReviewReceivedNotification extends Notification
{
    public function __construct(
        protected int $reviewId,
        protected int $rating,
        protected ?string $comment,
        protected int $vendorId,
        protected string $stallName,
        protected string $customerName,
        protected ?int $productId = null,
        protected ?string $productName = null,
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
        $isProduct = $this->productName !== null;
        $target = $isProduct ? $this->productName : 'your stall';

        $message = "{$this->customerName} rated {$target} {$this->rating}/5";

        if ($this->comment !== null && trim($this->comment) !== '') {
            $message .= ': "'.$this->excerpt($this->comment).'"';
        } else {
            $message .= '.';
        }

        return [
            'category' => 'new_review',
            'title' => $isProduct
                ? "New {$this->rating}-star product review"
                : "New {$this->rating}-star stall review",
            'message' => $message,
            'review_id' => $this->reviewId,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'target' => $isProduct ? 'product' : 'stall',
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'vendor_id' => $this->vendorId,
            'stall_name' => $this->stallName,
            'customer_name' => $this->customerName,
        ];
    }

    private function excerpt(string $comment): string
    {
        $comment = trim(preg_replace('/\s+/', ' ', $comment) ?? $comment);

        return mb_strlen($comment) > 120
            ? mb_substr($comment, 0, 117).'...'
            : $comment;
    }
}
