/**
 * Customer Auth Service — handles customer registration and login.
 * Separated from vendor auth for clean role-based routing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const CUSTOMER_TOKEN_KEY = '@taguigsuki_customer_token';
const CUSTOMER_USER_KEY = '@taguigsuki_customer_user';

const VENDOR_TOKEN_KEY = '@taguigsuki_token';
const VENDOR_USER_KEY = '@taguigsuki_user';
const VENDOR_DATA_KEY = '@taguigsuki_vendor';

export interface CustomerUser {
  id: number;
  name: string;
  email: string | null;
  phone?: string;
}

export interface CustomerLoginCredentials {
  email: string;
  password: string;
}

export interface CustomerRegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

interface CustomerAuthResponse {
  access_token: string;
  token_type: string;
  user: CustomerUser;
}

/**
 * Register a new customer account.
 */
export async function registerCustomer(data: CustomerRegisterData): Promise<CustomerAuthResponse> {
  const response = await api.request<CustomerAuthResponse>('/register', {
    method: 'POST',
    body: data as unknown as Record<string, unknown>,
  });

  const result = response.data;

  // Sync both customer and vendor storages so the session works everywhere
  await AsyncStorage.multiSet([
    [CUSTOMER_TOKEN_KEY, result.access_token],
    [CUSTOMER_USER_KEY, JSON.stringify(result.user)],
    [VENDOR_TOKEN_KEY, result.access_token],
    [VENDOR_USER_KEY, JSON.stringify(result.user)],
    [VENDOR_DATA_KEY, JSON.stringify(null)],
  ]);

  return result;
}

/**
 * Login an existing customer.
 */
export async function loginCustomer(credentials: CustomerLoginCredentials): Promise<CustomerAuthResponse> {
  const response = await api.request<CustomerAuthResponse>('/login', {
    method: 'POST',
    body: credentials as unknown as Record<string, unknown>,
  });

  const result = response.data;

  // Sync both customer and vendor storages so the session works everywhere
  await AsyncStorage.multiSet([
    [CUSTOMER_TOKEN_KEY, result.access_token],
    [CUSTOMER_USER_KEY, JSON.stringify(result.user)],
    [VENDOR_TOKEN_KEY, result.access_token],
    [VENDOR_USER_KEY, JSON.stringify(result.user)],
    [VENDOR_DATA_KEY, JSON.stringify(null)],
  ]);

  return result;
}

/**
 * Logout customer.
 */
export async function logoutCustomer(): Promise<void> {
  const token = await getCustomerToken();

  if (token) {
    try {
      await api.request('/logout', { method: 'POST', token });
    } catch {
      // Silently fail
    }
  }

  await AsyncStorage.multiRemove([
    CUSTOMER_TOKEN_KEY,
    CUSTOMER_USER_KEY,
    VENDOR_TOKEN_KEY,
    VENDOR_USER_KEY,
    VENDOR_DATA_KEY,
  ]);
}

/**
 * Get stored customer token.
 */
export async function getCustomerToken(): Promise<string | null> {
  return AsyncStorage.getItem(CUSTOMER_TOKEN_KEY);
}

/**
 * Get stored customer user data.
 */
export async function getStoredCustomer(): Promise<CustomerUser | null> {
  const raw = await AsyncStorage.getItem(CUSTOMER_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
