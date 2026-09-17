<?php

namespace App\Services;

use App\Enums\VendorStatus;
use App\Models\CustomerVerification;
use App\Models\User;
use App\Models\Vendor;
use App\Repositories\VendorRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function __construct(
        private readonly VendorRepositoryInterface $vendorRepository,
    ) {}

    public function register(array $data): array
    {
        // Handle optional ID verification upload during registration
        $idType = $data['id_type'] ?? null;
        $idImage = $data['id_image'] ?? null;

        // Remove ID fields so they don't hit User::create mass assignment
        unset($data['id_type'], $data['id_image']);

        $user = User::create($data);
        $token = $user->createToken('auth_token')->plainTextToken;

        $verification = null;
        // If ID provided at registration, store as pending
        if ($idType && $idImage instanceof UploadedFile) {
            try {
                $path = $idImage->store('customer_ids/' . $user->id, 'public');
                if ($path) {
                    $verification = CustomerVerification::create([
                        'user_id' => $user->id,
                        'id_type' => $idType,
                        'id_image_path' => $path,
                        'status' => CustomerVerification::STATUS_PENDING,
                        'submitted_at' => now(),
                    ]);
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('[AuthService] ID upload at registration failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
                // Don't fail registration if ID storage fails — user can re-upload in profile
            }
        } else {
            // Ensure an unverified record exists for consistency
            CustomerVerification::firstOrCreate(['user_id' => $user->id], ['status' => CustomerVerification::STATUS_UNVERIFIED]);
        }

        return [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
            'verification' => $verification,
        ];
    }

    public function logout(User $user): null
    {
        $user->currentAccessToken()->delete();

        return null;
    }

    /**
     * @throws ValidationException
     */
    public function login(array $credentials): array
    {
        if (!Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials. Please check your email and password.'],
            ]);
        }

        $user = User::where('email', $credentials['email'])->firstOrFail();
        $vendor = $this->vendorRepository->findByUser($user);

        $this->validateVendorAccess($vendor);

        $token = $user->createToken('auth_token')->plainTextToken;

        return [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
            'vendor' => $vendor?->load('documents'),
            'is_vendor' => $vendor !== null,
        ];
    }

    public function getProfile(User $user): array
    {
        $vendor = $this->vendorRepository->findByUserWithDocuments($user);

        return [
            'user' => $user,
            'vendor' => $vendor,
            'is_vendor' => $vendor !== null,
        ];
    }

    /**
     * @throws ValidationException
     */
    private function validateVendorAccess(?Vendor $vendor): void
    {
        if (!$vendor) {
            return;
        }

        $messages = match ($vendor->status) {
            VendorStatus::Pending->value => 'Your account is pending approval. Please wait for the administrator to approve your account before logging in.',
            VendorStatus::Rejected->value => $this->buildRejectionMessage($vendor),
            VendorStatus::Suspended->value => 'Your vendor account has been suspended. Please contact the market administrator.',
            default => null,
        };

        if ($messages) {
            throw ValidationException::withMessages(['vendor' => [$messages]]);
        }
    }

    private function buildRejectionMessage(Vendor $vendor): string
    {
        $reason = $vendor->rejection_reason ? " Reason: {$vendor->rejection_reason}" : '';

        return "Your vendor registration was rejected.{$reason} Please contact the market administrator.";
    }
}
