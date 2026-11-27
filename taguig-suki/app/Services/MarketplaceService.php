<?php

namespace App\Services;

use App\Enums\VendorStatus;
use App\Models\Product;
use App\Models\Review;
use App\Models\Vendor;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class MarketplaceService
{
    /**
     * Enrich a collection or array of products with actual customer review ratings.
     * Checks both product-level reviews and vendor-level reviews, prioritizing product-level.
     */
    public function enrichProductsWithRatings(iterable $products): iterable
    {
        $collection = $products instanceof Collection ? $products : collect($products);
        if ($collection->isEmpty()) {
            return $products;
        }

        $productIds = $collection->pluck('id')->filter()->unique()->values();
        $vendorIds = $collection->pluck('vendor_id')->filter()->unique()->values();

        $productRatings = Review::where('reviewable_type', Product::class)
            ->whereIn('reviewable_id', $productIds)
            ->selectRaw('reviewable_id, AVG(rating) as avg_rating, COUNT(*) as review_count')
            ->groupBy('reviewable_id')
            ->get()
            ->keyBy('reviewable_id');

        $vendorRatings = Review::where('reviewable_type', Vendor::class)
            ->whereIn('reviewable_id', $vendorIds)
            ->selectRaw('reviewable_id, AVG(rating) as avg_rating, COUNT(*) as review_count')
            ->groupBy('reviewable_id')
            ->get()
            ->keyBy('reviewable_id');

        foreach ($collection as $product) {
            $pr = $productRatings->get($product->id);
            $vr = $vendorRatings->get($product->vendor_id);

            $vendorAvg = $vr ? round((float) $vr->avg_rating, 1) : 5.0;
            $vendorCount = $vr ? (int) $vr->review_count : 0;

            if ($pr && (int) $pr->review_count > 0) {
                $productAvg = round((float) $pr->avg_rating, 1);
                $productCount = (int) $pr->review_count;

                $product->rating = $productAvg;
                $product->product_rating = $productAvg;
                $product->reviews_count = $productCount;
            } elseif ($vr && (int) $vr->review_count > 0) {
                $product->product_rating = null;
                $product->reviews_count = $vendorCount;
                $product->rating = $vendorAvg;
            } else {
                $product->product_rating = null;
                $product->reviews_count = 0;
                $product->rating = 5.0;
            }

            $product->vendor_rating = $vendorAvg;
            $product->vendor_review_count = $vendorCount;

            if ($product->relationLoaded('inventory')) {
                $stockQty = $product->inventory
                    ? (float) $product->inventory->stock_quantity
                    : 0.0;
                $reorderLevel = $product->inventory
                    ? (float) $product->inventory->reorder_level
                    : null;
                $outOfStock = ! $product->is_available
                    || ($product->inventory !== null && $stockQty <= 0);

                $product->setAttribute('stock_quantity', $stockQty);
                $product->setAttribute('reorder_level', $reorderLevel);
                $product->setAttribute('is_out_of_stock', $outOfStock);
                if ($outOfStock) {
                    $product->setAttribute('is_available', false);
                }
            }
        }

        return $products;
    }

    /**
     * Get featured/available products for the customer marketplace.
     */
    public function getFeaturedProducts(int $limit = 10): Collection
    {
        $products = Product::where('is_available', true)
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity,reorder_level'])
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        $this->enrichProductsWithRatings($products);

        return $products;
    }

    /**
     * Browse products with optional category filter and pagination.
     */
    public function browse(?string $category = null, int $perPage = 20): LengthAwarePaginator
    {
        $query = Product::where('is_available', true)
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity,reorder_level']);

        if ($category && $category !== 'all') {
            $query->where('category', $category);
        }

        $paginator = $query->orderByDesc('created_at')->paginate($perPage);

        $this->enrichProductsWithRatings($paginator->items());

        return $paginator;
    }

    /**
     * Search products with AI-based highest-rated vendor prioritization.
     * Shows all stalls/vendors selling the product, while prioritizing the highest-rated vendor.
     */
    public function search(string $term, int $perPage = 20): LengthAwarePaginator
    {
        $allMatching = Product::where('is_available', true)
            ->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%")
                    ->orWhere('category', 'like', "%{$term}%");
            })
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity,reorder_level'])
            ->get();

        $this->enrichProductsWithRatings($allMatching);

        foreach ($allMatching as $item) {
            $item->is_ai_recommended = false;
        }

        // AI Product Recommendation sorts highest-rated first, prioritizing vendors/products with actual reviews
        $sorted = $allMatching->sort(function ($a, $b) {
            $hasReviewsA = (($a->reviews_count ?? 0) > 0 || ($a->vendor_review_count ?? 0) > 0);
            $hasReviewsB = (($b->reviews_count ?? 0) > 0 || ($b->vendor_review_count ?? 0) > 0);
            if ($hasReviewsA !== $hasReviewsB) {
                return $hasReviewsB <=> $hasReviewsA;
            }

            $ratingA = $a->rating ?? $a->vendor_rating ?? 5.0;
            $ratingB = $b->rating ?? $b->vendor_rating ?? 5.0;
            if ($ratingB != $ratingA) {
                return $ratingB <=> $ratingA;
            }
            if (($b->reviews_count ?? 0) != ($a->reviews_count ?? 0)) {
                return ($b->reviews_count ?? 0) <=> ($a->reviews_count ?? 0);
            }

            return $a->price <=> $b->price;
        })->values();

        if ($sorted->isNotEmpty()) {
            $sorted->first()->is_ai_recommended = true;
        }

        $page = (int) request()->get('page', 1);
        $slice = $sorted->slice(($page - 1) * $perPage, $perPage)->values();

        return new LengthAwarePaginator($slice, $sorted->count(), $perPage, $page, [
            'path' => request()->url(),
            'query' => request()->query(),
        ]);
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
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity,reorder_level'])
            ->findOrFail($productId);

        $this->enrichProductsWithRatings(collect([$product]));

        $data = $product->toArray();
        $data['comparison_vendors'] = $this->getProductVendorsComparison($product);

        return $data;
    }

    /**
     * Find all stalls and vendors selling the same or similar product,
     * sorted by highest rating down to others with AI recommendation.
     */
    public function getProductVendorsComparison(Product $product): array
    {
        $keywords = collect(explode(' ', strtolower($product->name)))
            ->map(fn ($w) => trim($w, " \t\n\r\0\x0B,.-/"))
            ->filter(fn ($w) => strlen($w) >= 3 && ! in_array($w, ['fresh', 'with', 'and', 'the', 'for'], true))
            ->values();

        $query = Product::where('is_available', true)
            ->with(['vendor:id,stall_name,stall_location,opening_time,closing_time', 'inventory:id,product_id,stock_quantity,reorder_level']);

        $query->where(function ($q) use ($keywords, $product) {
            $q->where('id', $product->id);
            if ($keywords->isNotEmpty()) {
                foreach ($keywords as $kw) {
                    $q->orWhere('name', 'like', "%{$kw}%");
                }
            } else {
                $q->orWhere('category', $product->category);
            }
        });

        $allMatching = $query->get();

        $productIds = $allMatching->pluck('id')->filter()->unique()->values();
        $vendorIds = $allMatching->pluck('vendor_id')->unique()->filter()->values();

        $productRatings = Review::where('reviewable_type', Product::class)
            ->whereIn('reviewable_id', $productIds)
            ->selectRaw('reviewable_id, AVG(rating) as avg_rating, COUNT(*) as review_count')
            ->groupBy('reviewable_id')
            ->get()
            ->keyBy('reviewable_id');

        $vendorRatings = Review::where('reviewable_type', Vendor::class)
            ->whereIn('reviewable_id', $vendorIds)
            ->selectRaw('reviewable_id, AVG(rating) as avg_rating, COUNT(*) as review_count')
            ->groupBy('reviewable_id')
            ->get()
            ->keyBy('reviewable_id');

        $list = $allMatching->map(function ($item) use ($productRatings, $vendorRatings, $product) {
            $vId = $item->vendor_id;
            $vr = $vendorRatings->get($vId);
            $pr = $productRatings->get($item->id);

            if ($pr && (int) $pr->review_count > 0) {
                $avgRating = round((float) $pr->avg_rating, 1);
                $reviewCount = (int) $pr->review_count;
            } elseif ($vr && (int) $vr->review_count > 0) {
                $avgRating = round((float) $vr->avg_rating, 1);
                $reviewCount = (int) $vr->review_count;
            } else {
                $avgRating = 5.0;
                $reviewCount = 0;
            }

            $stock = $item->inventory ? (float) $item->inventory->stock_quantity : 0.0;
            $reorderLevel = $item->inventory ? (float) $item->inventory->reorder_level : null;
            $outOfStock = ! $item->is_available || ($item->inventory !== null && $stock <= 0);

            return [
                'product_id' => $item->id,
                'name' => $item->name,
                'category' => $item->category,
                'price' => (float) $item->price,
                'unit' => $item->unit,
                'image' => $item->image,
                'is_available' => (bool) ($item->is_available && ! $outOfStock),
                'is_out_of_stock' => $outOfStock,
                'stock_quantity' => $stock,
                'reorder_level' => $reorderLevel,
                'vendor_id' => $item->vendor?->id ?? $item->vendor_id,
                'stall_name' => $item->vendor?->stall_name ?? 'Market Stall',
                'stall_location' => $item->vendor?->stall_location ?? 'Taguig People\'s Market',
                'rating' => $avgRating,
                'reviews_count' => $reviewCount,
                'is_current' => $item->id === $product->id,
            ];
        });

        // Sort automatically from highest-rated vendor down to others, prioritizing actual customer reviews
        $sorted = $list->sort(function ($a, $b) {
            $hasReviewsA = ($a['reviews_count'] > 0);
            $hasReviewsB = ($b['reviews_count'] > 0);
            if ($hasReviewsA !== $hasReviewsB) {
                return $hasReviewsB <=> $hasReviewsA;
            }

            if ($b['rating'] != $a['rating']) {
                return $b['rating'] <=> $a['rating'];
            }
            if ($b['reviews_count'] != $a['reviews_count']) {
                return $b['reviews_count'] <=> $a['reviews_count'];
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
        $vendor = Vendor::where('status', VendorStatus::Approved->value)
            ->findOrFail($vendorId);

        $products = Product::where('vendor_id', $vendorId)
            ->where('is_available', true)
            ->with(['inventory:id,product_id,stock_quantity,reorder_level'])
            ->orderBy('name')
            ->get();

        $this->enrichProductsWithRatings($products);

        return [
            'vendor' => $vendor,
            'products' => $products,
        ];
    }
}
