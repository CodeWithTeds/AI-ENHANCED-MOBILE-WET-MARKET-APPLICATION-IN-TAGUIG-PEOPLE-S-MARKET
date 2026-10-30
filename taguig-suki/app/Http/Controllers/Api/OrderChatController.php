<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OrderChatService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class OrderChatController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly OrderChatService $chatService) {}

    /**
     * List all conversations for an order.
     *
     * GET /orders/{orderId}/chats
     */
    public function index(Request $request, int $orderId): JsonResponse
    {
        try {
            $conversations = $this->chatService->getConversationsForOrder($request->user(), $orderId);

            return $this->successResponse($conversations, 'Order conversations retrieved');
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 403);
        } catch (NotFoundHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 404);
        }
    }

    /**
     * Get a specific conversation and its message history.
     *
     * GET /orders/{orderId}/vendors/{vendorId}/chat
     */
    public function show(Request $request, int $orderId, int $vendorId): JsonResponse
    {
        try {
            $conversation = $this->chatService->getConversation($request->user(), $orderId, $vendorId);

            return $this->successResponse($conversation, 'Chat history retrieved');
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 403);
        } catch (NotFoundHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 404);
        }
    }

    /**
     * Send a message in an order chat.
     *
     * POST /orders/{orderId}/vendors/{vendorId}/chat/messages
     */
    public function sendMessage(Request $request, int $orderId, int $vendorId): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1000',
            'message_type' => 'nullable|string|in:text,clarification',
            'metadata' => 'nullable|array',
        ]);

        try {
            $message = $this->chatService->sendMessage(
                $request->user(),
                $orderId,
                $vendorId,
                $validated['message'],
                $validated['message_type'] ?? 'text',
                $validated['metadata'] ?? null
            );

            return $this->successResponse($message, 'Message sent successfully', 201);
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 403);
        } catch (NotFoundHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 404);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Vendor requests confirmation before preparing items for a COD order.
     *
     * POST /orders/{orderId}/vendors/{vendorId}/chat/request-confirmation
     */
    public function requestConfirmation(Request $request, int $orderId, int $vendorId): JsonResponse
    {
        try {
            $message = $this->chatService->requestOrderConfirmation($request->user(), $orderId, $vendorId);

            return $this->successResponse($message, 'Order confirmation requested successfully');
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 403);
        } catch (NotFoundHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 404);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Customer or vendor confirms the order.
     *
     * POST /orders/{orderId}/vendors/{vendorId}/chat/confirm
     */
    public function confirmOrder(Request $request, int $orderId, int $vendorId): JsonResponse
    {
        $validated = $request->validate([
            'note' => 'nullable|string|max:500',
        ]);

        try {
            $result = $this->chatService->confirmOrder(
                $request->user(),
                $orderId,
                $vendorId,
                $validated['note'] ?? null
            );

            return $this->successResponse($result, 'Order confirmed successfully');
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 403);
        } catch (NotFoundHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 404);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Customer cancels the order through chat before items are prepared.
     *
     * POST /orders/{orderId}/vendors/{vendorId}/chat/cancel
     */
    public function cancelOrder(Request $request, int $orderId, int $vendorId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        try {
            $result = $this->chatService->cancelOrder(
                $request->user(),
                $orderId,
                $vendorId,
                $validated['reason'] ?? null
            );

            return $this->successResponse($result, 'Order cancelled successfully and stock restored');
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 403);
        } catch (NotFoundHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 404);
        } catch (UnprocessableEntityHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Get unread message count for authenticated user badge.
     *
     * GET /chats/unread
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = $this->chatService->getUnreadCount($request->user());

        return $this->successResponse(['unread_count' => $count], 'Unread count retrieved');
    }

    /**
     * Mark a conversation as read.
     *
     * POST /chats/{conversationId}/read
     */
    public function markRead(Request $request, int $conversationId): JsonResponse
    {
        try {
            $updated = $this->chatService->markConversationRead($request->user(), $conversationId);

            return $this->successResponse(['marked_read' => $updated], 'Conversation marked as read');
        } catch (AccessDeniedHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 403);
        } catch (NotFoundHttpException $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 404);
        }
    }
}
