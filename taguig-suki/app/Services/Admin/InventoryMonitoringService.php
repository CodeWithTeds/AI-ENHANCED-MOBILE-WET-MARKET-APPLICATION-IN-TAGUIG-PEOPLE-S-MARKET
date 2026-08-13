<?php

namespace App\Services\Admin;

use App\Enums\VendorStatus;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Support\Facades\DB;

class InventoryMonitoringService
{
    public function getIndexData(array $filters): array
    {
        $query = Inventory::query()
            ->with(['product:id,vendor_id,name,category,unit,price,image,is_available', 'vendor:id,stall_name,stall_location']);

        $this->applyFilters($query, $filters);

        return [
            'inventories' => $query
                ->orderBy('stock_quantity')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (Inventory $inventory) => $this->present($inventory)),
            'stats' => $this->getStats(),
            'filters' => $filters,
            'stock_statuses' => [
                ['value' => 'in', 'label' => 'In Stock'],
                ['value' => 'low', 'label' => 'Low Stock'],
                ['value' => 'out', 'label' => 'Out of Stock'],
            ],
            'categories' => Product::distinct()->pluck('category')->filter()->sort()->values()
                ->map(fn (string $category) => ['value' => $category, 'label' => ucfirst($category)]),
            'vendors' => Vendor::where('status', VendorStatus::Approved->value)
                ->orderBy('stall_name')
                ->get(['id', 'stall_name'])
                ->map(fn (Vendor $vendor) => ['value' => (string) $vendor->id, 'label' => $vendor->stall_name]),
        ];
    }

    private function present(Inventory $inventory): array
    {
        return [
            'id' => $inventory->id,
            'status' => $inventory->status,
            'stock_quantity' => $inventory->stock_quantity,
            'reorder_level' => $inventory->reorder_level,
            'max_stock_level' => $inventory->max_stock_level,
            'cost_price' => $inventory->cost_price,
            'selling_price' => $inventory->selling_price,
            'profit_per_unit' => $inventory->profit_per_unit,
            'inventory_value' => $inventory->inventory_value,
            'stock_status' => $inventory->isOutOfStock() ? 'out' : ($inventory->isLowStock() ? 'low' : 'in'),
            'product' => [
                'id' => $inventory->product->id,
                'name' => $inventory->product->name,
                'category' => $inventory->product->category,
                'unit' => $inventory->product->unit,
                'price' => $inventory->product->price,
                'image' => $inventory->product->image,
                'is_available' => $inventory->product->is_available,
            ],
            'vendor' => [
                'id' => $inventory->vendor->id,
                'stall_name' => $inventory->vendor->stall_name,
                'stall_location' => $inventory->vendor->stall_location,
            ],
        ];
    }

    private function applyFilters($query, array $filters): void
    {
        if (! empty($filters['stock_status'])) {
            match ($filters['stock_status']) {
                'low' => $query->lowStock(),
                'out' => $query->outOfStock(),
                'in' => $query->where('stock_quantity', '>', 0)->whereColumn('stock_quantity', '>', 'reorder_level'),
                default => null,
            };
        }

        if (! empty($filters['category'])) {
            $query->whereHas('product', fn ($q) => $q->where('category', $filters['category']));
        }

        if (! empty($filters['vendor'])) {
            $query->where('vendor_id', $filters['vendor']);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->whereHas('product', fn ($pq) => $pq->where('name', 'like', "%{$term}%")->orWhere('category', 'like', "%{$term}%"))
                    ->orWhereHas('vendor', fn ($vq) => $vq->where('stall_name', 'like', "%{$term}%")->orWhere('stall_location', 'like', "%{$term}%"));
            });
        }
    }

    private function getStats(): array
    {
        $inStock = fn ($query) => $query->where('stock_quantity', '>', 0)->whereColumn('stock_quantity', '>', 'reorder_level');

        return [
            'total' => Inventory::count(),
            'in_stock' => Inventory::where(fn ($q) => $inStock($q))->count(),
            'low_stock' => Inventory::lowStock()->count(),
            'out_of_stock' => Inventory::outOfStock()->count(),
            'total_value' => (float) Inventory::query()
                ->where('stock_quantity', '>', 0)
                ->select(DB::raw('COALESCE(SUM(cost_price * stock_quantity), 0) as value'))
                ->value('value'),
            'vendor_count' => Inventory::distinct()->count('vendor_id'),
        ];
    }
}
