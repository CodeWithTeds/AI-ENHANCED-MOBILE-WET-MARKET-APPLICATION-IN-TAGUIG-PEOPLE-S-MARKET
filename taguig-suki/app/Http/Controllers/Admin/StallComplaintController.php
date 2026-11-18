<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StallComplaint;
use App\Services\Admin\StallComplaintService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StallComplaintController extends Controller
{
    public function __construct(private readonly StallComplaintService $complaintService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/stalls/monitoring', $this->complaintService->getIndexData(
            $request->only(['stall_id', 'status', 'complaint_type', 'search'])
        ));
    }

    public function updateStatus(Request $request, StallComplaint $complaint): RedirectResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,in_review,complied,resolved,dismissed',
            'action_taken' => 'nullable|string|max:1000',
        ]);

        $this->complaintService->updateStatus(
            $complaint,
            $request->user(),
            $validated['status'],
            $validated['action_taken'] ?? null
        );

        return back()->with('success', 'Stall complaint status updated successfully.');
    }
}
