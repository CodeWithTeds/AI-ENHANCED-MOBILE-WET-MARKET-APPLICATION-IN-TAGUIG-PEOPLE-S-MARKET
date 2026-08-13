<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\InventoryMonitoringService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryMonitoringController extends Controller
{
    public function __construct(private readonly InventoryMonitoringService $inventoryService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/inventory/index', $this->inventoryService->getIndexData(
            $request->only(['search', 'stock_status', 'category', 'vendor'])
        ));
    }
}
