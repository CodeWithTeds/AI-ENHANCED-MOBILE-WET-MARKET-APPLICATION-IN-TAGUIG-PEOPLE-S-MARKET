<?php

namespace App\Services;

use App\Enums\StockAdjustmentType;
use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Repositories\VendorRepositoryInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class InventoryService
{
    public function __construct(
        private readonly VendorRepositoryInterface $vendorRepository,
    ) {}

    public function getVendorInventory(User $user, array $filters = []): Collection
    {
        $vendor = $this->resolveVendor($user);

        $query = Inventory::with('product')
            ->forVendor($vendor->id)
            ->orderByDesc('updated_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['stock_status'])) {
            match ($filters['stock_status']) {
                'low_stock' => $query->lowStock(),
                'out_of_stock' => $query->outOfStock(),
                'in_stock' => $query->where('stock_quantity', '>', DB::raw('reorder_level')),
                default => null,
            };
        }

        if (!empty($filters['category'])) {
            $query->whereHas('product', fn ($q) => $q->where('category', $filters['category']));
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->whereHas('product', fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('category', 'like', "%{$search}%"));
        }

        return $query->get();
    }

    public function getVendorSummary(User $user): array
    {
        $vendor = $this->resolveVendor($user);
        $inventories = Inventory::forVendor($vendor->id)->get();

        return [
            'total_products' => $inventories->count(),
            'total_units' => $inventories->sum('stock_quantity'),
            'in_stock' => $inventories->filter(fn ($i) => $i->stock_quantity > $i->reorder_level)->count(),
            'low_stock' => $inventories->filter(fn ($i) => $i->isLowStock())->count(),
            'out_of_stock' => $inventories->filter(fn ($i) => $i->isOutOfStock())->count(),
            'total_cost_value' => round($inventories->sum(fn ($i) => ($i->cost_price ?? 0) * $i->stock_quantity), 2),
            'total_selling_value' => round($inventories->sum(fn ($i) => $i->selling_price * $i->stock_quantity), 2),
            'estimated_profit' => round($inventories->sum(fn ($i) => $i->selling_price * $i->stock_quantity) - $inventories->sum(fn ($i) => ($i->cost_price ?? 0) * $i->stock_quantity), 2),
        ];
    }

    public function createInventory(User $user, array $data): Inventory
    {
        $vendor = $this->resolveVendor($user);

        $product = Product::where('id', $data['product_id'])->where('vendor_id', $vendor->id)->first();

        if (!$product) {
            throw new NotFoundHttpException('Product not found or does not belong to you');
        }

        if (Inventory::where('product_id', $product->id)->where('vendor_id', $vendor->id)->exists()) {
            throw new UnprocessableEntityHttpException('Inventory record already exists for this product');
        }

        return DB::transaction(function () use ($vendor, $product, $data) {
            $inventory = Inventory::create([
                'product_id' => $product->id,
                'vendor_id' => $vendor->id,
                'stock_quantity' => $data['stock_quantity'] ?? 0,
                'reorder_level' => $data['reorder_level'] ?? 5,
                'max_stock_level' => $data['max_stock_level'] ?? null,
                'cost_price' => $data['cost_price'] ?? null,
                'selling_price' => $data['selling_price'] ?? $product->price,
                'markup_percentage' => $data['markup_percentage'] ?? null,
                'status' => $data['status'] ?? 'active',
            ]);

            if (($data['stock_quantity'] ?? 0) > 0) {
                $this->createLog($inventory, 'initial', $data['stock_quantity'], 'Initial stock entry');
            }

            return $inventory->load('product');
        });
    }

    public function show(User $user, Inventory $inventory): Inventory
    {
        $this->authorizeInventory($user, $inventory);

        return $inventory->load('product');
    }

    public function updateInventory(User $user, Inventory $inventory, array $data): Inventory
    {
        $this->authorizeInventory($user, $inventory);

        return DB::transaction(function () use ($inventory, $data) {
            $inventory->update($data);

            if (isset($data['selling_price'])) {
                $inventory->product->update(['price' => $data['selling_price']]);
            }

            return $inventory->fresh(['product']);
        });
    }

    public function adjustStock(User $user, Inventory $inventory, array $data): Inventory
    {
        $this->authorizeInventory($user, $inventory);

        $quantity = (int) $data['quantity'];
        $type = StockAdjustmentType::from($data['type']);

        if ($type->isOutgoing() && $quantity > 0) {
            $quantity = -$quantity;
        }

        if ($type->isIncoming() && $quantity < 0) {
            $quantity = abs($quantity);
        }

        if ($quantity < 0 && abs($quantity) > $inventory->stock_quantity) {
            throw new UnprocessableEntityHttpException('Insufficient stock. Current: ' . $inventory->stock_quantity);
        }

        return DB::transaction(function () use ($inventory, $quantity, $type, $data) {
            $this->createLog($inventory, $type->value, $quantity, $data['reason'] ?? null);

            $inventory->update(['stock_quantity' => max(0, $inventory->stock_quantity + $quantity)]);

            return $inventory->fresh(['product']);
        });
    }

    public function getHistory(User $user, Inventory $inventory, int $limit = 50): Collection
    {
        $this->authorizeInventory($user, $inventory);

        return InventoryLog::where('inventory_id', $inventory->id)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    public function getVendorLogs(User $user, int $days = 7, ?string $type = null): Collection
    {
        $vendor = $this->resolveVendor($user);

        $query = InventoryLog::with('product')
            ->forVendor($vendor->id)
            ->recent($days)
            ->orderByDesc('created_at');

        if ($type) {
            $query->ofType($type);
        }

        return $query->get();
    }

    public function deleteInventory(User $user, Inventory $inventory): void
    {
        $this->authorizeInventory($user, $inventory);

        $inventory->delete();
    }

    private function resolveVendor(User $user): Vendor
    {
        $vendor = $this->vendorRepository->findByUser($user);

        if (!$vendor) {
            throw new NotFoundHttpException('Vendor profile not found');
        }

        return $vendor;
    }

    private function authorizeInventory(User $user, Inventory $inventory): void
    {
        $vendor = $this->resolveVendor($user);

        if ($inventory->vendor_id !== $vendor->id) {
            throw new AccessDeniedHttpException('Unauthorized');
        }
    }

    private function createLog(Inventory $inventory, string $type, int $quantityChange, ?string $reason = null): InventoryLog
    {
        return InventoryLog::create([
            'inventory_id' => $inventory->id,
            'vendor_id' => $inventory->vendor_id,
            'product_id' => $inventory->product_id,
            'type' => $type,
            'quantity_before' => $inventory->stock_quantity,
            'quantity_change' => $quantityChange,
            'quantity_after' => max(0, $inventory->stock_quantity + $quantityChange),
            'reason' => $reason,
            'reference_number' => null,
            'unit_cost' => $inventory->cost_price,
            'performed_by' => null,
        ]);
    }
}
