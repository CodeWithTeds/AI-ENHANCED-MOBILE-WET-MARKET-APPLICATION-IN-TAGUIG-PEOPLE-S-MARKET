<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreTaskRequest;
use App\Http\Requests\Api\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Repositories\TaskRepositoryInterface;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly TaskRepositoryInterface $taskRepository) {}

    public function index(Request $request): JsonResponse
    {
        return $this->successResponse(TaskResource::collection($this->taskRepository->getForUserPaginated($request->user(), 10)), 'Task retrieved successfully');
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        return $this->successResponse(new TaskResource($this->taskRepository->createForUser($request->user(), $request->validated())), 'Task created successfully', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return $this->successResponse(new TaskResource(tap($this->taskRepository->find($id), fn ($task) => Gate::authorize('view', $task))), 'Task retrieved successfully');
    }

    public function update(UpdateTaskRequest $request, string $id): JsonResponse
    {
        return $this->successResponse(new TaskResource(tap($this->taskRepository->find($id), fn ($task) => Gate::authorize('update', $task) || $this->taskRepository->update($task, $request->validated()))), 'Task updated successfully');
    }

    public function destroy(Task $task): JsonResponse
    {
        return $this->successResponse(tap(null, fn () => Gate::authorize('delete', $task) || $this->taskRepository->delete($task)), 'Task deleted successfully');
    }
}
