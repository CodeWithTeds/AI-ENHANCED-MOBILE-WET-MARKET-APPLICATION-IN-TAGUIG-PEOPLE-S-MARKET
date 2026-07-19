<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

            // Business info
            'stall_name' => ['required', 'string', 'max:255'],
            'stall_location' => ['required', 'string', 'max:255'],
            'product_categories' => ['required', 'array', 'min:1'],
            'product_categories.*' => ['string'],

            // Documents
            'business_permit' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'stall_lease' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'valid_id' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        $result = DB::transaction(function () use ($request) {
            // Create user account
            $user = User::create([
                'name' => $request->full_name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'is_admin' => false,
            ]);

            // Create vendor profile
            $vendor = Vendor::create([
                'user_id' => $user->id,
                'stall_name' => $request->stall_name,
                'stall_location' => $request->stall_location,
                'product_categories' => $request->product_categories,
                'status' => 'pending',
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

        return $this->successResponse('Vendor registered successfully. Awaiting admin approval.', [
            'access_token' => $result['token'],
            'token_type' => 'Bearer',
            'user' => $result['user'],
            'vendor' => $result['vendor'],
        ], 201);
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

        return $this->successResponse('Vendor status retrieved', [
            'vendor' => $vendor,
        ]);
    }
}
