<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CustomerProfileService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerProfileController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly CustomerProfileService $customerProfileService) {}

    public function show(Request $request): JsonResponse
    {
        return $this->successResponse(
            $this->customerProfileService->getProfile($request->user()),
            'Profile retrieved'
        );
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => [
                'sometimes',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($request->user()->id),
            ],
        ]);

        return $this->successResponse(
            $this->customerProfileService->updateProfile($request->user(), $validated),
            'Profile updated successfully'
        );
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        return $this->successResponse(
            $this->customerProfileService->changePassword($request->user(), $validated),
            'Password changed successfully'
        );
    }

    public function updateNotifications(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_alerts' => 'sometimes|boolean',
            'promotion_updates' => 'sometimes|boolean',
        ]);

        return $this->successResponse(
            $this->customerProfileService->updateNotificationPreferences($request->user(), $validated),
            'Notification preferences updated'
        );
    }
}
