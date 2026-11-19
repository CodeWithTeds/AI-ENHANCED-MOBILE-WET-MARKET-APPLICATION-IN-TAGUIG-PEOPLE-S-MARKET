<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\ReviewImage;
use App\Models\User;
use App\Models\Vendor;
use App\Notifications\ReviewResponseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ReviewService
{
    public function __construct(private readonly NotificationService $notificationService) {}

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

        $attributes = [
            'order_id' => $order->id,
            'reviewable_type' => Vendor::class,
            'reviewable_id' => $data['vendor_id'],
            'recipe_name' => null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ];

        return $this->createReview($user, $attributes, $data['images'] ?? []);
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

        $attributes = [
            'order_id' => $order->id,
            'reviewable_type' => Product::class,
            'reviewable_id' => $data['product_id'],
            'recipe_name' => null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ];

        return $this->createReview($user, $attributes, $data['images'] ?? []);
    }

    /**
     * Rate an AI-generated recipe — any logged-in customer, once per recipe.
     *
     * @throws ValidationException
     */
    public function createRecipeReview(User $user, array $data): Review
    {
        $attributes = [
            'order_id' => null,
            'reviewable_type' => 'recipe',
            'reviewable_id' => null,
            'recipe_name' => $data['recipe_name'],
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ];

        return $this->createReview($user, $attributes, $data['images'] ?? []);
    }

    /**
     * Update one of the customer's own reviews.
     *
     * @throws ValidationException
     */
    public function updateReview(User $user, Review $review, array $data): Review
    {
        $this->assertOwns($user, $review);

        $hasComment = ! empty(trim((string) ($data['comment'] ?? $review->comment ?? '')));
        $review->update([
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? $review->comment,
            'needs_response' => $hasComment && empty($review->vendor_response) && empty($review->admin_response),
            'status' => (! $hasComment || $review->vendor_response || $review->admin_response) ? 'resolved' : 'pending',
        ]);

        // Handle image removal
        if (isset($data['remove_images']) && $data['remove_images']) {
            foreach ($review->images as $image) {
                Storage::disk('public')->delete($image->path);
            }
            $review->images()->delete();
        }

        // Handle image replacement
        if (isset($data['images']) && is_array($data['images'])) {
            // Remove existing images not in the new set
            $newImageOrders = array_column($data['images'], 'order');
            $removed = $review->images()->whereNotIn('order', $newImageOrders)->get();
            foreach ($removed as $image) {
                Storage::disk('public')->delete($image->path);
            }
            $review->images()->whereNotIn('order', $newImageOrders)->delete();

            // Update or create images
            foreach ($data['images'] as $imageData) {
                if (isset($imageData['id']) && $imageData['id']) {
                    // Update existing image
                    $review->images()->where('id', $imageData['id'])->update([
                        'path' => $imageData['path'] ?? '',
                        'order' => $imageData['order'] ?? 0,
                    ]);
                } else {
                    // Create new image
                    $review->images()->create([
                        'path' => $imageData['path'] ?? '',
                        'order' => $imageData['order'] ?? 0,
                    ]);
                }
            }
        }

        return $review->fresh(['user:id,name', 'images']);
    }

    /**
     * Get review images for a given review.
     */
    public function getReviewImages(Review $review): Collection
    {
        return $review->images()->orderBy('order')->get();
    }

    /**
     * Delete one of the customer's own reviews.
     */
    public function deleteReview(User $user, Review $review): void
    {
        $this->assertOwns($user, $review);

        foreach ($review->images as $image) {
            Storage::disk('public')->delete($image->path);
        }

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

        $orderIds = $orders->pluck('id')->all();
        $existingReviews = Review::where('user_id', $user->id)
            ->whereIn('order_id', $orderIds)
            ->get();

        return $orders->map(function (Order $order) use ($existingReviews) {
            $orderReviews = $existingReviews->where('order_id', $order->id);
            $reviewedVendorIds = $orderReviews->where('reviewable_type', Vendor::class)->pluck('reviewable_id');
            $reviewedProductIds = $orderReviews->where('reviewable_type', Product::class)->pluck('reviewable_id');

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
            ->with(['user:id,name', 'images'])
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
            ->with(['user:id,name', 'images'])
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
            ->with(['user:id,name', 'images'])
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
    private function createReview(User $user, array $attributes, array $images = []): Review
    {
        $existing = Review::where('user_id', $user->id)
            ->where(function ($q) use ($attributes) {
                if ($attributes['recipe_name'] !== null) {
                    // Recipe reviews: one per recipe name
                    $q->where('recipe_name', $attributes['recipe_name']);
                } else {
                    // Vendor/product reviews: one per target per order
                    $q->where('reviewable_type', $attributes['reviewable_type'])
                        ->where('reviewable_id', $attributes['reviewable_id'])
                        ->where('order_id', $attributes['order_id']);
                }
            })
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'rating' => ['You have already reviewed this for this order.'],
            ]);
        }

        // Ratings without comments do NOT require a response and are automatically resolved.
        // Written customer comments and complaints are flagged as pending response.
        $hasComment = ! empty(trim((string) ($attributes['comment'] ?? '')));
        $attributes['status'] = $hasComment ? 'pending' : 'resolved';
        $attributes['needs_response'] = $hasComment;
        if (! $hasComment) {
            $attributes['resolved_at'] = now();
        }

        $review = DB::transaction(function () use ($attributes, $user, $images) {
            $review = Review::create($attributes + ['user_id' => $user->id]);

            foreach ($images as $image) {
                ReviewImage::create([
                    'review_id' => $review->id,
                    'path' => $image['path'],
                    'order' => $image['order'] ?? 0,
                ]);
            }

            return $review->load(['user:id,name', 'images']);
        });

        $this->notificationService->notifyVendorNewReview($review);

        return $review;
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

    /**
     * Get all ratings, feedback, and reviews for a vendor's stall and products.
     */
    public function getVendorReviewsDashboard(User $user): array
    {
        $vendor = $user->vendor ?? null;

        if (! $vendor) {
            return [
                'stall' => [
                    'average_rating' => 0.0,
                    'total' => 0,
                    'rating_counts' => [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0],
                    'reviews' => [],
                ],
                'products' => [
                    'average_rating' => 0.0,
                    'total' => 0,
                    'rating_counts' => [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0],
                    'reviews' => [],
                ],
            ];
        }

        // 1. Fetch Vendor/Stall reviews
        $stallReviews = Review::where('reviewable_type', Vendor::class)
            ->where('reviewable_id', $vendor->id)
            ->with(['user:id,name', 'images'])
            ->orderByDesc('created_at')
            ->get();

        $stallSummary = $this->summarize($stallReviews);

        // 2. Fetch Product reviews for all products belonging to this vendor
        $productIds = Product::where('vendor_id', $vendor->id)->pluck('id');

        $productReviews = Review::where('reviewable_type', Product::class)
            ->whereIn('reviewable_id', $productIds)
            ->with(['user:id,name', 'reviewable', 'images'])
            ->orderByDesc('created_at')
            ->get();

        $productReviewsSummary = [
            'reviews' => $productReviews->map(fn (Review $r) => [
                'id' => $r->id,
                'rating' => $r->rating,
                'comment' => $r->comment,
                'status' => $r->status,
                'needs_response' => (bool) $r->needs_response,
                'has_comment' => $r->hasComment(),
                'is_complaint' => $r->isComplaint(),
                'vendor_response' => $r->vendor_response,
                'vendor_responded_at' => $r->vendor_responded_at?->format('M d, Y g:i A'),
                'admin_response' => $r->admin_response,
                'created_at' => $r->created_at,
                'user' => $r->user?->name ?? 'Anonymous',
                'product_id' => $r->reviewable_id,
                'product_name' => $r->reviewable?->name ?? 'Deleted Product',
                'product_category' => $r->reviewable?->category ?? 'General',
                'images' => $r->images->map(fn ($img) => [
                    'id' => $img->id,
                    'path' => $img->path,
                    'url' => '/storage/' . ltrim(preg_replace('/^\/?(storage\/)?/', '', $img->path), '/'),
                ])->values(),
            ])->values(),
            'average_rating' => $productReviews->count() > 0 ? round($productReviews->avg('rating'), 1) : 0,
            'total' => $productReviews->count(),
            'rating_counts' => [
                5 => $productReviews->where('rating', 5)->count(),
                4 => $productReviews->where('rating', 4)->count(),
                3 => $productReviews->where('rating', 3)->count(),
                2 => $productReviews->where('rating', 2)->count(),
                1 => $productReviews->where('rating', 1)->count(),
            ],
        ];

        return [
            'stall' => $stallSummary,
            'products' => $productReviewsSummary,
        ];
    }

    /**
     * Vendor responds to a customer's review or complaint.
     * Ratings without comments do NOT require and cannot accept responses.
     *
     * @throws ValidationException
     */
    public function vendorRespond(User $vendorUser, Review $review, string $responseText): Review
    {
        $vendor = $vendorUser->vendor;
        if (! $vendor) {
            throw ValidationException::withMessages([
                'vendor' => ['Only authorized vendors can respond to customer feedback.'],
            ]);
        }

        // Verify that this review belongs to the vendor's stall or one of the vendor's products
        $belongsToVendor = false;
        if ($review->reviewable_type === Vendor::class && (int) $review->reviewable_id === (int) $vendor->id) {
            $belongsToVendor = true;
        } elseif ($review->reviewable_type === Product::class) {
            $product = Product::find($review->reviewable_id);
            if ($product && (int) $product->vendor_id === (int) $vendor->id) {
                $belongsToVendor = true;
            }
        }

        if (! $belongsToVendor) {
            throw ValidationException::withMessages([
                'review' => ['You can only respond to feedback or complaints directed to your own stall or products.'],
            ]);
        }

        // Enforce: Ratings without comments do not require or allow responses
        if (! $review->hasComment()) {
            throw ValidationException::withMessages([
                'comment' => ['Ratings without customer comments do not require a response. Responses are only for complaints or written customer concerns.'],
            ]);
        }

        $cleanResponse = trim($responseText);
        if (mb_strlen($cleanResponse) < 3) {
            throw ValidationException::withMessages([
                'response' => ['Your response must be at least 3 characters.'],
            ]);
        }

        $review->update([
            'vendor_response' => $cleanResponse,
            'vendor_responded_at' => now(),
            'needs_response' => false,
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        $fresh = $review->fresh(['user', 'reviewable']);

        // Notify customer who submitted the review
        if ($fresh->user) {
            $fresh->user->notify(new ReviewResponseNotification(
                $fresh,
                $vendor->stall_name ?: ($vendorUser->name ?? 'Vendor'),
                $cleanResponse
            ));
        }

        return $fresh;
    }

    private function summarize(Collection $reviews): array
    {
        $total = $reviews->count();

        return [
            'reviews' => $reviews->loadMissing(['user:id,name', 'images'])->map(fn (Review $r) => [
                'id' => $r->id,
                'rating' => $r->rating,
                'comment' => $r->comment,
                'status' => $r->status,
                'needs_response' => (bool) $r->needs_response,
                'has_comment' => $r->hasComment(),
                'is_complaint' => $r->isComplaint(),
                'vendor_response' => $r->vendor_response,
                'vendor_responded_at' => $r->vendor_responded_at?->format('M d, Y g:i A'),
                'admin_response' => $r->admin_response,
                'created_at' => $r->created_at,
                'user' => $r->user?->name ?? 'Anonymous',
                'images' => $r->images->map(fn ($img) => [
                    'id' => $img->id,
                    'path' => $img->path,
                    'url' => '/storage/' . ltrim(preg_replace('/^\/?(storage\/)?/', '', $img->path), '/'),
                ])->values(),
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
