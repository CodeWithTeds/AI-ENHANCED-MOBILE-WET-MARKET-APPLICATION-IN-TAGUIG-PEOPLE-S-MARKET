<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Services\Admin\FeedbackManagementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    public function __construct(private readonly FeedbackManagementService $feedbackService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/feedback/index', $this->feedbackService->getIndexData(
            $request->only(['search', 'status', 'type', 'rating'])
        ));
    }

    public function respond(Request $request, Review $review): RedirectResponse
    {
        $request->validate([
            'admin_response' => 'required|string|max:2000',
        ]);

        $this->feedbackService->respond($review, $request->admin_response);

        return back()->with('success', 'Response submitted and review resolved.');
    }

    public function updateStatus(Request $request, Review $review): RedirectResponse
    {
        $request->validate([
            'status' => 'required|in:pending,in_review,resolved,dismissed',
            'admin_response' => 'nullable|string|max:2000',
        ]);

        $this->feedbackService->updateStatus($review, $request->status, $request->admin_response);

        return back()->with('success', 'Review status updated.');
    }
}
