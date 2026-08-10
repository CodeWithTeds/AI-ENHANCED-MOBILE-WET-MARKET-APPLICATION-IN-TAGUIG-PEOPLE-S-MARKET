<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewService
{
    /**
     * Rate a vendor — only allowed if the customer has a COMPLETED order
     * containing this vendor's products.
     *
     * @throws ValidationException
     */
    public function createVendorReview(User $user, array $data): Review
    {
        $order = $this->findCompletedOrder($user, $data['order_id'] ?? null);

        $purchased = $order->items->contains('vendor_id', $data['vendor_id']);
        if (! $purchased) {
            throw ValidationException::withMessages([
                'vendor_id' => ['You can only review vendors from your completed orders.'],
            ]);
        }

        return $this->createReview($user, [
            'order_id' => $order->id,
            'reviewable_type' => Vendor::class,
            'reviewable_id' => $data['vendor_id'],
            'recipe_name' => null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ]);
    }

    /**
     * Rate a product — only allowed if the customer has a COMPLETED order
     * containing this product.
     *
     * @throws ValidationException
     */
    public function createProductReview(User $user, array $data): Review
    {
        $order = $this->findCompletedOrder($user, $data['order_id'] ?? null);

        $purchased = $order->items->contains('product_id', $data['product_id']);
        if (! $purchased) {
            throw ValidationException::withMessages([
                'product_id' => ['You can only review products from your completed orders.'],
            ]);
        }

        return $this->createReview($user, [
            'order_id' => $order->id,
            'reviewable_type' => Product::class,
            'reviewable_id' => $data['product_id'],
            'recipe_name' => null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ]);
    }

    /**
     * Rate an AI-generated recipe — any logged-in customer, once per recipe.
     *
     * @throws ValidationException
     */
    public function createRecipeReview(User $user, array $data): Review
    {
        return $this->createReview($user, [
            'order_id' => null,
            'reviewable_type' => 'recipe',
            'reviewable_id' => null,
            'recipe_name' => $data['recipe_name'],
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ]);
    }

    /**
     * Update one of the customer's own reviews.
     *
     * @throws ValidationException
     */
    public function updateReview(User $user, Review $review, array $data): Review
    {
        $this->assertOwns($user, $review);

        $review->update([
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? $review->comment,
        ]);

        return $review->fresh(['user:id,name']);
    }

    /**
     * Delete one of the customer's own reviews.
     */
    public function deleteReview(User $user, Review $review): void
    {
        $this->assertOwns($user, $review);

        $review->delete();
    }

    /**
     * Everything a customer can still review from their completed orders:
     * each completed order with its vendors and products + already-reviewed flags.
     */
    public function getEligibleItems(User $user): array
    {
        $orders = Order::where('user_id', $user->id)
            ->where('status', 'completed')
            ->with(['items.vendor:id,stall_name,stall_location', 'items.product:id,name,category,unit,price'])
            ->orderByDesc('created_at')
            ->get();

        $reviewedVendorIds = $this->reviewedTargetIds($user, Vendor::class);
        $reviewedProductIds = $this->reviewedTargetIds($user, Product::class);

        return $orders->map(function (Order $order) use ($reviewedVendorIds, $reviewedProductIds) {
            $vendors = $order->items
                ->pluck('vendor')
                ->filter()
                ->unique('id')
                ->map(fn (Vendor $vendor) => [
                    'id' => $vendor->id,
                    'stall_name' => $vendor->stall_name,
                    'stall_location' => $vendor->stall_location,
                    'reviewed' => $reviewedVendorIds->contains($vendor->id),
                ])
                ->values();

            $products = $order->items
                ->filter(fn ($item) => $item->product)
                ->map(fn ($item) => [
                    'id' => $item->product_id,
                    'name' => $item->product->name,
                    'category' => $item->product->category,
                    'unit' => $item->product->unit,
                    'price' => $item->product->price,
                    'reviewed' => $reviewedProductIds->contains($item->product_id),
                ])
                ->values();

            return [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'created_at' => $order->created_at,
                'vendors' => $vendors,
                'products' => $products,
            ];
        })->filter(fn ($entry) => $entry['vendors']->isNotEmpty() || $entry['products']->isNotEmpty())->values()->all();
    }

    /**
     * Public listing + aggregate for a vendor.
     */
    public function vendorReviews(int $vendorId): array
    {
        $reviews = Review::where('reviewable_type', Vendor::class)
            ->where('reviewable_id', $vendorId)
            ->orderByDesc('created_at')
            ->get();

        return $this->summarize($reviews);
    }

    /**
     * Public listing + aggregate for a product.
     */
    public function productReviews(int $productId): array
    {
        $reviews = Review::where('reviewable_type', Product::class)
            ->where('reviewable_id', $productId)
            ->orderByDesc('created_at')
            ->get();

        return $this->summarize($reviews);
    }

    /**
     * Public listing + aggregate for a recipe (keyed by recipe name).
     */
    public function recipeReviews(string $recipeName): array
    {
        $reviews = Review::where('recipe_name', $recipeName)
            ->orderByDesc('created_at')
            ->get();

        return $this->summarize($reviews);
    }

    /* ─── Internals ─── */

    /**
     * Find a completed order of this user — optionally a specific one.
     *
     * @throws ValidationException
     */
    private function findCompletedOrder(User $user, ?int $orderId): Order
    {
        $query = Order::where('user_id', $user->id)
            ->where('status', 'completed')
            ->with('items');

        if ($orderId) {
            $query->where('id', $orderId);
        }

        $order = $query->orderByDesc('created_at')->first();

        if (! $order) {
            throw ValidationException::withMessages([
                'order_id' => ['You can only review after your order has been completed.'],
            ]);
        }

        return $order;
    }

    /**
     * Insert a review after checking the one-review-per-target rule.
     *
     * @throws ValidationException
     */
    private function createReview(User $user, array $attributes): Review
    {
        $existing = Review::where('user_id', $user->id)
            ->where(function ($q) use ($attributes) {
                if ($attributes['recipe_name'] !== null) {
                    // Recipe reviews: one per recipe name
                    $q->where('recipe_name', $attributes['recipe_name']);
                } else {
                    // Vendor/product reviews: one per target
                    $q->where('reviewable_type', $attributes['reviewable_type'])
                        ->where('reviewable_id', $attributes['reviewable_id']);
                }
            })
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'rating' => ['You have already reviewed this.'],
            ]);
        }

        return DB::transaction(fn () => Review::create($attributes + ['user_id' => $user->id]));
    }

    /**
     * @throws ValidationException
     */
    private function assertOwns(User $user, Review $review): void
    {
        if ($review->user_id !== $user->id) {
            throw ValidationException::withMessages([
                'review' => ['You can only manage your own reviews.'],
            ]);
        }
    }

    private function reviewedTargetIds(User $user, string $type): Collection
    {
        return Review::where('user_id', $user->id)
            ->where('reviewable_type', $type)
            ->pluck('reviewable_id');
    }

    private function summarize(Collection $reviews): array
    {
        $total = $reviews->count();

        return [
            'reviews' => $reviews->load('user:id,name')->map(fn (Review $r) => [
                'id' => $r->id,
                'rating' => $r->rating,
                'comment' => $r->comment,
                'created_at' => $r->created_at,
                'user' => $r->user?->name ?? 'Anonymous',
            ])->values(),
            'average_rating' => $total > 0 ? round($reviews->avg('rating'), 1) : 0,
            'total' => $total,
            'rating_counts' => [
                5 => $reviews->where('rating', 5)->count(),
                4 => $reviews->where('rating', 4)->count(),
                3 => $reviews->where('rating', 3)->count(),
                2 => $reviews->where('rating', 2)->count(),
                1 => $reviews->where('rating', 1)->count(),
            ],
        ];
    }
}
