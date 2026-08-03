<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OrderService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class OrderController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly OrderService $orderService) {}

    /**
     * Place a new order.
     *
     * POST /orders
     * Body: { items: [{ product_id, product_name, quantity }], payment_method?, notes? }
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items'                     => 'required|array|min:1',
            'items.*.product_id'        => 'required|integer|exists:products,id',
            'items.*.product_name'      => 'required|string',
            'items.*.quantity'          => 'required|integer|min:1',
            'payment_method'            => 'nullable|string|in:cash,gcash,maya',
            'notes'                     => 'nullable|string|max:500',
        ]);

        try {
            $order = $this->orderService->placeOrder(
                $request->user(),
                $validated['items'],
                $validated['payment_method'] ?? 'cash',
                $validated['notes'] ?? null,
            );

            return $this->successResponse($order, 'Order placed successfully', 201);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get the authenticated customer's order history.
     *
     * GET /orders
     */
    public function index(Request $request): JsonResponse
    {
        $orders = $this->orderService->getCustomerOrders($request->user());

        return $this->successResponse($orders, 'Orders retrieved');
    }

    /**
     * Get a single order.
     *
     * GET /orders/{id}
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $order = $this->orderService->getOrder($request->user(), $id);

        return $this->successResponse($order, 'Order retrieved');
    }

    /**
     * Get orders for a vendor — only orders that contain their products.
     *
     * GET /vendor/orders
     */
    public function vendorOrders(Request $request): JsonResponse
    {
        $orders = $this->orderService->getVendorOrders($request->user());

        return $this->successResponse($orders, 'Vendor orders retrieved');
    }

    /**
     * Vendor updates an order's status.
     *
     * PATCH /vendor/orders/{id}/status
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|string|in:confirmed,processing,ready,completed,cancelled',
        ]);

        $order = $this->orderService->updateOrderStatus($request->user(), $id, $validated['status']);

        return $this->successResponse($order, 'Order status updated');
    }
}
