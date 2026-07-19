<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

abstract class BasePolicy
{
    use  HandlesAuthorization;

    // ?bool for now ->
    public function before(User $user, string $ability): ?bool
    {
        /**
         * bypass all authorization check if the user is an admin or super admin
         */

        // if ($user->hasRole("admin")) {
        //     return true;
        // }

        return null;
    }

    public function isOwner(User $user, mixed $model, string $foreignKey = 'user_id'): bool
    {
        return isset($model->{$foreignKey}) && $model->{$foreignKey} === $user->id;
    }

    public function authorieOwnerShip(User $user, mixed $model, string $foreignKey = 'user_id', string $message = null)
    {
        return $this->isOwner(User::find($user->id), $model, $foreignKey)
            ? $this->allow()
            : $this->deny($message ?? 'You are not authorized to perform this action');
    }
}
