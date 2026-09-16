<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\PaymentManagementService;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class PaymentManagementController extends Controller
{
    public function __construct(
        private readonly PaymentManagementService $paymentService,
        private readonly OrderService $orderService,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/payments/index', $this->paymentService->getIndexData(
            $request->only(['search', 'payment_method', 'payment_status', 'status', 'date_from', 'date_to'])
        ));
    }

    /**
     * Admin verifies or rejects a GCash/Maya payment.
     * PATCH /admin/dashboard/payments/{order}/verify
     */
    public function verify(Request $request, int $order): RedirectResponse
    {
        $validated = $request->validate([
            'action' => 'required|string|in:verify,approve,reject,decline',
        ]);

        $action = in_array($validated['action'], ['verify', 'approve']) ? 'verify' : 'reject';

        try {
            $this->orderService->verifyPayment($request->user(), $order, $action);
        } catch (UnprocessableEntityHttpException $e) {
            return back()->withErrors(['payment' => $e->getMessage()]);
        }

        return back()->with('success', $action === 'verify' ? 'Payment verified as Paid.' : 'Payment rejected.');
    }
}
