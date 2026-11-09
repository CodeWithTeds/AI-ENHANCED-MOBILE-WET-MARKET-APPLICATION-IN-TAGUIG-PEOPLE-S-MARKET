<?php

namespace App\Services\Admin;

use App\Models\CustomerVerification;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;

class UserManagementService
{
    /**
     * Get paginated customer/user data for admin dashboard.
     * Manages customer accounts, including viewing, updating, activating, or deactivating users.
     */
    public function getIndexData(array $filters): array
    {
        $query = User::query()->withCount(['vendor'])->with(['verification', 'vendor.documents']);

        $this->applyFilters($query, $filters);

        $sortField = $filters['sort'] ?? 'created_at';
        $sortDir = $filters['direction'] ?? 'desc';
        $allowedSorts = ['name', 'email', 'created_at', 'is_active'];
        if (! in_array($sortField, $allowedSorts, true)) {
            $sortField = 'created_at';
        }
        $sortDir = $sortDir === 'asc' ? 'asc' : 'desc';

        $users = $query->orderBy($sortField, $sortDir)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user) => $this->present($user));

        return [
            'users' => $users,
            'stats' => $this->getStats(),
            'filters' => $filters,
            'roles' => [
                ['value' => 'customer', 'label' => 'Customer'],
                ['value' => 'vendor', 'label' => 'Vendor'],
                ['value' => 'admin', 'label' => 'Admin'],
            ],
            'statuses' => [
                ['value' => 'active', 'label' => 'Active'],
                ['value' => 'inactive', 'label' => 'Inactive'],
            ],
            'verificationStatuses' => [
                ['value' => 'pending', 'label' => 'Pending'],
                ['value' => 'verified', 'label' => 'Verified'],
                ['value' => 'rejected', 'label' => 'Rejected'],
                ['value' => 'unverified', 'label' => 'Unverified'],
            ],
            'verificationStats' => $this->getVerificationStats(),
        ];
    }

    public function update(User $user, array $data): User
    {
        $user->update($data);

        return $user->fresh();
    }

    public function toggleStatus(User $user): User
    {
        $user->update([
            'is_active' => ! $user->is_active,
        ]);

        $fresh = $user->fresh();

        // Revoke sessions when deactivating so existing tokens stop working.
        if (! $fresh->isActive()) {
            $fresh->tokens()->delete();
        }

        return $fresh;
    }

    public function activate(User $user): User
    {
        $user->update(['is_active' => true]);

        return $user->fresh();
    }

    public function deactivate(User $user): User
    {
        $user->update(['is_active' => false]);

        $fresh = $user->fresh();

        // Revoke all API tokens so the user is signed out everywhere immediately.
        $fresh->tokens()->delete();

        return $fresh;
    }

    public function delete(User $user): void
    {
        $user->delete();
    }

    private function formatImageUrl(?string $raw): ?string
    {
        if (! $raw) {
            return null;
        }

        if (str_starts_with($raw, 'http://') || str_starts_with($raw, 'https://')) {
            return $raw;
        }

        $clean = ltrim(preg_replace('/^\/?(storage\/)?/', '', $raw), '/');

        return '/storage/'.$clean;
    }

    private function present(User $user): array
    {
        $verification = $user->verification;
        $vendor = $user->vendor;

        $verifData = null;

        if ($user->is_admin) {
            $verifData = [
                'id' => null,
                'id_type' => 'Admin Account',
                'id_image_path' => null,
                'id_image_url' => null,
                'status' => CustomerVerification::STATUS_VERIFIED,
                'rejection_reason' => null,
                'submitted_at' => $user->created_at,
                'verified_at' => $user->email_verified_at ?? $user->created_at,
            ];
        } elseif ($vendor) {
            // Find valid ID document if uploaded by vendor
            $validIdDoc = $vendor->documents?->firstWhere('document_type', 'valid_id');
            $idImagePath = $validIdDoc?->file_path ?? $verification?->id_image_path;
            $idImageUrl = $this->formatImageUrl($idImagePath);

            // Map vendor status to verification status
            $status = match ($vendor->status) {
                'approved' => CustomerVerification::STATUS_VERIFIED,
                'pending' => CustomerVerification::STATUS_PENDING,
                'rejected' => CustomerVerification::STATUS_REJECTED,
                default => CustomerVerification::STATUS_UNVERIFIED,
            };

            // If the vendor user also has an explicit CustomerVerification record that is verified
            if ($verification && $verification->status === CustomerVerification::STATUS_VERIFIED) {
                $status = CustomerVerification::STATUS_VERIFIED;
                $idType = $verification->id_type ?? ($validIdDoc ? 'Vendor ID' : 'Vendor Registration');
            } else {
                $idType = $validIdDoc ? 'Vendor ID' : 'Vendor Registration';
            }

            $verifData = [
                'id' => $verification?->id,
                'id_type' => $idType,
                'id_image_path' => $idImagePath,
                'id_image_url' => $idImageUrl,
                'status' => $status,
                'rejection_reason' => $vendor->rejection_reason ?? $verification?->rejection_reason,
                'submitted_at' => $vendor->created_at ?? $verification?->submitted_at,
                'verified_at' => $vendor->approved_at ?? $verification?->verified_at,
            ];
        } elseif ($verification) {
            $verifData = [
                'id' => $verification->id,
                'id_type' => $verification->id_type,
                'id_image_path' => $verification->id_image_path,
                'id_image_url' => $this->formatImageUrl($verification->id_image_path),
                'status' => $verification->status,
                'rejection_reason' => $verification->rejection_reason,
                'submitted_at' => $verification->submitted_at,
                'verified_at' => $verification->verified_at,
            ];
        } else {
            $verifData = [
                'id' => null,
                'id_type' => null,
                'id_image_path' => null,
                'id_image_url' => null,
                'status' => CustomerVerification::STATUS_UNVERIFIED,
                'rejection_reason' => null,
                'submitted_at' => null,
                'verified_at' => null,
            ];
        }

        $role = 'customer';
        if ($user->is_admin) {
            $role = 'admin';
        } elseif ($user->vendor) {
            $role = 'vendor';
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_admin' => (bool) $user->is_admin,
            'role' => $role,
            'is_active' => (bool) ($user->is_active ?? true),
            'email_verified_at' => $user->email_verified_at,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
            'vendor' => $user->vendor ? [
                'id' => $user->vendor->id,
                'stall_name' => $user->vendor->stall_name,
                'status' => $user->vendor->status,
            ] : null,
            'verification' => $verifData,
        ];
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function (Builder $q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%");
            });
        }

        if (! empty($filters['status'])) {
            if ($filters['status'] === 'active') {
                $query->where('is_active', true);
            } elseif ($filters['status'] === 'inactive') {
                $query->where('is_active', false);
            }
        }

        if (! empty($filters['role'])) {
            if ($filters['role'] === 'admin') {
                $query->where('is_admin', true);
            } elseif ($filters['role'] === 'vendor') {
                $query->where('is_admin', false)->whereHas('vendor');
            } elseif ($filters['role'] === 'customer') {
                $query->where('is_admin', false)->whereDoesntHave('vendor');
            }
        }

        if (! empty($filters['verification_status'])) {
            $vs = $filters['verification_status'];
            if ($vs === 'verified') {
                $query->where(function (Builder $q) {
                    $q->where('is_admin', true)
                        ->orWhereHas('vendor', fn (Builder $vq) => $vq->where('status', 'approved'))
                        ->orWhereHas('verification', fn (Builder $vq) => $vq->where('status', 'verified'));
                });
            } elseif ($vs === 'pending') {
                $query->where('is_admin', false)
                    ->where(function (Builder $q) {
                        $q->whereHas('vendor', fn (Builder $vq) => $vq->where('status', 'pending'))
                            ->orWhere(function (Builder $sub) {
                                $sub->whereDoesntHave('vendor')
                                    ->whereHas('verification', fn (Builder $vq) => $vq->where('status', 'pending'));
                            });
                    });
            } elseif ($vs === 'rejected') {
                $query->where('is_admin', false)
                    ->where(function (Builder $q) {
                        $q->whereHas('vendor', fn (Builder $vq) => $vq->where('status', 'rejected'))
                            ->orWhere(function (Builder $sub) {
                                $sub->whereDoesntHave('vendor')
                                    ->whereHas('verification', fn (Builder $vq) => $vq->where('status', 'rejected'));
                            });
                    });
            } elseif ($vs === 'unverified') {
                $query->where('is_admin', false)
                    ->where(function (Builder $q) {
                        $q->whereHas('vendor', fn (Builder $vq) => $vq->whereNotIn('status', ['approved', 'pending', 'rejected']))
                            ->orWhere(function (Builder $sub) {
                                $sub->whereDoesntHave('vendor')
                                    ->where(function (Builder $iq) {
                                        $iq->whereDoesntHave('verification')
                                            ->orWhereHas('verification', fn (Builder $vq) => $vq->where('status', 'unverified'));
                                    });
                            });
                    });
            }
        }
    }

    private function getStats(): array
    {
        return [
            'total' => User::count(),
            'active' => User::where('is_active', true)->orWhereNull('is_active')->count(),
            'inactive' => User::where('is_active', false)->count(),
            'admins' => User::where('is_admin', true)->count(),
            'vendors' => User::where('is_admin', false)->whereHas('vendor')->count(),
            'customers' => User::where('is_admin', false)->whereDoesntHave('vendor')->count(),
        ];
    }

    private function getVerificationStats(): array
    {
        $verifiedCount = User::where(function (Builder $q) {
            $q->where('is_admin', true)
                ->orWhereHas('vendor', fn (Builder $vq) => $vq->where('status', 'approved'))
                ->orWhereHas('verification', fn (Builder $vq) => $vq->where('status', 'verified'));
        })->count();

        $pendingCount = User::where('is_admin', false)
            ->where(function (Builder $q) {
                $q->whereHas('vendor', fn (Builder $vq) => $vq->where('status', 'pending'))
                    ->orWhere(function (Builder $sub) {
                        $sub->whereDoesntHave('vendor')
                            ->whereHas('verification', fn (Builder $vq) => $vq->where('status', 'pending'));
                    });
            })->count();

        $rejectedCount = User::where('is_admin', false)
            ->where(function (Builder $q) {
                $q->whereHas('vendor', fn (Builder $vq) => $vq->where('status', 'rejected'))
                    ->orWhere(function (Builder $sub) {
                        $sub->whereDoesntHave('vendor')
                            ->whereHas('verification', fn (Builder $vq) => $vq->where('status', 'rejected'));
                    });
            })->count();

        $unverifiedCount = User::where('is_admin', false)
            ->where(function (Builder $q) {
                $q->whereHas('vendor', fn (Builder $vq) => $vq->whereNotIn('status', ['approved', 'pending', 'rejected']))
                    ->orWhere(function (Builder $sub) {
                        $sub->whereDoesntHave('vendor')
                            ->where(function (Builder $iq) {
                                $iq->whereDoesntHave('verification')
                                    ->orWhereHas('verification', fn (Builder $vq) => $vq->where('status', 'unverified'));
                            });
                    });
            })->count();

        return [
            'pending' => $pendingCount,
            'verified' => $verifiedCount,
            'rejected' => $rejectedCount,
            'unverified' => $unverifiedCount,
        ];
    }

    public static function validationRules(User $user): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'is_admin' => ['required', 'boolean'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
