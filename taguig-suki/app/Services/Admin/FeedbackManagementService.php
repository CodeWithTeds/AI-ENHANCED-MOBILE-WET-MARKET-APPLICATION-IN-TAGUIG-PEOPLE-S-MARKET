<?php

namespace App\Services\Admin;

use App\Models\Review;
use Illuminate\Database\Eloquent\Builder;

class FeedbackManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = Review::query()->with([
            'user:id,name,email',
            'order:id,order_number',
        ]);

        $this->applyFilters($query, $filters);

        return [
            'reviews' => $query
                ->orderByDesc('created_at')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (Review $review) => $this->present($review)),
            'stats' => $this->getStats(),
            'filters' => $filters,
            'statuses' => collect([
                ['value' => 'pending', 'label' => 'Pending'],
                ['value' => 'in_review', 'label' => 'In Review'],
                ['value' => 'resolved', 'label' => 'Resolved'],
                ['value' => 'dismissed', 'label' => 'Dismissed'],
            ]),
            'types' => collect([
                ['value' => 'vendor', 'label' => 'Vendor Review'],
                ['value' => 'product', 'label' => 'Product Review'],
                ['value' => 'recipe', 'label' => 'Recipe Review'],
            ]),
        ];
    }

    public function respond(Review $review, string $response): Review
    {
        $review->update([
            'status' => 'resolved',
            'admin_response' => $response,
            'resolved_at' => now(),
        ]);

        return $review->fresh(['user:id,name,email', 'order:id,order_number']);
    }

    public function updateStatus(Review $review, string $status, ?string $response = null): Review
    {
        $data = ['status' => $status];

        if ($status === 'resolved') {
            $data['admin_response'] = $response ?? $review->admin_response;
            $data['resolved_at'] = now();
        }

        $review->update($data);

        return $review->fresh(['user:id,name,email', 'order:id,order_number']);
    }

    private function present(Review $review): array
    {
        return [
            'id' => $review->id,
            'rating' => $review->rating,
            'comment' => $review->comment,
            'status' => $review->status,
            'admin_response' => $review->admin_response,
            'resolved_at' => $review->resolved_at,
            'created_at' => $review->created_at,
            'user' => [
                'id' => $review->user->id,
                'name' => $review->user->name,
                'email' => $review->user->email,
            ],
            'order' => $review->order
                ? ['id' => $review->order->id, 'order_number' => $review->order->order_number]
                : null,
            'type' => $this->resolveType($review),
            'target_name' => $this->resolveTargetName($review),
        ];
    }

    private function resolveType(Review $review): string
    {
        if ($review->recipe_name) {
            return 'recipe';
        }

        return $review->reviewable_type === 'App\\Models\\Vendor' ? 'vendor' : 'product';
    }

    private function resolveTargetName(Review $review): ?string
    {
        if ($review->recipe_name) {
            return $review->recipe_name;
        }

        $reviewable = $review->reviewable;

        if (! $reviewable) {
            return null;
        }

        return match (true) {
            property_exists($reviewable, 'stall_name') => $reviewable->stall_name,
            property_exists($reviewable, 'name') => $reviewable->name,
            default => null,
        };
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['type'])) {
            match ($filters['type']) {
                'vendor' => $query->where('reviewable_type', 'App\\Models\\Vendor'),
                'product' => $query->where('reviewable_type', 'App\\Models\\Product'),
                'recipe' => $query->whereNotNull('recipe_name'),
                default => null,
            };
        }

        if (! empty($filters['rating'])) {
            $query->where('rating', $filters['rating']);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->where('comment', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                    ->orWhereHas('order', fn ($oq) => $oq->where('order_number', 'like', "%{$term}%"));
            });
        }
    }

    private function getStats(): array
    {
        return [
            'total' => Review::count(),
            'pending' => Review::where('status', 'pending')->count(),
            'in_review' => Review::where('status', 'in_review')->count(),
            'resolved' => Review::where('status', 'resolved')->count(),
            'dismissed' => Review::where('status', 'dismissed')->count(),
            'low_ratings' => Review::where('rating', '<=', 2)->count(),
            'average_rating' => round((float) Review::avg('rating'), 1),
        ];
    }
}
