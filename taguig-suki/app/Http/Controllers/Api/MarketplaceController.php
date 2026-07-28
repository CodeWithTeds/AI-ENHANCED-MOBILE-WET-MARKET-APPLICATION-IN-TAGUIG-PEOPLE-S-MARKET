<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MarketplaceService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketplaceController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly MarketplaceService $marketplaceService) {}

    public function featured(): JsonResponse
    {
        return $this->successResponse(
            $this->marketplaceService->getFeaturedProducts(),
            'Featured products retrieved'
        );
    }

    public function browse(Request $request): JsonResponse
    {
        return $this->successResponse(
            $this->marketplaceService->browse($request->query('category'), (int) $request->query('per_page', 20)),
            'Products retrieved'
        );
    }

    public function search(Request $request): JsonResponse
    {
        $request->validate(['q' => 'required|string|min:2']);

        return $this->successResponse(
            $this->marketplaceService->search($request->query('q'), (int) $request->query('per_page', 20)),
            'Search results'
        );
    }

    public function categories(): JsonResponse
    {
        return $this->successResponse(
            $this->marketplaceService->getCategories(),
            'Categories retrieved'
        );
    }

    public function show(int $product): JsonResponse
    {
        return $this->successResponse(
            $this->marketplaceService->getProduct($product),
            'Product detail retrieved'
        );
    }
}
