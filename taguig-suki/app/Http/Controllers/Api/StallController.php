<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stall;
use App\Services\Admin\StallComplaintService;
use App\Services\StallService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StallController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly StallService $stallService,
        private readonly StallComplaintService $complaintService
    ) {}

    public function index(): JsonResponse
    {
        $stalls = Stall::with('sectionRelation:id,name,color')
            ->select('id', 'section_id', 'section', 'stall_number', 'store_name', 'vendor_id', 'status')
            ->orderBy('section')
            ->orderBy('stall_number')
            ->get();

        return $this->successResponse($stalls, 'Stalls retrieved successfully');
    }

    public function sections(): JsonResponse
    {
        return $this->successResponse($this->stallService->getActiveSections(), 'Sections retrieved successfully');
    }

    public function vacantStalls(Request $request): JsonResponse
    {
        return $this->successResponse($this->stallService->getVacantStalls($request->section_id), 'Vacant stalls retrieved successfully');
    }

    public function submitComplaint(Request $request, Stall $stall): JsonResponse
    {
        $validated = $request->validate([
            'complaint_type' => 'required|in:bad_smell,cleanliness,noise,obstruction,improper_handling,other',
            'description' => 'required|string|max:1000',
        ]);

        $complaint = $this->complaintService->createComplaint($request->user(), $stall, $validated);

        return $this->successResponse($complaint, 'Stall report submitted successfully. Market admin will review.');
    }

    public function submitVendorComplaint(Request $request, \App\Models\Vendor $vendor): JsonResponse
    {
        $validated = $request->validate([
            'complaint_type' => 'required|in:bad_smell,cleanliness,noise,obstruction,improper_handling,other',
            'description' => 'required|string|max:1000',
        ]);

        $stall = Stall::where('vendor_id', $vendor->user_id)->first();
        if (! $stall) {
            $stall = Stall::where('store_name', $vendor->stall_name)->first();
        }

        if (! $stall) {
            $stall = Stall::firstOrCreate([
                'store_name' => $vendor->stall_name,
            ], [
                'section' => 'wet-section',
                'stall_number' => $vendor->stall_name,
                'vendor_id' => $vendor->user_id,
                'status' => 'occupied',
                'size' => 'medium',
                'monthly_rent' => 0,
            ]);
        }

        $complaint = $this->complaintService->createComplaint($request->user(), $stall, $validated);

        return $this->successResponse($complaint, 'Stall report submitted successfully. Market admin will review.');
    }
}
