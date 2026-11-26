<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AdminNotificationController extends Controller
{
    public function __construct(private readonly AdminNotificationService $notificationService) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return response()->json($this->notificationService->getForAdmin($request->user()));
    }

    public function markRead(Request $request, string $notification): JsonResponse|RedirectResponse
    {
        $this->ensureAdmin($request);

        $payload = $this->notificationService->markAsRead($request->user(), $notification);

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json($payload)
            : back();
    }

    public function markAllRead(Request $request): JsonResponse|RedirectResponse
    {
        $this->ensureAdmin($request);

        $payload = $this->notificationService->markAllAsRead($request->user());

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json($payload)
            : back();
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user()?->is_admin === true, 403, 'Administrator access required.');
    }
}
