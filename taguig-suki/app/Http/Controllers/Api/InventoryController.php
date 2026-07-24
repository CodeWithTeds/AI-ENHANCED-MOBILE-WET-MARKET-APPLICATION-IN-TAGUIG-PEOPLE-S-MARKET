<?php

namespace App\Http\Controllers\Api;

use App\Enums\StockAdjustmentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\AdjustStockRequest;
use App\Http\Requests\StoreInventoryRequest;
use App\Http\Requests\UpdateInventoryRequest;
use App\Models\Inventory;
use App\Models\Product;
use App\Repositories\VendorRepositoryInterface;
use App\Services\InventoryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly VendorRepositoryInterface $vendorRepository,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        return $this->successResponse(
            $this->inventoryService->getVendorInventory($vendor, $request->only(['status', 'stock_status', 'category', 'search'])),
            'Inventory retrieved'
        );
    }

    public function summary(Request $request): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        return $this->successResponse(
            $this->inventoryService->getVendorSummary($vendor),
            'Inventory summary retrieved'
        );
    }

    public function store(StoreInventoryRequest $request): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        $product = Product::where('id', $request->product_id)
            ->where('vendor_id', $vendor->id)
            ->first();

        if (!$product) {
            return $this->errorResponse('Product not found or does not belong to you', 404);
        }

        $existing = Inventory::where('product_id', $product->id)
            ->where('vendor_id', $vendor->id)
            ->exists();

        if ($existing) {
            return $this->errorResponse('Inventory record already exists for this product', 422);
        }

        return $this->successResponse(
            $this->inventoryService->createInventory($vendor, $product, $request->validated())->load('product'),
            'Inventory created successfully',
            201
        );
    }

    public function show(Request $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse($inventory->load('product'), 'Inventory item retrieved');
    }

    public function update(UpdateInventoryRequest $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse(
            $this->inventoryService->updateInventory($inventory, $request->validated()),
            'Inventory updated successfully'
        );
    }

    public function adjustStock(AdjustStockRequest $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $quantity = (int) $request->quantity;
        $type = StockAdjustmentType::from($request->type);

        if ($type->isOutgoing() && $quantity > 0) {
            $quantity = -$quantity;
        }

        if ($type->isIncoming() && $quantity < 0) {
            $quantity = abs($quantity);
        }

        if ($quantity < 0 && abs($quantity) > $inventory->stock_quantity) {
            return $this->errorResponse(
                'Insufficient stock. Current: ' . $inventory->stock_quantity,
                422
            );
        }

        return $this->successResponse(
            $this->inventoryService->adjustStock($inventory, $quantity, $type->value, $request->reason)->load('product'),
            'Stock adjusted successfully'
        );
    }

    public function history(Request $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        return $this->successResponse(
            $this->inventoryService->getHistory($inventory, min((int) $request->get('limit', 50), 100)),
            'Inventory history retrieved'
        );
    }

    public function logs(Request $request): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        return $this->successResponse(
            $this->inventoryService->getVendorLogs($vendor, min((int) $request->get('days', 7), 30), $request->get('type')),
            'Activity logs retrieved'
        );
    }

    public function destroy(Request $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->vendorRepository->findByUser($request->user());

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $inventory->delete();

        return $this->successResponse(null, 'Inventory record deleted');
    }
}
