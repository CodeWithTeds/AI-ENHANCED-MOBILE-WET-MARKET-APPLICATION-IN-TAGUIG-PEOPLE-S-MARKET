/**
 * Vendor Profile Service — manages business info and account settings.
 * Separation of concerns: API calls live here, UI logic stays in components.
 */

import { api } from './api';

/* ─── Types ─── */

export interface VendorBusinessProfile {
  user: {
    id: number;
    name: string;
    email: string | null;
  };
  vendor: {
    id: number;
    stall_name: string;
    stall_location: string;
    product_categories: string[];
    status: string;
    approved_at: string | null;
    notification_preferences?: NotificationPreferences;
  } | null;
  stats: {
    total_products: number;
    total_orders: number;
    member_since: string | null;
  };
}

export interface UpdateBusinessData {
  name?: string;
  stall_name?: string;
  product_categories?: string[];
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

export interface NotificationPreferences {
  order_alerts: boolean;
  low_stock_alerts: boolean;
  promotion_updates: boolean;
}

/* ─── API Calls ─── */

/**
 * Fetch full vendor business profile with stats.
 */
export async function getBusinessProfile(token: string): Promise<VendorBusinessProfile> {
  const response = await api.request<VendorBusinessProfile>('/vendor/profile', {
    method: 'GET',
    token,
  });
  return response.data;
}

/**
 * Update business information (stall name, categories, user name).
 */
export async function updateBusinessInfo(token: string, data: UpdateBusinessData) {
  const response = await api.request('/vendor/profile/business', {
    method: 'PUT',
    token,
    body: data as unknown as Record<string, unknown>,
  });
  return response.data;
}

/**
 * Change account password.
 */
export async function changePassword(token: string, data: ChangePasswordData) {
  const response = await api.request('/vendor/profile/password', {
    method: 'PUT',
    token,
    body: data as unknown as Record<string, unknown>,
  });
  return response.data;
}

/**
 * Update notification preferences.
 */
export async function updateNotificationPreferences(
  token: string,
  preferences: NotificationPreferences
) {
  const response = await api.request('/vendor/profile/notifications', {
    method: 'PUT',
    token,
    body: preferences as unknown as Record<string, unknown>,
  });
  return response.data;
}
