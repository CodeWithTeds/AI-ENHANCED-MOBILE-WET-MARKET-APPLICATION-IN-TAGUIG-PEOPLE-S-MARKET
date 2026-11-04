/**
 * In-app notifications service — powers the customer/vendor notification bell.
 */

import { api } from './api';

export type NotificationCategory =
  | 'order_placed'
  | 'payment_submitted'
  | 'payment_received'
  | 'order_status'
  | string;

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  order_id: number | null;
  vendor_id: number | null;
  amount: number | null;
  data: Record<string, unknown>;
  read_at: string | null;
  is_read: boolean;
  created_at: string | null;
}

export interface NotificationPage {
  notifications: AppNotification[];
  unread_count: number;
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export async function getNotifications(
  token: string,
  page = 1,
  perPage = 30,
): Promise<NotificationPage> {
  const response = await api.request<NotificationPage>(
    `/notifications?page=${page}&per_page=${perPage}`,
    { method: 'GET', token },
  );
  return response.data;
}

export async function getUnreadNotificationCount(
  token: string,
): Promise<{ unread_count: number }> {
  const response = await api.request<{ unread_count: number }>(
    '/notifications/unread-count',
    { method: 'GET', token },
  );
  return response.data;
}

export async function markNotificationRead(
  id: string,
  token: string,
): Promise<{ notification: AppNotification; unread_count: number }> {
  const response = await api.request<{ notification: AppNotification; unread_count: number }>(
    `/notifications/${id}/read`,
    { method: 'PATCH', token },
  );
  return response.data;
}

export async function markAllNotificationsRead(
  token: string,
): Promise<{ unread_count: number }> {
  const response = await api.request<{ unread_count: number }>(
    '/notifications/read-all',
    { method: 'POST', token },
  );
  return response.data;
}
