<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Http\Request;
use App\Traits\ApiResponse;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponse;

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->validated());

        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->successResponse('User Registered Successfully', [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ], 201);
    }


    public function login(LoginRequest $request): JsonResponse
    {
        // Auth Attempt 
        if (! Auth::attempt($request->validated())) {
            throw ValidationException::withMessages([
                'email' => 'Invalid credentials',
            ]);
        }

        // optional, void try catch if needed # $user = User::where('email', $request->email)->firstOrFail();
        try {
            $user = User::where('email', $request->email)->firstOrFail();
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'message' => 'User not found',
            ], 404);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->successResponse('User Logged In Successfully', [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return $this->successResponse('Successfully logged out', null);
    }
}
