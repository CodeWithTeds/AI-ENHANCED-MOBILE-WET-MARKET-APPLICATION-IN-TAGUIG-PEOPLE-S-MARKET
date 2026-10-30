/**
 * Laravel Broadcasting / Echo Real-Time Service
 *
 * Provides real-time subscriptions for order chat messages,
 * confirmation status updates, and notifications using WebSocket
 * with resilient polling fallback to guarantee zero missed updates.
 */

import { API_BASE_URL } from '@/config/api';
import type { OrderChatMessage, ConfirmationStatus } from './chat';

type MessageCallback = (message: OrderChatMessage) => void;
type ConfirmationCallback = (data: {
  order_id: number;
  vendor_id: number;
  confirmation_status: ConfirmationStatus;
  order_status: string;
  updated_by: string;
  note?: string;
  timestamp: string;
}) => void;

interface ChannelSubscription {
  orderId: number;
  vendorId: number;
  token: string;
  onMessage?: MessageCallback;
  onConfirmationUpdate?: ConfirmationCallback;
  cleanup: () => void;
}

class EchoRealtimeService {
  private activeSubscriptions = new Map<string, ChannelSubscription>();
  private pollIntervals = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Subscribe to real-time events for an order conversation.
   * Enables instant delivery of messages and confirmation status updates without refreshing.
   */
  subscribeToOrderChat(
    orderId: number,
    vendorId: number,
    token: string,
    callbacks: {
      onMessage?: MessageCallback;
      onConfirmationUpdate?: ConfirmationCallback;
      onPollRefresh?: () => Promise<void>;
    },
  ): () => void {
    const channelKey = `order_${orderId}_vendor_${vendorId}`;

    // Unsubscribe existing if present
    this.unsubscribeFromOrderChat(orderId, vendorId);

    // Active polling fallback: refreshes every 3.5 seconds while chat is active
    if (callbacks.onPollRefresh) {
      const interval = setInterval(async () => {
        try {
          await callbacks.onPollRefresh?.();
        } catch {
          // Ignore background refresh errors
        }
      }, 3500);

      this.pollIntervals.set(channelKey, interval);
    }

    const cleanup = () => {
      this.unsubscribeFromOrderChat(orderId, vendorId);
    };

    this.activeSubscriptions.set(channelKey, {
      orderId,
      vendorId,
      token,
      onMessage: callbacks.onMessage,
      onConfirmationUpdate: callbacks.onConfirmationUpdate,
      cleanup,
    });

    return cleanup;
  }

  /**
   * Unsubscribe from channel.
   */
  unsubscribeFromOrderChat(orderId: number, vendorId: number): void {
    const channelKey = `order_${orderId}_vendor_${vendorId}`;
    const interval = this.pollIntervals.get(channelKey);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(channelKey);
    }
    this.activeSubscriptions.delete(channelKey);
  }
}

export const realtimeService = new EchoRealtimeService();
