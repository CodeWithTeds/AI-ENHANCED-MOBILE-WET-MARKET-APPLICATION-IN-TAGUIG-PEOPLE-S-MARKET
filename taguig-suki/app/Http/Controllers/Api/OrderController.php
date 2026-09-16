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
     * Body: { items: [{ product_id, product_name, quantity }], payment_method?, payment_reference_number?, notes? }
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.product_name' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'payment_method' => 'nullable|string|in:cash,gcash,maya',
            'payment_reference_number' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $order = $this->orderService->placeOrder(
                $request->user(),
                $validated['items'],
                $validated['payment_method'] ?? 'cash',
                $validated['notes'] ?? null,
                $validated['payment_reference_number'] ?? null,
            );

            return $this->successResponse($order, 'Order placed successfully', 201);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Customer submits payment reference for GCash/Maya (after external transfer).
     *
     * POST /orders/{id}/payment-reference
     * Body: { payment_reference_number: string }
     */
    public function submitPaymentReference(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'payment_reference_number' => 'required|string|max:100',
        ]);

        try {
            $order = $this->orderService->submitPaymentReference(
                $request->user(),
                $id,
                $validated['payment_reference_number']
            );

            return $this->successResponse($order, 'Payment proof submitted — pending verification', 200);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get vendors' GCash/Maya details for checkout display.
     * POST /orders/payment-details  { product_ids: [1,2] }
     * Or GET with query ?product_ids=1,2
     */
    public function vendorsPaymentDetails(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_ids' => 'required|array|min:1|max:50',
            'product_ids.*' => 'integer|exists:products,id',
        ]);

        $details = $this->orderService->getVendorsPaymentDetails($validated['product_ids']);

        return $this->successResponse($details, 'Vendors payment details retrieved');
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
     * Real-time order tracking with status timeline.
     *
     * GET /orders/{id}/track
     */
    public function track(Request $request, int $id): JsonResponse
    {
        $order = $this->orderService->track($request->user(), $id);

        return $this->successResponse($order, 'Order tracking retrieved');
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
     * Get vendor's pending-verification payments.
     *
     * GET /vendor/payments/pending
     */
    public function vendorPendingPayments(Request $request): JsonResponse
    {
        $orders = $this->orderService->getVendorPendingPayments($request->user());

        return $this->successResponse($orders, 'Pending payments retrieved');
    }

    /**
     * Vendor verifies (approve/reject) a customer's GCash/Maya payment.
     *
     * PATCH /vendor/orders/{id}/verify-payment
     * Body: { action: verify|reject }
     */
    public function verifyPayment(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|string|in:verify,approve,reject,decline,reject_payment,approve_payment',
        ]);

        // Normalize action
        $action = in_array($validated['action'], ['verify', 'approve', 'approve_payment']) ? 'verify' : 'reject';

        try {
            $order = $this->orderService->verifyPayment($request->user(), $id, $action);

            $message = $action === 'verify' ? 'Payment verified as Paid' : 'Payment proof rejected';

            return $this->successResponse($order, $message);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 403);
        }
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

    /**
     * Get vendor sales history, revenue analytics, and completed transactions.
     *
     * GET /vendor/sales
     */
    public function vendorSales(Request $request): JsonResponse
    {
        $period = $request->query('period', 'all');
        $analytics = $this->orderService->getVendorSalesAnalytics($request->user(), $period);

        return $this->successResponse($analytics, 'Vendor sales analytics retrieved');
    }
}
