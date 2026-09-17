/**
 * Customer Auth Service — handles customer registration and login.
 * Separated from vendor auth for clean role-based routing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';
import { API_BASE_URL } from '@/config/api';

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
  /** Optional ID verification at registration */
  id_type?: string;
  id_image_uri?: string | null;
}

interface CustomerAuthResponse {
  access_token: string | null;
  token_type: string;
  user: CustomerUser;
  verification?: any;
  requires_approval?: boolean;
  message?: string;
}

/**
 * Register a new customer account.
 * Supports optional ID verification upload via multipart (image).
 */
export async function registerCustomer(data: CustomerRegisterData): Promise<CustomerAuthResponse> {
  const hasIdImage = !!data.id_image_uri;

  let response: { data: CustomerAuthResponse };

  if (hasIdImage) {
    // Use XHR for multipart (reliable on Android)
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('password', data.password);
    formData.append('password_confirmation', data.password_confirmation);
    if (data.id_type) formData.append('id_type', data.id_type);

    const uri = data.id_image_uri as string;
    const filename = uri.split('/').pop() ?? 'id_image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    formData.append('id_image', { uri, name: filename, type } as unknown as Blob);

    response = await new Promise<{ data: CustomerAuthResponse }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/register`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.timeout = 30000;
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            // API wraps in {status,message,data}
            resolve({ data: res.data as CustomerAuthResponse });
          } else {
            const msg = res.message || 'Registration failed';
            let full = msg;
            if (res.errors && typeof res.errors === 'object') {
              const errs = Object.values(res.errors as Record<string, string[]>).flat().join('\n');
              if (errs) full = errs;
            }
            reject(new ApiError(full, xhr.status, res));
          }
        } catch {
          reject(new ApiError(`Invalid response: ${xhr.responseText.substring(0,150)}`, xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError('Network request failed', 0));
      xhr.ontimeout = () => reject(new ApiError('Request timed out', 0));
      xhr.send(formData);
    });
  } else {
    // JSON path — no ID
    const { id_image_uri, id_type, ...jsonData } = data as any;
    const apiRes = await api.request<CustomerAuthResponse>('/register', {
      method: 'POST',
      body: jsonData as unknown as Record<string, unknown>,
    });
    response = { data: apiRes.data };
  }

  const result = response.data as CustomerAuthResponse & { requires_approval?: boolean; message?: string };

  // If admin approval required, don't store token — surface pending message
  if ((result as any).requires_approval || !result.access_token) {
    const pendingMsg = (result as any).message || 'Registration successful! Your ID is pending admin approval. You will be able to login once verified.';
    throw new ApiError(pendingMsg, 201, result);
  }

  // Sync both customer and vendor storages so the session works everywhere
  await AsyncStorage.multiSet([
    [CUSTOMER_TOKEN_KEY, result.access_token!],
    [CUSTOMER_USER_KEY, JSON.stringify(result.user)],
    [VENDOR_TOKEN_KEY, result.access_token!],
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

  // Login only succeeds for verified customers (backend enforces), so token must exist
  if (!result.access_token) {
    throw new ApiError('Login succeeded but no token returned.', 500);
  }

  // Sync both customer and vendor storages so the session works everywhere
  await AsyncStorage.multiSet([
    [CUSTOMER_TOKEN_KEY, result.access_token!],
    [CUSTOMER_USER_KEY, JSON.stringify(result.user)],
    [VENDOR_TOKEN_KEY, result.access_token!],
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
