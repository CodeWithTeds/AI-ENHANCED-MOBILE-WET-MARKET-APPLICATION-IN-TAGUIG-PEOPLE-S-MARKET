/**
 * Customer Profile Service — manages account preferences, password, and notifications.
 * Separation of concerns: API calls live here, UI logic stays in components.
 */

import { api } from './api';

/* ─── Types ─── */

export interface CustomerProfile {
  user: {
    id: number;
    name: string;
    email: string | null;
  };
  notification_preferences: CustomerNotificationPreferences;
}

export interface UpdateCustomerProfileData {
  name?: string;
  email?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

export interface CustomerNotificationPreferences {
  order_alerts: boolean;
  promotion_updates: boolean;
}

/* ─── API Calls ─── */

/**
 * Fetch customer profile.
 */
export async function getCustomerProfile(token: string): Promise<CustomerProfile> {
  const response = await api.request<CustomerProfile>('/profile', {
    method: 'GET',
    token,
  });
  return response.data;
}

/**
 * Update account preferences (name, email).
 */
export async function updateCustomerProfile(token: string, data: UpdateCustomerProfileData) {
  const response = await api.request('/profile', {
    method: 'PUT',
    token,
    body: data as unknown as Record<string, unknown>,
  });
  return response.data;
}

/**
 * Change account password.
 */
export async function changeCustomerPassword(token: string, data: ChangePasswordData) {
  const response = await api.request('/profile/password', {
    method: 'PUT',
    token,
    body: data as unknown as Record<string, unknown>,
  });
  return response.data;
}

/**
 * Update notification preferences.
 */
export async function updateCustomerNotificationPreferences(
  token: string,
  preferences: CustomerNotificationPreferences
) {
  const response = await api.request('/profile/notifications', {
    method: 'PUT',
    token,
    body: preferences as unknown as Record<string, unknown>,
  });
  return response.data;
}
