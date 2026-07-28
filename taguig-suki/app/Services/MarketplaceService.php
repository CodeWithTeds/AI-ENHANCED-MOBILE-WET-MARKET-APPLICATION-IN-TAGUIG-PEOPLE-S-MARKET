<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class MarketplaceService
{
    /**
     * Get featured/available products for the customer marketplace.
     */
    public function getFeaturedProducts(int $limit = 10): Collection
    {
        return Product::where('is_available', true)
            ->with('vendor:id,stall_name,stall_location')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Browse products with optional category filter and pagination.
     */
    public function browse(?string $category = null, int $perPage = 20): LengthAwarePaginator
    {
        $query = Product::where('is_available', true)
            ->with('vendor:id,stall_name,stall_location');

        if ($category && $category !== 'all') {
            $query->where('category', $category);
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    /**
     * Search products by name or description.
     */
    public function search(string $term, int $perPage = 20): LengthAwarePaginator
    {
        return Product::where('is_available', true)
            ->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                  ->orWhere('description', 'like', "%{$term}%");
            })
            ->with('vendor:id,stall_name,stall_location')
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Get available product categories.
     */
    public function getCategories(): array
    {
        return Product::where('is_available', true)
            ->distinct()
            ->pluck('category')
            ->sort()
            ->values()
            ->toArray();
    }

    /**
     * Get a single product detail.
     */
    public function getProduct(int $productId): Product
    {
        return Product::where('is_available', true)
            ->with('vendor:id,stall_name,stall_location')
            ->findOrFail($productId);
    }
}
