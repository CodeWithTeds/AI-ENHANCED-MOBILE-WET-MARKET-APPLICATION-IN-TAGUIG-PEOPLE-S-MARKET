<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateOrderStatusRequest;
use App\Models\Order;
use App\Services\Admin\OrderManagementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderManagementController extends Controller
{
    public function __construct(private readonly OrderManagementService $orderService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/orders/index', $this->orderService->getIndexData(
            $request->only(['search', 'status', 'payment_method'])
        ));
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order): RedirectResponse
    {
        $updated = $this->orderService->updateStatus($order, $request->status);

        return back()->with('success', "Order {$updated->order_number} updated to ".ucfirst($request->status).'.');
    }
}
