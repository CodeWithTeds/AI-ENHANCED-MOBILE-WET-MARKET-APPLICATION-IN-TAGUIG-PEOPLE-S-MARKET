<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomerVerification;
use App\Services\CustomerVerificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerVerificationController extends Controller
{
    public function __construct(private readonly CustomerVerificationService $service) {}

    public function index(Request $request): Response
    {
        $status = $request->query('status');
        $verifications = $this->service->listForAdmin($status, $request);

        return Inertia::render('admin/verifications/index', [
            'verifications' => $verifications,
            'filters' => ['status' => $status],
            'idTypes' => CustomerVerificationService::ALLOWED_ID_TYPES,
        ]);
    }

    public function approve(Request $request, CustomerVerification $customerVerification): RedirectResponse
    {
        $this->service->approve($customerVerification, $request->user());
        return back()->with('success', 'Verification approved.');
    }

    public function reject(Request $request, CustomerVerification $customerVerification): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $this->service->reject($customerVerification, $request->user(), $validated['rejection_reason'] ?? null);
        return back()->with('success', 'Verification rejected.');
    }
}
