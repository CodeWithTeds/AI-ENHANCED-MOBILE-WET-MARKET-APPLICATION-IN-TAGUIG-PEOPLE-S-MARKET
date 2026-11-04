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
            'items.*.quantity' => 'required|numeric|min:0.5',
            'payment_method' => 'nullable|string|in:cash,gcash,maya',
            'payment_reference_number' => 'nullable|string|max:100',
            'vendor_payments' => 'nullable|array',
            'vendor_payments.*.vendor_id' => 'required_with:vendor_payments|integer|exists:vendors,id',
            'vendor_payments.*.payment_reference_number' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $order = $this->orderService->placeOrder(
                $request->user(),
                $validated['items'],
                $validated['payment_method'] ?? 'cash',
                $validated['notes'] ?? null,
                $validated['payment_reference_number'] ?? null,
                $validated['vendor_payments'] ?? [],
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
     * Body: { payment_reference_number: string, vendor_id?: int }
     */
    public function submitPaymentReference(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'payment_reference_number' => 'required|string|max:100',
            'vendor_id' => 'nullable|integer|exists:vendors,id',
        ]);

        try {
            $order = $this->orderService->submitPaymentReference(
                $request->user(),
                $id,
                $validated['payment_reference_number'],
                $validated['vendor_id'] ?? null
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
     * POST /orders/payment-details  { product_ids?: [1,2], items?: [{ product_id: 1, quantity: 2 }] }
     * Or GET with query ?product_ids=1,2
     */
    public function vendorsPaymentDetails(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_ids' => 'sometimes|array|max:50',
            'product_ids.*' => 'integer|exists:products,id',
            'items' => 'sometimes|array|max:50',
            'items.*.product_id' => 'required_with:items|integer|exists:products,id',
            'items.*.quantity' => 'required_with:items|numeric|min:0.01',
        ]);

        $productIds = [];
        $quantities = [];

        if (!empty($validated['items'])) {
            foreach ($validated['items'] as $it) {
                $pid = (int) $it['product_id'];
                $productIds[] = $pid;
                $quantities[$pid] = ($quantities[$pid] ?? 0) + (float) $it['quantity'];
            }
        } elseif (!empty($validated['product_ids'])) {
            $productIds = $validated['product_ids'];
        } else {
            return response()->json([
                'status' => 'error',
                'message' => 'Either items or product_ids must be provided.',
            ], 422);
        }

        $details = $this->orderService->getVendorsPaymentDetails(array_values(array_unique($productIds)), $quantities);

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
            'vendor_id' => 'nullable|integer|exists:vendors,id',
        ]);

        // Normalize action
        $action = in_array($validated['action'], ['verify', 'approve', 'approve_payment']) ? 'verify' : 'reject';

        try {
            $order = $this->orderService->verifyPayment($request->user(), $id, $action, $validated['vendor_id'] ?? null);

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
            'status' => 'required|string|in:confirmed,ready,completed,cancelled',
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
