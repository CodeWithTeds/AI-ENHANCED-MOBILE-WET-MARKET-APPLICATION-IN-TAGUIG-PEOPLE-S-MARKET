<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Vendor;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ApiResponse;

    /**
     * List all products for the authenticated vendor.
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        $products = Product::where('vendor_id', $vendor->id)
            ->orderByDesc('updated_at')
            ->get();

        return $this->successResponse($products, 'Products retrieved');
    }

    /**
     * Store a new product.
     */
    public function store(Request $request): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category' => ['required', 'string', 'max:100'],
            'price' => ['required', 'numeric', 'min:0'],
            'unit' => ['required', 'string', 'max:50'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:3072'],
            'is_available' => ['nullable', 'boolean'],
        ]);

        $data = $request->only(['name', 'description', 'category', 'price', 'unit', 'is_available']);
        $data['vendor_id'] = $vendor->id;

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store("products/{$vendor->id}", 'public');
        }

        $product = Product::create($data);

        return $this->successResponse($product, 'Product created successfully', 201);
    }

    /**
     * Update an existing product.
     */
    public function update(Request $request, Product $product): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor || $product->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category' => ['sometimes', 'string', 'max:100'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'unit' => ['sometimes', 'string', 'max:50'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png', 'max:3072'],
            'is_available' => ['nullable', 'boolean'],
        ]);

        $data = $request->only(['name', 'description', 'category', 'price', 'unit', 'is_available']);

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store("products/{$vendor->id}", 'public');
        }

        $product->update($data);

        return $this->successResponse($product->fresh(), 'Product updated successfully');
    }

    /**
     * Delete a product.
     */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor || $product->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $product->delete();

        return $this->successResponse(null, 'Product deleted successfully');
    }

    /**
     * Get the vendor profile for the authenticated user.
     */
    private function getVendor(Request $request): ?Vendor
    {
        return Vendor::where('user_id', $request->user()->id)->first();
    }
}
