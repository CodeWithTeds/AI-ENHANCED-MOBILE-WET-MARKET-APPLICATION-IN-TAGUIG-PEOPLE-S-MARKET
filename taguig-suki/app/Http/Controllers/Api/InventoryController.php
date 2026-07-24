<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdjustStockRequest;
use App\Http\Requests\StoreInventoryRequest;
use App\Http\Requests\UpdateInventoryRequest;
use App\Models\Inventory;
use App\Services\InventoryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly InventoryService $inventoryService) {}

    public function index(Request $request): JsonResponse
    {
        return $this->successResponse($this->inventoryService->getVendorInventory($request->user(), $request->only(['status', 'stock_status', 'category', 'search'])), 'Inventory retrieved');
    }

    public function summary(Request $request): JsonResponse
    {
        return $this->successResponse($this->inventoryService->getVendorSummary($request->user()), 'Inventory summary retrieved');
    }

    public function store(StoreInventoryRequest $request): JsonResponse
    {
        return $this->successResponse($this->inventoryService->createInventory($request->user(), $request->validated()), 'Inventory created successfully', 201);
    }

    public function show(Request $request, Inventory $inventory): JsonResponse
    {
        return $this->successResponse($this->inventoryService->show($request->user(), $inventory), 'Inventory item retrieved');
    }

    public function update(UpdateInventoryRequest $request, Inventory $inventory): JsonResponse
    {
        return $this->successResponse($this->inventoryService->updateInventory($request->user(), $inventory, $request->validated()), 'Inventory updated successfully');
    }

    public function adjustStock(AdjustStockRequest $request, Inventory $inventory): JsonResponse
    {
        return $this->successResponse($this->inventoryService->adjustStock($request->user(), $inventory, $request->validated()), 'Stock adjusted successfully');
    }

    public function history(Request $request, Inventory $inventory): JsonResponse
    {
        return $this->successResponse($this->inventoryService->getHistory($request->user(), $inventory, min((int) $request->get('limit', 50), 100)), 'Inventory history retrieved');
    }

    public function logs(Request $request): JsonResponse
    {
        return $this->successResponse($this->inventoryService->getVendorLogs($request->user(), min((int) $request->get('days', 7), 30), $request->get('type')), 'Activity logs retrieved');
    }

    public function destroy(Request $request, Inventory $inventory): JsonResponse
    {
        return $this->successResponse($this->inventoryService->deleteInventory($request->user(), $inventory), 'Inventory record deleted');
    }
}
