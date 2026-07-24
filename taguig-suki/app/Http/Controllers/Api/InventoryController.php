<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInventoryRequest;
use App\Http\Requests\UpdateInventoryRequest;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Vendor;
use App\Services\InventoryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly InventoryService $inventoryService,
    ) {}

    /**
     * GET /inventory
     * List all inventory items for the authenticated vendor.
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        $filters = $request->only(['status', 'stock_status', 'category', 'search']);

        $inventory = $this->inventoryService->getVendorInventory($vendor, $filters);

        return $this->successResponse($inventory, 'Inventory retrieved');
    }

    /**
     * GET /inventory/summary
     * Get stock overview/dashboard stats.
     */
    public function summary(Request $request): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        $summary = $this->inventoryService->getVendorSummary($vendor);

        return $this->successResponse($summary, 'Inventory summary retrieved');
    }

    /**
     * POST /inventory
     * Create a new inventory record for a product.
     */
    public function store(StoreInventoryRequest $request): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        $product = Product::where('id', $request->product_id)
            ->where('vendor_id', $vendor->id)
            ->first();

        if (!$product) {
            return $this->errorResponse('Product not found or does not belong to you', 404);
        }

        // Check if inventory already exists for this product
        $existing = Inventory::where('product_id', $product->id)
            ->where('vendor_id', $vendor->id)
            ->first();

        if ($existing) {
            return $this->errorResponse('Inventory record already exists for this product', 422);
        }

        $inventory = $this->inventoryService->createInventory($vendor, $product, $request->validated());

        return $this->successResponse(
            $inventory->load('product'),
            'Inventory created successfully',
            201
        );
    }

    /**
     * GET /inventory/{inventory}
     * Get a single inventory item with product details.
     */
    public function show(Request $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $inventory->load('product');

        return $this->successResponse($inventory, 'Inventory item retrieved');
    }

    /**
     * PUT /inventory/{inventory}
     * Update inventory details (pricing, stock levels, status).
     */
    public function update(UpdateInventoryRequest $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $updated = $this->inventoryService->updateInventory($inventory, $request->validated());

        return $this->successResponse($updated, 'Inventory updated successfully');
    }

    /**
     * POST /inventory/{inventory}/adjust
     * Adjust stock quantity (restock, sold, spoiled, etc.)
     */
    public function adjustStock(Request $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $request->validate([
            'quantity' => ['required', 'integer'],
            'type' => ['required', 'in:restock,sold,spoiled,adjustment'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $quantity = (int) $request->quantity;
        $type = $request->type;

        // For outgoing types, ensure quantity is negative
        if (in_array($type, ['sold', 'spoiled']) && $quantity > 0) {
            $quantity = -$quantity;
        }

        // For incoming types, ensure quantity is positive
        if ($type === 'restock' && $quantity < 0) {
            $quantity = abs($quantity);
        }

        // Validate sufficient stock for outgoing
        if ($quantity < 0 && abs($quantity) > $inventory->stock_quantity) {
            return $this->errorResponse(
                'Insufficient stock. Current: ' . $inventory->stock_quantity,
                422
            );
        }

        $updated = $this->inventoryService->adjustStock(
            $inventory,
            $quantity,
            $type,
            $request->reason,
        );

        return $this->successResponse($updated->load('product'), 'Stock adjusted successfully');
    }

    /**
     * GET /inventory/{inventory}/history
     * Get stock movement history for an item.
     */
    public function history(Request $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $limit = min((int) $request->get('limit', 50), 100);
        $logs = $this->inventoryService->getHistory($inventory, $limit);

        return $this->successResponse($logs, 'Inventory history retrieved');
    }

    /**
     * GET /inventory/logs
     * Get all recent stock movement logs for the vendor.
     */
    public function logs(Request $request): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found', 404);
        }

        $days = min((int) $request->get('days', 7), 30);
        $type = $request->get('type');

        $logs = $this->inventoryService->getVendorLogs($vendor, $days, $type);

        return $this->successResponse($logs, 'Activity logs retrieved');
    }

    /**
     * DELETE /inventory/{inventory}
     * Delete an inventory record.
     */
    public function destroy(Request $request, Inventory $inventory): JsonResponse
    {
        $vendor = $this->getVendor($request);

        if (!$vendor || $inventory->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized', 403);
        }

        $inventory->delete();

        return $this->successResponse(null, 'Inventory record deleted');
    }

    /**
     * Get the vendor profile for the authenticated user.
     */
    private function getVendor(Request $request): ?Vendor
    {
        return Vendor::where('user_id', $request->user()->id)->first();
    }
}
