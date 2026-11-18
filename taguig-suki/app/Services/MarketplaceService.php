<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Review;
use App\Models\Vendor;
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
            ->with('vendor:id,stall_name,stall_location,opening_time,closing_time')
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
            ->with('vendor:id,stall_name,stall_location,opening_time,closing_time');

        if ($category && $category !== 'all') {
            $query->where('category', $category);
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    /**
     * Search products by name or description.
     */
    /**
     * Search products with AI-based highest-rated vendor prioritization.
     */
    public function search(string $term, int $perPage = 20): LengthAwarePaginator
    {
        $paginator = Product::where('is_available', true)
            ->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                  ->orWhere('description', 'like', "%{$term}%")
                  ->orWhere('category', 'like', "%{$term}%");
            })
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity'])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        // Enrich with vendor ratings and AI recommendations
        $vendorIds = collect($paginator->items())->pluck('vendor_id')->unique()->filter()->values();
        $vendorRatings = Review::where('reviewable_type', Vendor::class)
            ->whereIn('reviewable_id', $vendorIds)
            ->selectRaw('reviewable_id, AVG(rating) as avg_rating, COUNT(*) as review_count')
            ->groupBy('reviewable_id')
            ->get()
            ->keyBy('reviewable_id');

        $highestRating = $vendorRatings->max('avg_rating') ?: 5.0;

        foreach ($paginator->items() as $item) {
            $r = $vendorRatings->get($item->vendor_id);
            $avg = $r ? round((float) $r->avg_rating, 1) : 4.5;
            $count = $r ? (int) $r->review_count : 0;
            $item->vendor_rating = $avg;
            $item->vendor_review_count = $count;
            $item->is_ai_recommended = ($avg >= $highestRating && $avg >= 4.0);
        }

        return $paginator;
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
     * Get a single product detail with vendor comparison list.
     */
    public function getProduct(int $productId): array
    {
        $product = Product::where('is_available', true)
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity'])
            ->findOrFail($productId);

        $data = $product->toArray();
        $data['comparison_vendors'] = $this->getProductVendorsComparison($product);

        return $data;
    }

    /**
     * Find all stalls and vendors selling the same or similar product,
     * sorted by highest vendor rating down to others with AI recommendation.
     */
    public function getProductVendorsComparison(Product $product): array
    {
        $keywords = collect(explode(' ', strtolower($product->name)))
            ->map(fn ($w) => trim($w, " \t\n\r\0\x0B,.-/"))
            ->filter(fn ($w) => strlen($w) >= 3 && !in_array($w, ['fresh', 'with', 'and', 'the', 'for'], true))
            ->values();

        $query = Product::where('is_available', true)
            ->where('category', $product->category)
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity']);

        if ($keywords->isNotEmpty()) {
            $query->where(function ($q) use ($keywords, $product) {
                $q->where('id', $product->id);
                foreach ($keywords as $kw) {
                    $q->orWhere('name', 'like', "%{$kw}%");
                }
            });
        }

        $allMatching = $query->get();

        $vendorIds = $allMatching->pluck('vendor_id')->unique()->filter()->values();
        $vendorRatings = Review::where('reviewable_type', Vendor::class)
            ->whereIn('reviewable_id', $vendorIds)
            ->selectRaw('reviewable_id, AVG(rating) as avg_rating, COUNT(*) as review_count')
            ->groupBy('reviewable_id')
            ->get()
            ->keyBy('reviewable_id');

        $list = $allMatching->map(function ($item) use ($vendorRatings, $product) {
            $vId = $item->vendor_id;
            $ratingData = $vendorRatings->get($vId);
            $avgRating = $ratingData ? round((float) $ratingData->avg_rating, 1) : 4.5;
            $reviewCount = $ratingData ? (int) $ratingData->review_count : 0;
            $stock = $item->inventory?->stock_quantity ?? 20;

            return [
                'product_id' => $item->id,
                'name' => $item->name,
                'category' => $item->category,
                'price' => (float) $item->price,
                'unit' => $item->unit,
                'image' => $item->image,
                'is_available' => (bool) $item->is_available,
                'stock_quantity' => $stock,
                'vendor_id' => $item->vendor?->id ?? $item->vendor_id,
                'stall_name' => $item->vendor?->stall_name ?? 'Market Stall',
                'stall_location' => $item->vendor?->stall_location ?? 'Taguig People\'s Market',
                'rating' => $avgRating,
                'reviews_count' => $reviewCount,
                'is_current' => $item->id === $product->id,
            ];
        });

        // Sort automatically from highest-rated vendor down to others, then price
        $sorted = $list->sort(function ($a, $b) {
            if ($b['rating'] != $a['rating']) {
                return $b['rating'] <=> $a['rating'];
            }
            return $a['price'] <=> $b['price'];
        })->values();

        // Top-rated vendor is highlighted with AI recommendation
        return $sorted->map(function ($entry, $idx) {
            $entry['is_ai_recommended'] = ($idx === 0);
            return $entry;
        })->all();
    }

    /**
     * Get a vendor's public store details and available products.
     */
    public function getVendorStore(int $vendorId): array
    {
        $vendor = \App\Models\Vendor::where('status', \App\Enums\VendorStatus::Approved->value)
            ->findOrFail($vendorId);

        $products = Product::where('vendor_id', $vendorId)
            ->where('is_available', true)
            ->orderBy('name')
            ->get();

        return [
            'vendor' => $vendor,
            'products' => $products,
        ];
    }
}
