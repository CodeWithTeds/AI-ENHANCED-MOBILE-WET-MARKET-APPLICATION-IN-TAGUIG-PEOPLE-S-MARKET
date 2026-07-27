<?php

namespace App\Services;

use App\Models\User;
use App\Models\Vendor;
use App\Repositories\VendorRepositoryInterface;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class VendorProfileService
{
    public function __construct(
        private readonly VendorRepositoryInterface $vendorRepository,
    ) {}

    /**
     * Get full vendor business profile.
     */
    public function getBusinessProfile(User $user): array
    {
        $vendor = $this->vendorRepository->findByUserWithDocuments($user);

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'vendor' => $vendor,
            'stats' => $this->getVendorStats($vendor),
        ];
    }

    /**
     * Update vendor business information.
     */
    public function updateBusinessInfo(User $user, array $data): array
    {
        $vendor = $this->vendorRepository->findByUser($user);

        if (!$vendor) {
            throw ValidationException::withMessages([
                'vendor' => ['No vendor account found.'],
            ]);
        }

        $vendor->update(array_filter([
            'stall_name' => $data['stall_name'] ?? null,
            'product_categories' => $data['product_categories'] ?? null,
        ]));

        if (isset($data['name'])) {
            $user->update(['name' => $data['name']]);
        }

        return [
            'user' => $user->fresh(),
            'vendor' => $vendor->fresh(),
        ];
    }

    /**
     * Change user password.
     *
     * @throws ValidationException
     */
    public function changePassword(User $user, array $data): null
    {
        if (!Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($data['new_password']),
        ]);

        return null;
    }

    /**
     * Update notification preferences.
     */
    public function updateNotificationPreferences(User $user, array $preferences): array
    {
        // Store preferences in user's settings (or a separate table)
        // For now, we store in a JSON column or cache
        $vendor = $this->vendorRepository->findByUser($user);

        if ($vendor) {
            $vendor->update([
                'notification_preferences' => $preferences,
            ]);
        }

        return $preferences;
    }

    /**
     * Get vendor stats summary.
     */
    private function getVendorStats(?Vendor $vendor): array
    {
        if (!$vendor) {
            return [
                'total_products' => 0,
                'total_orders' => 0,
                'member_since' => null,
            ];
        }

        return [
            'total_products' => $vendor->products()->count(),
            'total_orders' => 0, // Will be populated when orders table exists
            'member_since' => $vendor->created_at?->toDateString(),
        ];
    }
}
