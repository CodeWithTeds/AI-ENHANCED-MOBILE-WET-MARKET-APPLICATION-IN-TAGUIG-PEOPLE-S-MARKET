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
            'notes' => 'nullable|string|max:500',
        ]);

        $updated = $this->contractService->requestRenewal($vendor, $validated['notes'] ?? null);

        return $this->successResponse($updated, 'Contract renewal request submitted successfully to market admin.');
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
