<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\PaymentManagementService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentManagementController extends Controller
{
    public function __construct(private readonly PaymentManagementService $paymentService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/payments/index', $this->paymentService->getIndexData(
            $request->only(['search', 'payment_method', 'payment_status', 'status', 'date_from', 'date_to'])
        ));
    }
}
