<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Http\Requests\Api\StoreTaskRequest;
use App\Http\Requests\Api\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Repositories\TaskRepositoryInterface;
use Illuminate\Http\Request;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    use ApiResponse;

    public function __construct(protected TaskRepositoryInterface $taskRepository) {}
    /**
 
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $tasks = $this->taskRepository->getForUserPaginated($request->user(), 10);
        return $this->successResponse(TaskResource::collection($tasks), 'Task retrieved successfully');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTaskRequest $request)
    {
        $task = $this->taskRepository->createForUser($request->user(), $request->validated());
        return $this->successResponse(new TaskResource($task), 'Task created successfully', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $task = $this->taskRepository->find($id);
        Gate::authorize('view', $task);
        return $this->successResponse(new TaskResource($task), 'Task retrieved successfully');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateTaskRequest $request, string $id): JsonResponse
    {
        $task = $this->taskRepository->find($id);
        Gate::authorize('update', $task);

        $this->taskRepository->update($task, $request->validated());

        return $this->successResponse(new TaskResource($task), 'Task updated successfully');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Task $task): JsonResponse
    {
        Gate::authorize('delete', $task);
        $this->taskRepository->delete($task);
        return $this->successResponse(null, 'Task deleted successfully');
    }
}
