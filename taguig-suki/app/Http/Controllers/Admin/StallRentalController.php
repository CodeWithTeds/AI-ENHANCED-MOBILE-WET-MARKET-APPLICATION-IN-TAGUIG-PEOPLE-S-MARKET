<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StallRentalPayment;
use App\Models\Vendor;
use App\Models\VendorContractRequest;
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
            'vendor_id' => ['nullable'],
            'due_date' => ['nullable', 'date'],
            'amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $vendorId = !empty($validated['vendor_id']) && $validated['vendor_id'] !== 'all' ? (int) $validated['vendor_id'] : null;
        $dueDate = !empty($validated['due_date']) ? \Carbon\Carbon::parse($validated['due_date']) : null;
        $amount = !empty($validated['amount']) ? (float) $validated['amount'] : null;

        $count = $this->rentalService->generateMonthlyBills($validated['billing_period'], $dueDate, $vendorId, $amount);

        if ($vendorId) {
            $vendor = Vendor::find($vendorId);
            $targetMsg = $vendor ? "for {$vendor->stall_name}" : 'for selected vendor';
        } else {
            $targetMsg = 'for all occupied stalls';
        }

        return back()->with('success', "Generated {$count} rental bill(s) {$targetMsg} for period {$validated['billing_period']}. Affected vendor(s) have been notified.");
    }

    public function updateStatus(Request $request, StallRentalPayment $rental): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:paid,unpaid,pending,overdue'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'payment_reference' => ['nullable', 'string', 'max:100'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $this->rentalService->updatePaymentStatus(
            $rental,
            $validated['status'],
            $validated,
            $request->user()
        );

        return back()->with('success', "Rental payment status for {$rental->billing_period} updated to " . strtoupper($validated['status']) . ".");
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
        $this->contractService->approveRenewal($vendor, $months, $request->user());

        return back()->with('success', "Contract for {$vendor->stall_name} renewed for {$months} months.");
    }

    public function reviewContractRequest(Request $request, VendorContractRequest $contractRequest): RedirectResponse
    {
        $validated = $request->validate([
            'decision' => ['required', 'string', 'in:approved,rejected'],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
            'additional_months' => ['nullable', 'integer', 'in:1,3,6,12'],
        ]);

        $this->contractService->reviewContractRequest(
            $contractRequest,
            $validated['decision'],
            $validated['admin_notes'] ?? null,
            $request->user(),
            $validated['additional_months'] ?? null
        );

        $actionText = $validated['decision'] === 'approved' ? 'approved' : 'rejected';
        $typeText = $contractRequest->type === 'renewal' ? 'Contract renewal' : 'Contract cancellation';

        return back()->with('success', "{$typeText} for {$contractRequest->vendor->stall_name} has been {$actionText}. The vendor was automatically notified.");
    }
}
