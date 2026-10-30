/**
 * In-App Order Chat & Messaging Service
 *
 * Handles customer-vendor messaging for COD orders,
 * order confirmation requests, cancellation, and real-time updates.
 */

import { api } from './api';
import type { OrderStatus } from './orders';

export type ConfirmationStatus = 'none' | 'pending_confirmation' | 'confirmed' | 'cancelled' | 'not_required';

export type MessageType =
  | 'text'
  | 'confirmation_request'
  | 'order_confirmed'
  | 'order_cancelled'
  | 'clarification';

export interface OrderChatMessage {
  id: number;
  order_conversation_id: number;
  sender_id: number;
  sender_name?: string;
  sender_type: 'customer' | 'vendor' | 'system';
  message: string;
  message_type: MessageType;
  metadata?: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

export interface OrderConversation {
  id: number;
  order_id: number;
  vendor_id: number;
  customer_id: number;
  confirmation_status: ConfirmationStatus;
  last_message_at: string | null;
  unread_count?: number;
  order?: {
    id: number;
    order_number: string;
    status: OrderStatus;
    confirmation_status: ConfirmationStatus;
    total_amount: number;
    payment_method: string;
    payment_status?: string;
    created_at: string;
  };
  vendor?: {
    id: number;
    stall_name: string;
    stall_location: string;
    user_id: number;
  };
  customer?: {
    id: number;
    name: string;
    email: string;
  };
  messages?: OrderChatMessage[];
  latest_message?: OrderChatMessage;
}

/**
 * Fetch all conversations for a specific order.
 */
export async function getOrderChats(orderId: number, token: string): Promise<OrderConversation[]> {
  const response = await api.request<OrderConversation[]>(`/orders/${orderId}/chats`, {
    method: 'GET',
    token,
  });
  return response.data ?? [];
}

/**
 * Fetch a specific order conversation and full message history.
 */
export async function getOrderChat(orderId: number, vendorId: number, token: string): Promise<OrderConversation> {
  const response = await api.request<OrderConversation>(`/orders/${orderId}/vendors/${vendorId}/chat`, {
    method: 'GET',
    token,
  });
  return response.data;
}

/**
 * Send a chat message (text or clarification).
 */
export async function sendChatMessage(
  orderId: number,
  vendorId: number,
  message: string,
  token: string,
  messageType: 'text' | 'clarification' = 'text',
): Promise<OrderChatMessage> {
  const response = await api.request<OrderChatMessage>(`/orders/${orderId}/vendors/${vendorId}/chat/messages`, {
    method: 'POST',
    body: {
      message,
      message_type: messageType,
    } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

/**
 * Vendor requests customer confirmation for a COD order before preparing items.
 */
export async function requestOrderConfirmation(
  orderId: number,
  vendorId: number,
  token: string,
): Promise<OrderChatMessage> {
  const response = await api.request<OrderChatMessage>(
    `/orders/${orderId}/vendors/${vendorId}/chat/request-confirmation`,
    {
      method: 'POST',
      token,
    },
  );
  return response.data;
}

/**
 * Customer confirms the order through chat.
 */
export async function confirmOrderChat(
  orderId: number,
  vendorId: number,
  token: string,
  note?: string,
): Promise<{ status: string; order: any; conversation: OrderConversation; message: OrderChatMessage }> {
  const response = await api.request<{
    status: string;
    order: any;
    conversation: OrderConversation;
    message: OrderChatMessage;
  }>(`/orders/${orderId}/vendors/${vendorId}/chat/confirm`, {
    method: 'POST',
    body: (note ? { note } : {}) as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

/**
 * Customer cancels the order through chat before preparation.
 */
export async function cancelOrderChat(
  orderId: number,
  vendorId: number,
  token: string,
  reason?: string,
): Promise<{ status: string; order: any; conversation: OrderConversation; message: OrderChatMessage }> {
  const response = await api.request<{
    status: string;
    order: any;
    conversation: OrderConversation;
    message: OrderChatMessage;
  }>(`/orders/${orderId}/vendors/${vendorId}/chat/cancel`, {
    method: 'POST',
    body: (reason ? { reason } : {}) as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

/**
 * Get unread message count across all conversations.
 */
export async function getUnreadChatCount(token: string): Promise<number> {
  try {
    const response = await api.request<{ unread_count: number }>('/chats/unread', {
      method: 'GET',
      token,
    });
    return response.data?.unread_count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Mark a conversation as read.
 */
export async function markChatRead(conversationId: number, token: string): Promise<void> {
  try {
    await api.request(`/chats/${conversationId}/read`, {
      method: 'POST',
      token,
    });
  } catch {
    // Ignore error
  }
}
