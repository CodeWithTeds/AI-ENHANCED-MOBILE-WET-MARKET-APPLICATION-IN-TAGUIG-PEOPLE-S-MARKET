<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StallRentalPayment;
use App\Models\Vendor;
use App\Services\Admin\StallRentalService;
use App\Services\Admin\VendorContractService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StallRentalController extends Controller
{
    public function __construct(
        private readonly StallRentalService $rentalService,
        private readonly VendorContractService $contractService
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/rentals/index', $this->rentalService->getRentalsIndexData(
            $request->only(['status', 'billing_period', 'vendor_id', 'search'])
        ));
    }

    public function reports(Request $request): Response
    {
        return Inertia::render('admin/rentals/reports', $this->rentalService->getRentalReportData(
            $request->only(['period'])
        ));
    }

    public function generateBills(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'billing_period' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        $count = $this->rentalService->generateMonthlyBills($validated['billing_period']);

        return back()->with('success', "Generated {$count} rental bill(s) for period {$validated['billing_period']}.");
    }

    public function verifyPayment(Request $request, StallRentalPayment $rental): RedirectResponse
    {
        $this->rentalService->verifyPayment($rental, $request->user());

        return back()->with('success', "Rental payment for {$rental->billing_period} verified successfully.");
    }

    public function renewContractApprove(Request $request, Vendor $vendor): RedirectResponse
    {
        $validated = $request->validate([
            'additional_months' => ['nullable', 'integer', 'min:1', 'max:60'],
        ]);

        $months = (int) ($validated['additional_months'] ?? 12);
        $this->contractService->approveRenewal($vendor, $months);

        return back()->with('success', "Contract for {$vendor->stall_name} renewed for {$months} months.");
    }
}
