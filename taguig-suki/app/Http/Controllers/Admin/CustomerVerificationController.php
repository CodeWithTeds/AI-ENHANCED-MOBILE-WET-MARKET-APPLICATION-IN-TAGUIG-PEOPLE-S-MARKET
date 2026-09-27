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

    public function index(Request $request): RedirectResponse
    {
        return redirect()->route('users.index', array_filter(['verification_status' => $request->query('status')]));
    }

    public function approve(Request $request, CustomerVerification $customerVerification): RedirectResponse
    {
        $this->service->approve($customerVerification, $request->user());
        return back()->with('success', 'Verification approved.');
    }

    public function reject(Request $request, CustomerVerification $customerVerification): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $this->service->reject($customerVerification, $request->user(), $validated['rejection_reason'] ?? null);
        return back()->with('success', 'Verification rejected.');
    }
}
