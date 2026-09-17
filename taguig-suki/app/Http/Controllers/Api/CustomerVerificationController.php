<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CustomerVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerVerificationController extends Controller
{
    public function __construct(private readonly CustomerVerificationService $service) {}

    /**
     * GET /profile/verification
     */
    public function show(Request $request): JsonResponse
    {
        $data = $this->service->getVerification($request->user());

        // Re-format with request host for proper image URL
        $verification = \App\Models\CustomerVerification::where('user_id', $request->user()->id)->first();
        if ($verification) {
            $data = $this->service->format($verification, $request);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Verification retrieved',
            'data' => $data,
        ]);
    }

    /**
     * POST /profile/verification  (multipart/form-data)
     * Fields: id_type, id_image (file)
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $data = $this->service->upload($request, $request->user());

            // Re-format with host
            $verification = \App\Models\CustomerVerification::where('user_id', $request->user()->id)->first();
            if ($verification) {
                $data = $this->service->format($verification, $request);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'ID verification submitted. Status: pending review.',
                'data' => $data,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Customer verification upload failed', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /profile/verification
     */
    public function destroy(Request $request): JsonResponse
    {
        try {
            $data = $this->service->remove($request->user());

            return response()->json([
                'status' => 'success',
                'message' => 'Verification removed',
                'data' => $data,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
