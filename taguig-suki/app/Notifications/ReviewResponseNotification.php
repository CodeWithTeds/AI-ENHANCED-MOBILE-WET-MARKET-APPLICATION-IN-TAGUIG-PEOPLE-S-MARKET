<?php

namespace App\Notifications;

use App\Models\Review;
use Illuminate\Notifications\Notification;

class ReviewResponseNotification extends Notification
{
    public function __construct(
        protected Review $review,
        protected string $vendorName,
        protected string $responseText
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $targetName = $this->review->reviewable?->name
            ?? $this->review->reviewable?->stall_name
            ?? 'your order';

        return [
            'category' => 'review_response',
            'title' => 'Vendor Responded to Your Feedback',
            'message' => "{$this->vendorName} responded to your feedback on {$targetName}: \"{$this->excerpt($this->responseText)}\"",
            'review_id' => $this->review->id,
            'rating' => $this->review->rating,
            'comment' => $this->review->comment,
            'vendor_response' => $this->responseText,
            'responded_at' => now()->toIso8601String(),
        ];
    }

    private function excerpt(string $text): string
    {
        $clean = trim(preg_replace('/\s+/', ' ', $text) ?? $text);

        return mb_strlen($clean) > 120 ? mb_substr($clean, 0, 117).'...' : $clean;
    }
}
