<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    use ApiResponse;

    /**
     * Get the authenticated user's in-app notifications.
     *
     * GET /notifications
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 30), 1), 50);

        $notifications = $request->user()
            ->notifications()
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return $this->successResponse([
            'notifications' => collect($notifications->items())
                ->map(fn (DatabaseNotification $notification) => $this->formatNotification($notification))
                ->values()
                ->all(),
            'unread_count' => $request->user()->unreadNotifications()->count(),
            'current_page' => $notifications->currentPage(),
            'last_page' => $notifications->lastPage(),
            'per_page' => $notifications->perPage(),
            'total' => $notifications->total(),
        ], 'Notifications retrieved');
    }

    /**
     * Get the unread notification count for the bell badge.
     *
     * GET /notifications/unread-count
     */
    public function unreadCount(Request $request): JsonResponse
    {
        return $this->successResponse([
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ], 'Unread notification count retrieved');
    }

    /**
     * Mark one notification as read.
     *
     * PATCH /notifications/{notification}/read
     */
    public function markRead(Request $request, string $notification): JsonResponse
    {
        $record = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        $record->markAsRead();

        return $this->successResponse([
            'notification' => $this->formatNotification($record->fresh()),
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ], 'Notification marked as read');
    }

    /**
     * Mark every notification as read.
     *
     * POST /notifications/read-all
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return $this->successResponse([
            'unread_count' => 0,
        ], 'All notifications marked as read');
    }

    /**
     * Normalize a database notification for the mobile clients.
     *
     * @return array<string, mixed>
     */
    private function formatNotification(DatabaseNotification $notification): array
    {
        $data = $notification->data ?? [];

        return [
            'id' => $notification->id,
            'category' => $data['category'] ?? $notification->type,
            'title' => $data['title'] ?? 'Notification',
            'message' => $data['message'] ?? '',
            'order_id' => $data['order_id'] ?? null,
            'vendor_id' => $data['vendor_id'] ?? null,
            'amount' => $data['amount'] ?? null,
            'data' => $data,
            'read_at' => $notification->read_at?->toIso8601String(),
            'is_read' => $notification->read_at !== null,
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }
}
