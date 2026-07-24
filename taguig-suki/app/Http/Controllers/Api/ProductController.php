<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Product;
use App\Services\ProductService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ProductService $productService) {}

    public function index(Request $request): JsonResponse
    {
        return $this->successResponse($this->productService->getAllForVendor($request->user()), 'Products retrieved');
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        return $this->successResponse($this->productService->create($request->user(), $request->safe()->except('image'), $request->file('image')), 'Product created successfully', 201);
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        return $this->successResponse($this->productService->update($request->user(), $product, $request->safe()->except('image'), $request->file('image')), 'Product updated successfully');
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        return $this->successResponse($this->productService->delete($request->user(), $product), 'Product deleted successfully');
    }
}
