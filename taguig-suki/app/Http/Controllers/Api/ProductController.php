<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Product;
use App\Repositories\VendorRepositoryInterface;
use App\Services\ProductService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly ProductService $productService,
        private readonly VendorRepositoryInterface $vendorRepository,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        return $this->successResponse(
            $this->productService->getAllForVendor($vendor),
            'Products retrieved'
        );
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        return $this->successResponse(
            $this->productService->create(
                $vendor,
                $request->safe()->except('image'),
                $request->file('image')
            ),
            'Product created successfully',
            201
        );
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor || $product->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse(
            $this->productService->update(
                $product,
                $request->safe()->except('image'),
                $request->file('image')
            ),
            'Product updated successfully'
        );
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor || $product->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $this->productService->delete($product);

        return $this->successResponse(null, 'Product deleted successfully');
    }
}
