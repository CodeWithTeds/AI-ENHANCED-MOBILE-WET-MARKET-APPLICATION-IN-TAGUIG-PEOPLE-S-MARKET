/**
 * Auth Service — handles vendor login, logout, and token management.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';

const TOKEN_KEY = '@taguigsuki_token';
const USER_KEY = '@taguigsuki_user';
const VENDOR_KEY = '@taguigsuki_vendor';

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
}

export interface AuthVendor {
  id: number;
  user_id: number;
  stall_name: string;
  stall_location: string;
  product_categories: string[];
  status: string;
  approved_at: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
  vendor: AuthVendor | null;
  is_vendor: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login vendor with email and password.
 * Throws ApiError with appropriate message if not approved.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await api.request<LoginResponse>('/login', {
    method: 'POST',
    body: credentials as unknown as Record<string, unknown>,
  });

  const data = response.data;

  // Persist auth data
  await AsyncStorage.multiSet([
    [TOKEN_KEY, data.access_token],
    [USER_KEY, JSON.stringify(data.user)],
    [VENDOR_KEY, JSON.stringify(data.vendor)],
  ]);

  return data;
}

/**
 * Logout and clear stored credentials.
 */
export async function logout(): Promise<void> {
  const token = await getToken();

  if (token) {
    try {
      await api.request('/logout', { method: 'POST', token });
    } catch {
      // Silently fail — token may already be invalid
    }
  }

  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, VENDOR_KEY]);
}

/**
 * Get stored auth token.
 */
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

/**
 * Get stored user data.
 */
export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Get stored vendor data.
 */
export async function getStoredVendor(): Promise<AuthVendor | null> {
  const raw = await AsyncStorage.getItem(VENDOR_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Check if user is authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}

/**
 * Fetch fresh profile from server.
 */
export async function fetchProfile(): Promise<{ user: AuthUser; vendor: AuthVendor | null }> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const response = await api.request<{ user: AuthUser; vendor: AuthVendor | null }>('/user', {
    method: 'GET',
    token,
  });

  return response.data;
}
