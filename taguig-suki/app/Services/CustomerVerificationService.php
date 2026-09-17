<?php

namespace App\Services;

use App\Models\CustomerVerification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CustomerVerificationService
{
    public const ALLOWED_ID_TYPES = [
        'national_id',
        'drivers_license',
        'passport',
        'umid',
        'philhealth',
        'sss',
        'voters_id',
        'postal_id',
        'student_id',
        'other',
    ];

    /**
     * Get or initialize verification record for user.
     */
    public function getVerification(User $user): array
    {
        $verification = CustomerVerification::firstOrCreate(
            ['user_id' => $user->id],
            ['status' => CustomerVerification::STATUS_UNVERIFIED]
        );

        return $this->format($verification);
    }

    /**
     * Upload / update ID verification image.
     */
    public function upload(Request $request, User $user): array
    {
        $validated = $request->validate([
            'id_type' => ['required', 'string', 'in:' . implode(',', self::ALLOWED_ID_TYPES)],
            'id_image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:5120'],
        ]);

        $verification = CustomerVerification::firstOrCreate(
            ['user_id' => $user->id],
            ['status' => CustomerVerification::STATUS_UNVERIFIED]
        );

        // Delete old image if exists
        if ($verification->id_image_path) {
            Storage::disk('public')->delete($verification->id_image_path);
        }

        $path = $request->file('id_image')->store('customer_ids/' . $user->id, 'public');

        if (!$path) {
            throw new \RuntimeException('Failed to store ID image. Check storage permissions.');
        }

        $verification->update([
            'id_type' => $validated['id_type'],
            'id_image_path' => $path,
            'status' => CustomerVerification::STATUS_PENDING,
            'rejection_reason' => null,
            'verified_by' => null,
            'verified_at' => null,
            'submitted_at' => now(),
        ]);

        return $this->format($verification->fresh());
    }

    /**
     * Remove ID verification (reset to unverified).
     */
    public function remove(User $user): array
    {
        $verification = CustomerVerification::where('user_id', $user->id)->first();

        if (!$verification || !$verification->id_image_path) {
            throw new \RuntimeException('No ID verification to remove.');
        }

        if ($verification->id_image_path) {
            Storage::disk('public')->delete($verification->id_image_path);
        }

        $verification->update([
            'id_image_path' => null,
            'id_type' => null,
            'status' => CustomerVerification::STATUS_UNVERIFIED,
            'rejection_reason' => null,
            'verified_by' => null,
            'verified_at' => null,
            'submitted_at' => null,
        ]);

        return $this->format($verification->fresh());
    }

    /**
     * Format verification for API response, using request host for URL.
     */
    public function format(CustomerVerification $verification, ?Request $request = null): array
    {
        $imageUrl = null;
        if ($verification->id_image_path) {
            if ($request) {
                try {
                    $host = $request->getSchemeAndHttpHost();
                    $imageUrl = rtrim($host, '/') . '/storage/' . ltrim($verification->id_image_path, '/');
                } catch (\Throwable) {
                    $imageUrl = Storage::disk('public')->url($verification->id_image_path);
                }
            } else {
                $imageUrl = Storage::disk('public')->url($verification->id_image_path);
            }
        }

        return [
            'id' => $verification->id,
            'user_id' => $verification->user_id,
            'id_type' => $verification->id_type,
            'id_image_path' => $verification->id_image_path,
            'id_image_url' => $imageUrl,
            'status' => $verification->status,
            'rejection_reason' => $verification->rejection_reason,
            'verified_at' => $verification->verified_at?->toIso8601String(),
            'submitted_at' => $verification->submitted_at?->toIso8601String(),
            'created_at' => $verification->created_at?->toIso8601String(),
            'updated_at' => $verification->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Admin: list verifications with optional status filter.
     */
    public function listForAdmin(?string $status = null, ?Request $request = null): array
    {
        $query = CustomerVerification::with('user')->orderByDesc('submitted_at')->orderByDesc('updated_at');

        if ($status && in_array($status, ['pending', 'verified', 'rejected', 'unverified'])) {
            $query->where('status', $status);
        }

        return $query->get()->map(fn (CustomerVerification $v) => array_merge($this->format($v, $request), [
            'user' => $v->user ? ['id' => $v->user->id, 'name' => $v->user->name, 'email' => $v->user->email] : null,
        ]))->toArray();
    }

    public function approve(CustomerVerification $verification, User $admin): array
    {
        $verification->update([
            'status' => CustomerVerification::STATUS_VERIFIED,
            'rejection_reason' => null,
            'verified_by' => $admin->id,
            'verified_at' => now(),
        ]);

        return $this->format($verification->fresh());
    }

    public function reject(CustomerVerification $verification, User $admin, ?string $reason = null): array
    {
        $verification->update([
            'status' => CustomerVerification::STATUS_REJECTED,
            'rejection_reason' => $reason ?? 'ID rejected. Please upload a clearer image.',
            'verified_by' => $admin->id,
            'verified_at' => now(),
        ]);

        return $this->format($verification->fresh());
    }

    public static function idTypeOptions(): array
    {
        return self::ALLOWED_ID_TYPES;
    }
}
