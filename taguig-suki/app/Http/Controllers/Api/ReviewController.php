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
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class ReviewController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ReviewService $reviewService) {}

    /**
     * Rate a vendor (must have a completed order containing this vendor).
     *
     * POST /reviews/vendor
     * Body: { vendor_id, rating, comment?, order_id?, images? }
     */
    public function storeVendor(Request $request): JsonResponse
    {
        $validated = $this->validateReview($request, [
            'vendor_id' => 'required|integer|exists:vendors,id',
        ]);

        $images = $this->validateAndExtractImages($request);

        try {
            $review = $this->reviewService->createVendorReview($request->user(), array_merge($validated, ['images' => $images]));

            return $this->successResponse($review, 'Vendor review submitted', 201);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Rate a product (must have a completed order containing this product).
     *
     * POST /reviews/product
     * Body: { product_id, rating, comment?, order_id?, images? }
     */
    public function storeProduct(Request $request): JsonResponse
    {
        $validated = $this->validateReview($request, [
            'product_id' => 'required|integer|exists:products,id',
        ]);

        $images = $this->validateAndExtractImages($request);

        try {
            $review = $this->reviewService->createProductReview($request->user(), array_merge($validated, ['images' => $images]));

            return $this->successResponse($review, 'Product review submitted', 201);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Rate an AI-generated recipe.
     *
     * POST /reviews/recipe
     * Body: { recipe_name, rating, comment?, images? }
     */
    public function storeRecipe(Request $request): JsonResponse
    {
        $validated = $this->validateReview($request, [
            'recipe_name' => 'required|string|max:100',
        ]);

        $images = $this->validateAndExtractImages($request);

        try {
            $review = $this->reviewService->createRecipeReview($request->user(), array_merge($validated, ['images' => $images]));

            return $this->successResponse($review, 'Recipe review submitted', 201);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /**
     * Update one of the customer's own reviews.
     *
     * PUT/POST /reviews/{review}
     * Body: { rating, comment?, remove_images?, images? }
     */
    public function update(Request $request, Review $review): JsonResponse
    {
        $validated = $this->validateReview($request);
        $images = $this->validateAndExtractImages($request);

        if (! empty($images)) {
            $validated['images'] = $images;
        }

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

    /**
     * Shared rating validation + the target-specific rules.
     */
    private function validateReview(Request $request, array $rules = []): array
    {
        $imageRules = [];
        if ($request->hasFile('images')) {
            if (is_array($request->file('images'))) {
                $imageRules = [
                    'images' => 'nullable|array|max:5',
                    'images.*' => 'image|mimes:jpeg,png,jpg|max:5120',
                ];
            } else {
                $imageRules = [
                    'images' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
                ];
            }
        }

        return $request->validate(array_merge($rules, $imageRules, [
            'rating' => 'required|integer|between:1,5',
            'comment' => 'nullable|string|max:1000',
            'order_id' => 'nullable|integer|exists:orders,id',
            'remove_images' => 'nullable|boolean',
        ]));
    }

    /**
     * Validate and extract image files from the request.
     *
     * @return array{path: string, order: int}[]
     */
    private function validateAndExtractImages(Request $request): array
    {
        $images = [];

        if ($request->hasFile('images')) {
            $files = $request->file('images');
            $fileArray = is_array($files) ? $files : [$files];

            foreach ($fileArray as $index => $file) {
                if ($file instanceof UploadedFile && $file->isValid()) {
                    $path = $file->store('feedback-images/' . $request->user()->id, 'public');

                    $images[] = [
                        'path' => $path,
                        'order' => $index,
                    ];
                }
            }
        }

        return $images;
    }
}
