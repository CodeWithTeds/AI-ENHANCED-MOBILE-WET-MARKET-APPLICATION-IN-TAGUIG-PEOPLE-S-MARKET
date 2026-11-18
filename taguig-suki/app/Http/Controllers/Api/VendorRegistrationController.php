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

    public function __construct(private readonly VendorRegistrationService $registrationService) {}

    public function register(VendorRegisterRequest $request): JsonResponse
    {
        $fileKeys = ['business_permit', 'stall_lease', 'valid_id', 'sanitary_permit', 'dti_registration'];
        $files = [];
        foreach ($fileKeys as $key) {
            if ($request->hasFile($key)) {
                $files[$key] = $request->file($key);
            }
        }

        return $this->successResponse(
            $this->registrationService->register($request->safe()->except($fileKeys), $files),
            'Vendor registered successfully. Awaiting admin approval.',
            201
        );
    }

    public function status(Request $request): JsonResponse
    {
        return $this->successResponse($this->registrationService->getStatus($request->user()), 'Vendor status retrieved');
    }
}
