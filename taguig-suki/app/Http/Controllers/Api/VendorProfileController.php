<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\VendorProfileService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorProfileController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly VendorProfileService $vendorProfileService) {}

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
            'promotion_updates' => 'sometimes|boolean',
        ]);

        return $this->successResponse(
            $this->vendorProfileService->updateNotificationPreferences($request->user(), $validated),
            'Notification preferences updated'
        );
    }
}
