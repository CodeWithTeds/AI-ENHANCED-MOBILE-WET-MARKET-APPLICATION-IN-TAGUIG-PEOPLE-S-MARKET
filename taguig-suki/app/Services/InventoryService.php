<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    /**
     * Get all inventory items for a vendor with product details.
     */
    public function getVendorInventory(Vendor $vendor, array $filters = []): Collection
    {
        $query = Inventory::with('product')
            ->forVendor($vendor->id)
            ->orderByDesc('updated_at');

        // Apply filters
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['stock_status'])) {
            match ($filters['stock_status']) {
                'low_stock' => $query->lowStock(),
                'out_of_stock' => $query->outOfStock(),
                'in_stock' => $query->where('stock_quantity', '>', DB::raw('reorder_level')),
                'expiring' => $query->expiringSoon(),
                'expired' => $query->expired(),
                default => null,
            };
        }

        if (!empty($filters['storage_type'])) {
            $query->where('storage_type', $filters['storage_type']);
        }

        if (!empty($filters['category'])) {
            $query->whereHas('product', function ($q) use ($filters) {
                $q->where('category', $filters['category']);
            });
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }

        return $query->get();
    }

    /**
     * Get inventory summary/dashboard stats for a vendor.
     */
    public function getVendorSummary(Vendor $vendor): array
    {
        $inventories = Inventory::forVendor($vendor->id)->get();

        $totalProducts = $inventories->count();
        $totalUnits = $inventories->sum('stock_quantity');
        $inStock = $inventories->filter(fn ($i) => $i->stock_quantity > $i->reorder_level)->count();
        $lowStock = $inventories->filter(fn ($i) => $i->isLowStock())->count();
        $outOfStock = $inventories->filter(fn ($i) => $i->isOutOfStock())->count();
        $expiringSoon = $inventories->filter(fn ($i) => $i->isExpiringSoon())->count();
        $expired = $inventories->filter(fn ($i) => $i->isExpired())->count();
        $unavailable = $inventories->filter(fn ($i) => !$i->is_available)->count();

        $totalValue = $inventories->sum(fn ($i) => ($i->cost_price ?? 0) * $i->stock_quantity);
        $totalSellingValue = $inventories->sum(fn ($i) => $i->selling_price * $i->stock_quantity);

        return [
            'total_products' => $totalProducts,
            'total_units' => $totalUnits,
            'in_stock' => $inStock,
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
            'expiring_soon' => $expiringSoon,
            'expired' => $expired,
            'unavailable' => $unavailable,
            'total_cost_value' => round($totalValue, 2),
            'total_selling_value' => round($totalSellingValue, 2),
            'estimated_profit' => round($totalSellingValue - $totalValue, 2),
        ];
    }

    /**
     * Create an inventory record for a product.
     */
    public function createInventory(Vendor $vendor, Product $product, array $data): Inventory
    {
        return DB::transaction(function () use ($vendor, $product, $data) {
            $inventory = Inventory::create([
                'product_id' => $product->id,
                'vendor_id' => $vendor->id,
                'stock_quantity' => $data['stock_quantity'] ?? 0,
                'reserved_quantity' => 0,
                'reorder_level' => $data['reorder_level'] ?? 5,
                'max_stock_level' => $data['max_stock_level'] ?? null,
                'is_available' => $data['is_available'] ?? true,
                'status' => $data['status'] ?? 'active',
                'batch_number' => $data['batch_number'] ?? null,
                'expiry_date' => $data['expiry_date'] ?? null,
                'harvest_date' => $data['harvest_date'] ?? null,
                'source_location' => $data['source_location'] ?? null,
                'storage_type' => $data['storage_type'] ?? 'ambient',
                'weight_per_unit' => $data['weight_per_unit'] ?? null,
                'cost_price' => $data['cost_price'] ?? null,
                'selling_price' => $data['selling_price'] ?? $product->price,
                'markup_percentage' => $data['markup_percentage'] ?? null,
                'supplier_name' => $data['supplier_name'] ?? null,
                'supplier_contact' => $data['supplier_contact'] ?? null,
                'notes' => $data['notes'] ?? null,
                'last_restocked_at' => ($data['stock_quantity'] ?? 0) > 0 ? now() : null,
            ]);

            // Log initial stock
            if (($data['stock_quantity'] ?? 0) > 0) {
                $this->createLog($inventory, 'initial', $data['stock_quantity'], 'Initial stock entry');
            }

            // Sync stock_quantity back to products table
            $product->update([
                'stock_quantity' => $data['stock_quantity'] ?? 0,
                'is_available' => $data['is_available'] ?? true,
            ]);

            return $inventory;
        });
    }

    /**
     * Update inventory details (non-stock fields).
     */
    public function updateInventory(Inventory $inventory, array $data): Inventory
    {
        return DB::transaction(function () use ($inventory, $data) {
            $inventory->update($data);

            // Sync availability to product
            if (isset($data['is_available'])) {
                $inventory->product->update(['is_available' => $data['is_available']]);
            }

            if (isset($data['selling_price'])) {
                $inventory->product->update(['price' => $data['selling_price']]);
            }

            return $inventory->fresh(['product']);
        });
    }

    /**
     * Adjust stock quantity with audit log.
     */
    public function adjustStock(
        Inventory $inventory,
        int $quantityChange,
        string $type,
        ?string $reason = null,
        ?string $referenceNumber = null,
        ?string $performedBy = null
    ): Inventory {
        return DB::transaction(function () use ($inventory, $quantityChange, $type, $reason, $referenceNumber, $performedBy) {
            $newQuantity = max(0, $inventory->stock_quantity + $quantityChange);

            $this->createLog($inventory, $type, $quantityChange, $reason, $referenceNumber, $performedBy);

            $inventory->update([
                'stock_quantity' => $newQuantity,
                'last_restocked_at' => $quantityChange > 0 ? now() : $inventory->last_restocked_at,
            ]);

            // Sync to products table
            $inventory->product->update(['stock_quantity' => $newQuantity]);

            return $inventory->fresh(['product']);
        });
    }

    /**
     * Restock a product (bulk add).
     */
    public function restock(
        Inventory $inventory,
        int $quantity,
        ?float $unitCost = null,
        ?string $supplier = null,
        ?string $reason = null
    ): Inventory {
        return DB::transaction(function () use ($inventory, $quantity, $unitCost, $supplier, $reason) {
            if ($unitCost) {
                $inventory->update(['cost_price' => $unitCost]);
            }

            if ($supplier) {
                $inventory->update(['supplier_name' => $supplier]);
            }

            return $this->adjustStock(
                $inventory,
                $quantity,
                'restock',
                $reason ?? 'Restock delivery',
            );
        });
    }

    /**
     * Mark stock as spoiled/wasted (common in wet markets).
     */
    public function markSpoiled(Inventory $inventory, int $quantity, ?string $reason = null): Inventory
    {
        return $this->adjustStock(
            $inventory,
            -abs($quantity),
            'spoiled',
            $reason ?? 'Product spoiled/expired',
        );
    }

    /**
     * Get movement history for an inventory item.
     */
    public function getHistory(Inventory $inventory, int $limit = 50): Collection
    {
        return InventoryLog::where('inventory_id', $inventory->id)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Get all recent activity logs for a vendor.
     */
    public function getVendorLogs(Vendor $vendor, int $days = 7, ?string $type = null): Collection
    {
        $query = InventoryLog::with('product')
            ->forVendor($vendor->id)
            ->recent($days)
            ->orderByDesc('created_at');

        if ($type) {
            $query->ofType($type);
        }

        return $query->get();
    }

    /**
     * Create an audit log entry.
     */
    private function createLog(
        Inventory $inventory,
        string $type,
        int $quantityChange,
        ?string $reason = null,
        ?string $referenceNumber = null,
        ?string $performedBy = null
    ): InventoryLog {
        $quantityBefore = $inventory->stock_quantity;
        $quantityAfter = max(0, $quantityBefore + $quantityChange);

        return InventoryLog::create([
            'inventory_id' => $inventory->id,
            'vendor_id' => $inventory->vendor_id,
            'product_id' => $inventory->product_id,
            'type' => $type,
            'quantity_before' => $quantityBefore,
            'quantity_change' => $quantityChange,
            'quantity_after' => $quantityAfter,
            'reason' => $reason,
            'reference_number' => $referenceNumber,
            'unit_cost' => $inventory->cost_price,
            'performed_by' => $performedBy,
        ]);
    }
}
