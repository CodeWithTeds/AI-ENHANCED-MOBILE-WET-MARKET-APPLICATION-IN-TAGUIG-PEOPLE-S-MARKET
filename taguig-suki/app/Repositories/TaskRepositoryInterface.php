<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

interface TaskRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * get paginated task for specific user only 
     */
    public function getForUserPaginated(User $user, int $perPage = 10): LengthAwarePaginator;

    /**
     * create task for specific user only
     */
    public function createForUser(User $user, array $attributes);
}
