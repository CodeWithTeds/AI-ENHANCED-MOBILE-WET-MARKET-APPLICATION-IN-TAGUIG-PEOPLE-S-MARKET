<?php

namespace App\Services\Admin;

use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ProductManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = Product::query()->with(['vendor:id,stall_name,stall_location,status', 'inventory']);

        $this->applyFilters($query, $filters);

        $sortField = $filters['sort'] ?? 'created_at';
        $sortDir = $filters['direction'] ?? 'desc';
        $allowedSorts = ['name', 'price', 'category', 'created_at', 'is_available'];
        if (! in_array($sortField, $allowedSorts, true)) {
            $sortField = 'created_at';
        }
        $sortDir = $sortDir === 'asc' ? 'asc' : 'desc';

        $products = $query->orderBy($sortField, $sortDir)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Product $product) => $this->present($product));

        return [
            'products' => $products,
            'stats' => $this->getStats(),
            'filters' => $filters,
            'categories' => Product::distinct()->pluck('category')->filter()->sort()->values()
                ->map(fn (string $category) => ['value' => $category, 'label' => ucfirst($category)]),
            'vendors' => Vendor::orderBy('stall_name')
                ->get(['id', 'stall_name'])
                ->map(fn (Vendor $vendor) => ['value' => (string) $vendor->id, 'label' => $vendor->stall_name]),
            'statuses' => collect([
                ['value' => 'available', 'label' => 'Available'],
                ['value' => 'unavailable', 'label' => 'Unavailable'],
            ]),
            'units' => collect(['kg', 'pcs', 'bundle', 'pack', 'g', 'L', 'ml', 'box', 'sack'])
                ->map(fn (string $unit) => ['value' => $unit, 'label' => $unit]),
        ];
    }

    public function update(Product $product, array $data, ?UploadedFile $image = null): Product
    {
        if ($image) {
            // Delete old image if exists
            if ($product->image && Storage::disk('public')->exists($product->image)) {
                Storage::disk('public')->delete($product->image);
            }
            $data['image'] = $image->store("products/{$product->vendor_id}", 'public');
        }

        // Normalize is_available to boolean
        if (array_key_exists('is_available', $data)) {
            $data['is_available'] = filter_var($data['is_available'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $data['is_available'];
        }

        $product->update($data);

        return $product->fresh(['vendor:id,stall_name,stall_location', 'inventory']);
    }

    public function destroy(Product $product): void
    {
        if ($product->image && Storage::disk('public')->exists($product->image)) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();
    }

    public function toggleAvailability(Product $product): Product
    {
        $product->update(['is_available' => ! $product->is_available]);

        return $product->fresh(['vendor:id,stall_name,stall_location', 'inventory']);
    }

    private function present(Product $product): array
    {
        return [
            'id' => $product->id,
            'name' => $product->name,
            'description' => $product->description,
            'category' => $product->category,
            'price' => $product->price,
            'unit' => $product->unit,
            'image' => $product->image,
            'is_available' => (bool) $product->is_available,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
            'vendor' => $product->vendor ? [
                'id' => $product->vendor->id,
                'stall_name' => $product->vendor->stall_name,
                'stall_location' => $product->vendor->stall_location,
                'status' => $product->vendor->status,
            ] : null,
            'inventory' => $product->inventory ? [
                'stock_quantity' => $product->inventory->stock_quantity,
                'reorder_level' => $product->inventory->reorder_level,
                'status' => $product->inventory->status,
            ] : null,
        ];
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function (Builder $q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%")
                    ->orWhere('category', 'like', "%{$term}%")
                    ->orWhereHas('vendor', fn (Builder $vq) => $vq->where('stall_name', 'like', "%{$term}%"));
            });
        }

        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (! empty($filters['vendor'])) {
            $query->where('vendor_id', $filters['vendor']);
        }

        if (! empty($filters['status'])) {
            if ($filters['status'] === 'available') {
                $query->where('is_available', true);
            } elseif ($filters['status'] === 'unavailable') {
                $query->where('is_available', false);
            }
        }

        if (! empty($filters['availability'])) {
            // alias for status
            if ($filters['availability'] === 'available') {
                $query->where('is_available', true);
            } elseif ($filters['availability'] === 'unavailable') {
                $query->where('is_available', false);
            }
        }
    }

    private function getStats(): array
    {
        return [
            'total' => Product::count(),
            'available' => Product::where('is_available', true)->count(),
            'unavailable' => Product::where('is_available', false)->count(),
            'categories' => Product::distinct()->count('category'),
            'vendors' => Product::distinct()->count('vendor_id'),
        ];
    }

    public static function validationRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category' => ['required', 'string', 'max:100'],
            'price' => ['required', 'numeric', 'min:0'],
            'unit' => ['required', 'string', 'max:50'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'is_available' => ['required', 'boolean'],
        ];
    }
}
