<?php

namespace App\Services\Admin;

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
        $query = User::query()->withCount(['vendor']);

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
                ['value' => 'admin', 'label' => 'Admin'],
            ],
            'statuses' => [
                ['value' => 'active', 'label' => 'Active'],
                ['value' => 'inactive', 'label' => 'Inactive'],
            ],
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

        return $user->fresh();
    }

    public function activate(User $user): User
    {
        $user->update(['is_active' => true]);

        return $user->fresh();
    }

    public function deactivate(User $user): User
    {
        $user->update(['is_active' => false]);

        return $user->fresh();
    }

    public function delete(User $user): void
    {
        $user->delete();
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_admin' => (bool) $user->is_admin,
            'role' => $user->is_admin ? 'admin' : 'customer',
            'is_active' => (bool) ($user->is_active ?? true),
            'email_verified_at' => $user->email_verified_at,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
            'vendor' => $user->vendor ? [
                'id' => $user->vendor->id,
                'stall_name' => $user->vendor->stall_name,
                'status' => $user->vendor->status,
            ] : null,
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
            } elseif ($filters['role'] === 'customer') {
                $query->where('is_admin', false);
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
            'customers' => User::where('is_admin', false)->count(),
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
