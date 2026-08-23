<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Review;
use App\Models\Vendor;
use App\Services\ReviewService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReviewController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ReviewService $reviewService) {}

    /**
     * Rate a vendor (must have a completed order containing this vendor).
     *
     * POST /reviews/vendor
     * Body: { vendor_id, rating, comment?, order_id? }
     */
    public function storeVendor(Request $request): JsonResponse
    {
        $validated = $this->validateReview($request, [
            'vendor_id' => 'required|integer|exists:vendors,id',
        ]);

        try {
            $review = $this->reviewService->createVendorReview($request->user(), $validated);

            return $this->successResponse($review, 'Vendor review submitted', 201);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Rate a product (must have a completed order containing this product).
     *
     * POST /reviews/product
     * Body: { product_id, rating, comment?, order_id? }
     */
    public function storeProduct(Request $request): JsonResponse
    {
        $validated = $this->validateReview($request, [
            'product_id' => 'required|integer|exists:products,id',
        ]);

        try {
            $review = $this->reviewService->createProductReview($request->user(), $validated);

            return $this->successResponse($review, 'Product review submitted', 201);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Rate an AI-generated recipe.
     *
     * POST /reviews/recipe
     * Body: { recipe_name, rating, comment? }
     */
    public function storeRecipe(Request $request): JsonResponse
    {
        $validated = $this->validateReview($request, [
            'recipe_name' => 'required|string|max:100',
        ]);

        try {
            $review = $this->reviewService->createRecipeReview($request->user(), $validated);

            return $this->successResponse($review, 'Recipe review submitted', 201);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Update one of the customer's own reviews.
     *
     * PUT /reviews/{review}
     * Body: { rating, comment? }
     */
    public function update(Request $request, Review $review): JsonResponse
    {
        $validated = $this->validateReview($request);

        try {
            $updated = $this->reviewService->updateReview($request->user(), $review, $validated);

            return $this->successResponse($updated, 'Review updated');
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Delete one of the customer's own reviews.
     *
     * DELETE /reviews/{review}
     */
    public function destroy(Request $request, Review $review): JsonResponse
    {
        try {
            $this->reviewService->deleteReview($request->user(), $review);

            return $this->successResponse(null, 'Review deleted');
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Everything the customer can review from their completed orders.
     *
     * GET /reviews/eligible
     */
    public function eligible(Request $request): JsonResponse
    {
        return $this->successResponse(
            $this->reviewService->getEligibleItems($request->user()),
            'Reviewable items retrieved'
        );
    }

    /**
     * Public vendor reviews + aggregate.
     *
     * GET /reviews/vendor/{vendor}
     */
    public function vendorReviews(Vendor $vendor): JsonResponse
    {
        return $this->successResponse(
            $this->reviewService->vendorReviews($vendor->id),
            'Vendor reviews retrieved'
        );
    }

    /**
     * Public product reviews + aggregate.
     *
     * GET /reviews/product/{product}
     */
    public function productReviews(Product $product): JsonResponse
    {
        return $this->successResponse(
            $this->reviewService->productReviews($product->id),
            'Product reviews retrieved'
        );
    }

    /**
     * Public recipe reviews + aggregate.
     *
     * GET /reviews/recipe?q={recipe_name}
     */
    public function recipeReviews(Request $request): JsonResponse
    {
        $request->validate(['q' => 'required|string|max:100']);

        return $this->successResponse(
            $this->reviewService->recipeReviews($request->query('q')),
            'Recipe reviews retrieved'
        );
    }

    /**
     * Shared rating validation + the target-specific rules.
     */
    private function validateReview(Request $request, array $rules = []): array
    {
        return $request->validate(array_merge($rules, [
            'rating' => 'required|integer|between:1,5',
            'comment' => 'nullable|string|max:1000',
            'order_id' => 'nullable|integer|exists:orders,id',
        ]));
    }

    /**
     * Get ratings and feedback for the authenticated vendor's stall and products.
     *
     * GET /vendor/reviews
     */
    public function vendorReviewsDashboard(Request $request): JsonResponse
    {
        return $this->successResponse(
            $this->reviewService->getVendorReviewsDashboard($request->user()),
            'Vendor reviews dashboard retrieved'
        );
    }
}
