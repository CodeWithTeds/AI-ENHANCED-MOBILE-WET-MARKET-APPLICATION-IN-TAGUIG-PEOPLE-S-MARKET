<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StallRentalPayment;
use App\Services\Admin\StallRentalService;
use App\Services\Admin\VendorContractService;
use App\Services\VendorProfileService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorProfileController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly VendorProfileService $vendorProfileService,
        private readonly VendorContractService $contractService,
        private readonly StallRentalService $rentalService
    ) {}

    public function show(Request $request): JsonResponse
    {
        return $this->successResponse(
            $this->vendorProfileService->getBusinessProfile($request->user()),
            'Business profile retrieved'
        );
    }

    public function updateBusiness(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'stall_name' => 'sometimes|string|max:255',
            'opening_time' => 'sometimes|string|max:10',
            'closing_time' => 'sometimes|string|max:10',
            'product_categories' => 'sometimes|array',
            'product_categories.*' => 'string',
        ]);

        return $this->successResponse(
            $this->vendorProfileService->updateBusinessInfo($request->user(), $validated),
            'Business info updated successfully'
        );
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        return $this->successResponse(
            $this->vendorProfileService->changePassword($request->user(), $validated),
            'Password changed successfully'
        );
    }

    public function updateNotifications(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_alerts' => 'sometimes|boolean',
            'low_stock_alerts' => 'sometimes|boolean',
            'review_alerts' => 'sometimes|boolean',
            'promotion_updates' => 'sometimes|boolean',
        ]);

        return $this->successResponse(
            $this->vendorProfileService->updateNotificationPreferences($request->user(), $validated),
            'Notification preferences updated'
        );
    }

    public function requestContractRenewal(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found.', 404);
        }

        $validated = $request->validate([
            'duration_months' => 'nullable|integer|in:1,3,6,12',
            'notes' => 'nullable|string|max:500',
        ]);

        $contractReq = $this->contractService->submitContractRequest(
            $vendor,
            'renewal',
            $validated['duration_months'] ?? 12,
            $validated['notes'] ?? null
        );

        return $this->successResponse($contractReq, 'Contract renewal request submitted successfully for administrative review.');
    }

    public function submitContractRequest(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found.', 404);
        }

        $validated = $request->validate([
            'type' => 'required|in:renewal,cancellation',
            'duration_months' => 'required_if:type,renewal|nullable|integer|in:1,3,6,12',
            'reason' => 'nullable|string|max:1000',
        ]);

        $contractReq = $this->contractService->submitContractRequest(
            $vendor,
            $validated['type'],
            $validated['duration_months'] ?? null,
            $validated['reason'] ?? null
        );

        $typeLabel = $validated['type'] === 'renewal' ? 'Contract renewal' : 'Contract cancellation';

        return $this->successResponse(
            $contractReq->fresh(['vendor']),
            "{$typeLabel} request submitted successfully. It will undergo administrative review before taking effect."
        );
    }

    public function getContractDetails(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found.', 404);
        }

        $latestRequest = $vendor->latestContractRequest;
        $today = now()->startOfDay();
        $daysUntilExpiration = null;

        if ($vendor->contract_end_date) {
            $endDate = \Carbon\Carbon::parse($vendor->contract_end_date)->startOfDay();
            $daysUntilExpiration = $today->diffInDays($endDate, false); // negative if expired
        }

        return $this->successResponse([
            'vendor_id' => $vendor->id,
            'stall_name' => $vendor->stall_name,
            'stall_location' => $vendor->stall_location,
            'contract_start_date' => $vendor->contract_start_date,
            'contract_end_date' => $vendor->contract_end_date,
            'contract_duration_months' => $vendor->contract_duration_months,
            'contract_status' => $vendor->contract_status,
            'days_until_expiration' => $daysUntilExpiration,
            'is_expiring_soon' => $daysUntilExpiration !== null && $daysUntilExpiration <= 30 && $daysUntilExpiration >= 0,
            'is_expired' => $daysUntilExpiration !== null && $daysUntilExpiration < 0,
            'latest_request' => $latestRequest ? [
                'id' => $latestRequest->id,
                'type' => $latestRequest->type,
                'requested_duration_months' => $latestRequest->requested_duration_months,
                'status' => $latestRequest->status,
                'reason' => $latestRequest->reason,
                'admin_notes' => $latestRequest->admin_notes,
                'created_at' => $latestRequest->created_at->toIso8601String(),
                'reviewed_at' => $latestRequest->reviewed_at?->toIso8601String(),
            ] : null,
        ], 'Contract details retrieved successfully.');
    }

    public function getRentalDues(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (!$vendor) {
            return $this->errorResponse('Vendor profile not found.', 404);
        }

        $dues = $vendor->rentalPayments()
            ->with('stall:id,stall_number,monthly_rent,section')
            ->orderByDesc('billing_period')
            ->get();

        return $this->successResponse([
            'dues' => $dues,
            'contract' => [
                'start_date' => $vendor->contract_start_date,
                'end_date' => $vendor->contract_end_date,
                'status' => $vendor->contract_status,
                'duration_months' => $vendor->contract_duration_months,
            ],
        ], 'Rental dues and contract retrieved');
    }

    public function payRentalDue(Request $request, StallRentalPayment $rental): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (!$vendor || $rental->vendor_id !== $vendor->id) {
            return $this->errorResponse('Unauthorized to pay this rental due.', 403);
        }

        $validated = $request->validate([
            'payment_method' => 'required|in:cash,gcash,maya,bank_transfer',
            'payment_reference' => 'nullable|string|max:100',
            'proof_image' => 'nullable|file|mimes:jpeg,png,jpg,pdf|max:5120',
        ]);

        $updated = $this->rentalService->recordPayment(
            $rental,
            $validated['payment_method'],
            $validated['payment_reference'] ?? null,
            $request->file('proof_image')
        );

        return $this->successResponse($updated, 'Payment submitted. Awaiting market admin verification.');
    }
}
