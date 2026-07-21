/**
 * Base API service — handles HTTP communication with the Laravel backend.
 */

import { API_BASE_URL } from '@/config/api';

const BASE_URL = API_BASE_URL;

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: FormData | Record<string, unknown>;
  token?: string;
  isFormData?: boolean;
}

interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  message: string;
  data: T;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, token, isFormData = false } = options;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Do NOT set Content-Type for FormData — let fetch set the boundary automatically
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body) {
      config.body = isFormData ? (body as FormData) : JSON.stringify(body);
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, config);
      const text = await response.text();

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(`Invalid JSON response: ${text.substring(0, 200)}`, response.status);
      }

      if (!response.ok) {
        const errorData = data as Record<string, unknown>;
        throw new ApiError(
          (errorData.message as string) || `Request failed with status ${response.status}`,
          response.status,
          errorData
        );
      }

      return data as ApiResponse<T>;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      // Network error — log for debugging
      const message = error instanceof Error ? error.message : 'Unknown network error';
      console.error(`[API] ${method} ${url} failed:`, message);
      throw new ApiError(message, 0);
    }
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const api = new ApiService(BASE_URL);
