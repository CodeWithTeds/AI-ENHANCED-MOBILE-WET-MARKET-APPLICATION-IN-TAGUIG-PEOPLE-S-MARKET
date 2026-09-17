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
            $verification = CustomerVerification::firstOrCreate(['user_id' => $user->id], ['status' => CustomerVerification::STATUS_UNVERIFIED]);
        }

        // Admin users don't need verification — auto-approve if is_admin
        if ($user->is_admin) {
            $token = $user->createToken('auth_token')->plainTextToken;
            return [
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => $user,
                'verification' => $verification,
            ];
        }

        // For customers: require admin approval — do NOT issue token until verified.
        // Return verification status so frontend can show pending message.
        // Token will be issued on successful login after approval.
        $freshVerification = CustomerVerification::where('user_id', $user->id)->first();
        $status = $freshVerification?->status ?? CustomerVerification::STATUS_UNVERIFIED;

        if ($status === CustomerVerification::STATUS_VERIFIED) {
            $token = $user->createToken('auth_token')->plainTextToken;
            return [
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => $user,
                'verification' => $freshVerification,
            ];
        }

        // Pending / unverified / rejected — no token, must wait for admin
        return [
            'access_token' => null,
            'token_type' => 'Bearer',
            'user' => $user,
            'verification' => $freshVerification,
            'requires_approval' => true,
            'message' => 'Registration successful. Your ID is pending admin approval. You will be able to login once verified.',
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
        $this->validateCustomerVerification($user);

        $token = $user->createToken('auth_token')->plainTextToken;

        return [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
            'vendor' => $vendor?->load('documents'),
            'is_vendor' => $vendor !== null,
        ];
    }

    /**
     * Customers must be ID-verified before they can log in.
     * Admins and verified customers bypass. Vendors use separate vendor status check.
     *
     * @throws ValidationException
     */
    private function validateCustomerVerification(User $user): void
    {
        // Admins bypass verification
        if ($user->is_admin) {
            return;
        }

        // Vendors already have their own approval flow (validateVendorAccess handles it)
        // If user is a vendor, we don't additionally require customer ID verification
        // Comment out next check if you want vendors also to need ID verification.
        $vendor = $this->vendorRepository->findByUser($user);
        if ($vendor) {
            return;
        }

        $verification = CustomerVerification::where('user_id', $user->id)->first();

        $status = $verification?->status ?? CustomerVerification::STATUS_UNVERIFIED;

        if ($status === CustomerVerification::STATUS_VERIFIED) {
            return;
        }

        $message = match ($status) {
            CustomerVerification::STATUS_PENDING => 'Your account is pending admin approval. Your ID is under review — please wait 1-2 days and try logging in again.',
            CustomerVerification::STATUS_REJECTED => 'Your ID verification was rejected' . ($verification?->rejection_reason ? ': ' . $verification->rejection_reason : '.') . ' Please contact support or re-upload a clearer ID in your profile (if you can access it) or register with correct details.',
            default => 'Your account is not yet verified. Please upload a valid ID and wait for admin approval before logging in. (Register with ID or contact admin)',
        };

        throw ValidationException::withMessages([
            'email' => [$message],
        ]);
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
