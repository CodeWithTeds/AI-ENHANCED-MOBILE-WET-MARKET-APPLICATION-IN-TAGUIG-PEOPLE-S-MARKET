<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CustomerProfileService
{
    /**
     * Get customer profile.
     */
    public function getProfile(User $user): array
    {
        return [
            'user' => $user,
            'notification_preferences' => $user->notification_preferences ?? [],
        ];
    }

    /**
     * Update customer account preferences.
     */
    public function updateProfile(User $user, array $data): array
    {
        $user->update(array_filter([
            'name' => $data['name'] ?? null,
            'email' => $data['email'] ?? null,
        ], fn ($value) => $value !== null));

        return [
            'user' => $user->fresh(),
        ];
    }

    /**
     * Change customer password.
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
     * Update customer notification preferences.
     */
    public function updateNotificationPreferences(User $user, array $preferences): array
    {
        $user->update([
            'notification_preferences' => $preferences,
        ]);

        return $preferences;
    }
}
