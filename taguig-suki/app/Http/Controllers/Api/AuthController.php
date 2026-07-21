<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use App\Models\Vendor;
use App\Traits\ApiResponse;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponse;

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->validated());

        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->successResponse([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ], 'User registered successfully', 201);
    }

    /**
     * Vendor login — checks approval status before granting access.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        if (!Auth::attempt($request->validated())) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials. Please check your email and password.'],
            ]);
        }

        $user = User::where('email', $request->email)->firstOrFail();

        // Check if user is a vendor and verify approval status
        $vendor = Vendor::where('user_id', $user->id)->first();

        if ($vendor) {
            if ($vendor->isPending()) {
                return $this->errorResponse(
                    'Your account is pending approval. Please wait for the administrator to approve your account before logging in.',
                    403
                );
            }

            if ($vendor->status === 'rejected') {
                $reason = $vendor->rejection_reason
                    ? " Reason: {$vendor->rejection_reason}"
                    : '';
                return $this->errorResponse(
                    "Your vendor registration was rejected.{$reason} Please contact the market administrator.",
                    403
                );
            }

            if ($vendor->status === 'suspended') {
                return $this->errorResponse(
                    'Your vendor account has been suspended. Please contact the market administrator.',
                    403
                );
            }
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->successResponse([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
            'vendor' => $vendor?->load('documents'),
            'is_vendor' => $vendor !== null,
        ], 'Login successful');
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->successResponse(null, 'Successfully logged out');
    }

    /**
     * Get authenticated user profile with vendor data.
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = Vendor::where('user_id', $user->id)->with('documents')->first();

        return $this->successResponse([
            'user' => $user,
            'vendor' => $vendor,
            'is_vendor' => $vendor !== null,
        ], 'Profile retrieved');
    }
}
