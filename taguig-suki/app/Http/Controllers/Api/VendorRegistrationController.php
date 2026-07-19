<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stall;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorDocument;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class VendorRegistrationController extends Controller
{
    use ApiResponse;

    /**
     * Register a new vendor with documents.
     */
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            // Personal info
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:20'],
            'password' => ['required', Password::min(8)],

            // Business info — stall_id references a vacant stall from the DB
            'stall_name' => ['required', 'string', 'max:255'],
            'stall_id' => ['required', 'exists:stalls,id'],
            'product_categories' => ['required', 'array', 'min:1'],
            'product_categories.*' => ['string'],

            // Documents
            'business_permit' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'stall_lease' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'valid_id' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        // Ensure the selected stall is actually vacant
        $stall = Stall::findOrFail($request->stall_id);
        if ($stall->status->value !== 'vacant') {
            return $this->errorResponse('Selected stall is no longer available', 422);
        }

        $result = DB::transaction(function () use ($request, $stall) {
            // Create user account
            $user = User::create([
                'name' => $request->full_name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'is_admin' => false,
            ]);

            // Build stall location string from actual stall data
            $stallLocation = "Stall {$stall->stall_number}, {$stall->section}";

            // Create vendor profile
            $vendor = Vendor::create([
                'user_id' => $user->id,
                'stall_name' => $request->stall_name,
                'stall_location' => $stallLocation,
                'product_categories' => $request->product_categories,
                'status' => 'pending',
            ]);

            // Reserve the stall for this vendor (mark as occupied)
            $stall->update([
                'vendor_id' => $user->id,
                'store_name' => $request->stall_name,
                'status' => 'occupied',
            ]);

            // Upload documents
            $documents = [
                'business_permit' => $request->file('business_permit'),
                'stall_lease' => $request->file('stall_lease'),
                'valid_id' => $request->file('valid_id'),
            ];

            foreach ($documents as $type => $file) {
                $path = $file->store("vendors/{$vendor->id}", 'public');

                VendorDocument::create([
                    'vendor_id' => $vendor->id,
                    'document_type' => $type,
                    'file_path' => $path,
                    'original_name' => $file->getClientOriginalName(),
                ]);
            }

            // Generate token
            $token = $user->createToken('mobile_token')->plainTextToken;

            return [
                'user' => $user,
                'vendor' => $vendor->load('documents'),
                'token' => $token,
            ];
        });

        return $this->successResponse($result, 'Vendor registered successfully. Awaiting admin approval.', 201);
    }

    /**
     * Get vendor status for the authenticated user.
     */
    public function status(Request $request): JsonResponse
    {
        $vendor = Vendor::where('user_id', $request->user()->id)
            ->with('documents')
            ->first();

        if (!$vendor) {
            return $this->errorResponse('No vendor profile found', 404);
        }

        return $this->successResponse($vendor, 'Vendor status retrieved');
    }
}
