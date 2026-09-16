<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VendorPaymentSettingsController extends Controller
{
    /**
     * Get vendor's own payment settings (private).
     * GET /vendor/payment-settings
     */
    public function show(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;

        if (!$vendor) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vendor profile not found.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Payment settings retrieved',
            'data' => $this->formatVendorPayment($vendor),
        ]);
    }

    /**
     * Update vendor's GCash/Maya account numbers and QR codes.
     * PUT /vendor/payment-settings  (multipart/form-data or JSON)
     */
    public function update(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;

        if (!$vendor) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vendor profile not found.',
            ], 404);
        }

        $validated = $request->validate([
            'gcash_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]{10,20}$/'],
            'maya_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]{10,20}$/'],
            'gcash_qr' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
            'maya_qr' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
            'remove_gcash_qr' => ['nullable', 'boolean'],
            'remove_maya_qr' => ['nullable', 'boolean'],
        ]);

        $data = [];

        // Text fields — allow clearing by sending empty string
        if ($request->has('gcash_number')) {
            $data['gcash_number'] = $validated['gcash_number'] ? trim($validated['gcash_number']) : null;
        }
        if ($request->has('maya_number')) {
            $data['maya_number'] = $validated['maya_number'] ? trim($validated['maya_number']) : null;
        }

        // Handle QR removal requests
        if ($request->boolean('remove_gcash_qr') && $vendor->gcash_qr_path) {
            Storage::disk('public')->delete($vendor->gcash_qr_path);
            $data['gcash_qr_path'] = null;
        }
        if ($request->boolean('remove_maya_qr') && $vendor->maya_qr_path) {
            Storage::disk('public')->delete($vendor->maya_qr_path);
            $data['maya_qr_path'] = null;
        }

        // Handle QR uploads
        if ($request->hasFile('gcash_qr')) {
            if ($vendor->gcash_qr_path) {
                Storage::disk('public')->delete($vendor->gcash_qr_path);
            }
            $path = $request->file('gcash_qr')->store(
                'vendor_qr/'.$vendor->id,
                'public'
            );
            $data['gcash_qr_path'] = $path;
        }

        if ($request->hasFile('maya_qr')) {
            if ($vendor->maya_qr_path) {
                Storage::disk('public')->delete($vendor->maya_qr_path);
            }
            $path = $request->file('maya_qr')->store(
                'vendor_qr/'.$vendor->id,
                'public'
            );
            $data['maya_qr_path'] = $path;
        }

        if (!empty($data) || $request->has('gcash_number') || $request->has('maya_number')) {
            $vendor->update($data);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Payment settings updated',
            'data' => $this->formatVendorPayment($vendor->fresh()),
        ]);
    }

    /**
     * Public: Get vendor's payment details for checkout display.
     * GET /vendors/{vendor}/payment-details
     * Returns only numbers + QR URLs if vendor has configured them.
     */
    public function publicShow(int $vendorId): JsonResponse
    {
        $vendor = Vendor::find($vendorId);

        if (!$vendor) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vendor not found.',
            ], 404);
        }

        $hasGcash = !empty($vendor->gcash_number) || !empty($vendor->gcash_qr_path);
        $hasMaya = !empty($vendor->maya_number) || !empty($vendor->maya_qr_path);

        return response()->json([
            'status' => 'success',
            'message' => 'Vendor payment details retrieved',
            'data' => [
                'vendor_id' => $vendor->id,
                'stall_name' => $vendor->stall_name,
                'gcash' => $hasGcash ? [
                    'number' => $vendor->gcash_number,
                    'qr_url' => $vendor->gcash_qr_path ? Storage::disk('public')->url($vendor->gcash_qr_path) : null,
                    'has_qr' => !empty($vendor->gcash_qr_path),
                ] : null,
                'maya' => $hasMaya ? [
                    'number' => $vendor->maya_number,
                    'qr_url' => $vendor->maya_qr_path ? Storage::disk('public')->url($vendor->maya_qr_path) : null,
                    'has_qr' => !empty($vendor->maya_qr_path),
                ] : null,
                'has_ewallet' => $hasGcash || $hasMaya,
            ],
        ]);
    }

    /**
     * Batch: Get payment details for multiple vendors at once (for cart with multiple vendors).
     * POST /vendors/payment-details/batch  { vendor_ids: [1,2] }
     */
    public function batchShow(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vendor_ids' => ['required', 'array', 'min:1', 'max:20'],
            'vendor_ids.*' => ['integer', 'exists:vendors,id'],
        ]);

        $vendors = Vendor::whereIn('id', $validated['vendor_ids'])->get();

        $data = $vendors->map(function (Vendor $vendor) {
            $hasGcash = !empty($vendor->gcash_number) || !empty($vendor->gcash_qr_path);
            $hasMaya = !empty($vendor->maya_number) || !empty($vendor->maya_qr_path);

            return [
                'vendor_id' => $vendor->id,
                'stall_name' => $vendor->stall_name,
                'stall_location' => $vendor->stall_location,
                'gcash' => $hasGcash ? [
                    'number' => $vendor->gcash_number,
                    'qr_url' => $vendor->gcash_qr_path ? Storage::disk('public')->url($vendor->gcash_qr_path) : null,
                    'has_qr' => !empty($vendor->gcash_qr_path),
                ] : null,
                'maya' => $hasMaya ? [
                    'number' => $vendor->maya_number,
                    'qr_url' => $vendor->maya_qr_path ? Storage::disk('public')->url($vendor->maya_qr_path) : null,
                    'has_qr' => !empty($vendor->maya_qr_path),
                ] : null,
                'has_ewallet' => $hasGcash || $hasMaya,
            ];
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Batch payment details retrieved',
            'data' => $data,
        ]);
    }

    private function formatVendorPayment(Vendor $vendor): array
    {
        return [
            'vendor_id' => $vendor->id,
            'stall_name' => $vendor->stall_name,
            'gcash_number' => $vendor->gcash_number,
            'gcash_qr_path' => $vendor->gcash_qr_path,
            'gcash_qr_url' => $vendor->gcash_qr_path ? Storage::disk('public')->url($vendor->gcash_qr_path) : null,
            'maya_number' => $vendor->maya_number,
            'maya_qr_path' => $vendor->maya_qr_path,
            'maya_qr_url' => $vendor->maya_qr_path ? Storage::disk('public')->url($vendor->maya_qr_path) : null,
            'has_gcash' => !empty($vendor->gcash_number) || !empty($vendor->gcash_qr_path),
            'has_maya' => !empty($vendor->maya_number) || !empty($vendor->maya_qr_path),
        ];
    }
}
