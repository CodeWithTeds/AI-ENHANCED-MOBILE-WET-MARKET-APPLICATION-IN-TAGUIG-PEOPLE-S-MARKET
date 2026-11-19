<?php

namespace App\Services\Admin;

use App\Models\Product;
use App\Models\ProductDeletionLog;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ProductManagementService
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    public function getIndexData(array $filters): array
    {
        $query = Product::query();

        if (($filters['status'] ?? null) === 'deleted' || ($filters['view'] ?? null) === 'deleted') {
            $query->onlyTrashed()->with(['vendor:id,stall_name,stall_location,status', 'inventory', 'deletedBy:id,name']);
        } else {
            $query->with(['vendor:id,stall_name,stall_location,status', 'inventory']);
        }

        $this->applyFilters($query, $filters);

        $sortField = $filters['sort'] ?? 'created_at';
        $sortDir = $filters['direction'] ?? 'desc';
        $allowedSorts = ['name', 'category', 'created_at', 'is_available', 'deleted_at'];
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
            'categories' => Product::withTrashed()->distinct()->pluck('category')->filter()->sort()->values()
                ->map(fn (string $category) => ['value' => $category, 'label' => ucfirst($category)]),
            'vendors' => Vendor::orderBy('stall_name')
                ->get(['id', 'stall_name'])
                ->map(fn (Vendor $vendor) => ['value' => (string) $vendor->id, 'label' => $vendor->stall_name]),
            'statuses' => collect([
                ['value' => 'available', 'label' => 'Available'],
                ['value' => 'unavailable', 'label' => 'Unavailable'],
                ['value' => 'deleted', 'label' => 'Deleted / Removed by Admin'],
            ]),
            'units' => collect(['kg', 'pcs', 'bundle', 'pack', 'g', 'L', 'ml', 'box', 'sack'])
                ->map(fn (string $unit) => ['value' => $unit, 'label' => $unit]),
            'deletion_logs' => $this->getRecentDeletionLogs(),
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

    public function destroy(Product $product, string $reason, User $admin): ProductDeletionLog
    {
        $product->loadMissing('vendor.user');
        $vendor = $product->vendor;

        // 1. Create persistent deletion audit log
        $log = ProductDeletionLog::create([
            'product_id' => $product->id,
            'vendor_id' => $product->vendor_id,
            'deleted_by_id' => $admin->id,
            'product_name' => $product->name,
            'category' => $product->category,
            'unit' => $product->unit,
            'price' => $product->price,
            'image' => $product->image,
            'reason' => $reason,
        ]);

        // 2. Record reason and admin who deleted on product model
        $product->deletion_reason = $reason;
        $product->deleted_by = $admin->id;
        $product->save();

        // 3. Soft delete the product
        $product->delete();

        // 4. Notify affected vendor
        if ($vendor) {
            $this->notificationService->notifyVendorProductDeleted($product, $vendor, $reason, $admin);
        }

        return $log;
    }

    public function toggleAvailability(Product $product): Product
    {
        $product->update(['is_available' => ! $product->is_available]);

        return $product->fresh(['vendor:id,stall_name,stall_location', 'inventory']);
    }

    public function getRecentDeletionLogs(int $limit = 50): array
    {
        return ProductDeletionLog::with(['vendor:id,stall_name,stall_location', 'deletedBy:id,name,email'])
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (ProductDeletionLog $log) => [
                'id' => $log->id,
                'product_id' => $log->product_id,
                'product_name' => $log->product_name,
                'category' => $log->category,
                'unit' => $log->unit,
                'price' => $log->price,
                'image' => $log->image,
                'reason' => $log->reason,
                'created_at' => $log->created_at?->toIso8601String(),
                'vendor' => $log->vendor ? [
                    'id' => $log->vendor->id,
                    'stall_name' => $log->vendor->stall_name,
                    'stall_location' => $log->vendor->stall_location,
                ] : null,
                'deleted_by' => $log->deletedBy ? [
                    'id' => $log->deletedBy->id,
                    'name' => $log->deletedBy->name,
                    'email' => $log->deletedBy->email,
                ] : null,
            ])
            ->all();
    }

    private function present(Product $product): array
    {
        return [
            'id' => $product->id,
            'name' => $product->name,
            'description' => $product->description,
            'category' => $product->category,
            'unit' => $product->unit,
            'image' => $product->image,
            'is_available' => (bool) $product->is_available,
            'deletion_reason' => $product->deletion_reason,
            'deleted_at' => $product->deleted_at?->toIso8601String(),
            'deleted_by' => $product->relationLoaded('deletedBy') && $product->deletedBy ? [
                'id' => $product->deletedBy->id,
                'name' => $product->deletedBy->name,
            ] : null,
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
            'deleted' => Product::onlyTrashed()->count(),
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
            'unit' => ['required', 'string', 'max:50'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:3072'],
            'is_available' => ['required', 'boolean'],
        ];
    }
}
