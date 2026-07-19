<?php

namespace App\Repositories;

use App\Jobs\ProcessTaskActivity;
use App\Models\User;
use App\Models\Task;
use App\Notifications\TaskActivityNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Spatie\QueryBuilder\QueryBuilder;

class TaskRepository extends BaseRepository implements TaskRepositoryInterface
{

    public function __construct(Task $model)
    {
        parent::__construct($model);
    }

    public function find(mixed $id): Model
    {
        return Cache::remember("task_{$id}", 3600, function () use ($id) {
            return parent::find($id);
        });
    }

    public function getForUserPaginated(User $user, int $perPage = 10): LengthAwarePaginator
    {
        $page = request()->get('page', 1);
        $queryString = request()->getQueryString();
        $cacheKey = "user:{$user->id}:items:page:{$page}:perPage:{$perPage}:{$queryString}";

        return Cache::remember($cacheKey, 3600, function () use ($user, $perPage) {
            return QueryBuilder::for($user->tasks())
                ->allowedFilters('status', 'title')
                ->allowedSorts('created_at', 'updated_at')
                ->allowedIncludes('user')
                ->paginate($perPage);
        });
    }

    public function createForUser(User $user, array $attributes)
    {
        $task = $user->tasks()->create($attributes);
        $this->clearUserCache($user);

        ProcessTaskActivity::dispatch($task, 'created');
        $user->notify(new TaskActivityNotification($task, 'created'));
    }

    public function delete(Model $model): bool
    {
        $deleted = parent::delete($model);
        Cache::forget("task_{$model->id}");
        $this->clearUserCache($model->user);

        return $deleted;
    }

    public function update(Model $model, array $attributes): bool
    {
        $updated = parent::update($model, $attributes);
        Cache::forget("task_{$model->id}");
        $this->clearUserCache($model->user);

        ProcessTaskActivity::dispatch($model, 'updated');
        $model->user->notify(new TaskActivityNotification($model, 'updated'));
        return $updated;
    }

    public function clearUserCache(User $user)
    {
        /**
         * CACHE_DRIVER=redis
         * use tags instead in production 
         */
        for ($i = 1; $i < 10; $i++) {
            Cache::forget("user:{$user->id}:items:page:{$i}:perPage:10");
        }
    }
}
