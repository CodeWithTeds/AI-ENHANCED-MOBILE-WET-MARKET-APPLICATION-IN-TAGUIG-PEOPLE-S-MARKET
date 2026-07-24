<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VendorRegisterRequest;
use App\Services\VendorRegistrationService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorRegistrationController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly VendorRegistrationService $registrationService,
    ) {}

    public function register(VendorRegisterRequest $request): JsonResponse
    {
        $result = $this->registrationService->register(
            $request->safe()->except(['business_permit', 'stall_lease', 'valid_id']),
            [
                'business_permit' => $request->file('business_permit'),
                'stall_lease' => $request->file('stall_lease'),
                'valid_id' => $request->file('valid_id'),
            ]
        );

        return $this->successResponse($result, 'Vendor registered successfully. Awaiting admin approval.', 201);
    }

    public function status(Request $request): JsonResponse
    {
        $vendor = $this->registrationService->getStatus($request->user());

        if (!$vendor) {
            return $this->errorResponse('No vendor profile found', 404);
        }

        return $this->successResponse($vendor, 'Vendor status retrieved');
    }
}
