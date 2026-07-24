/**
 * Products Service — CRUD operations for vendor products.
 */

import { api, ApiError } from './api';
import { API_BASE_URL } from '@/config/api';
import { getToken } from './auth';

export interface Product {
  id: number;
  vendor_id: number;
  name: string;
  description: string | null;
  category: string;
  price: string;
  unit: string;
  image: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductData {
  name: string;
  description?: string;
  category: string;
  price: number;
  unit: string;
  image?: { uri: string; name: string; type: string };
  is_available?: boolean;
}

export interface UpdateProductData extends Partial<CreateProductData> {}

/**
 * Fetch all products for the authenticated vendor.
 */
export async function fetchProducts(): Promise<Product[]> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const response = await api.request<Product[]>('/products', {
    method: 'GET',
    token,
  });

  return response.data;
}

/**
 * Create a new product.
 */
export async function createProduct(data: CreateProductData): Promise<Product> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const formData = new FormData();
  formData.append('name', data.name);
  if (data.description) formData.append('description', data.description);
  formData.append('category', data.category);
  formData.append('price', String(data.price));
  formData.append('unit', data.unit);
  if (data.is_available !== undefined) {
    formData.append('is_available', data.is_available ? '1' : '0');
  }

  if (data.image) {
    formData.append('image', {
      uri: data.image.uri,
      name: data.image.name,
      type: data.image.type,
    } as unknown as Blob);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/products`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 30000;

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(res.data);
        } else {
          reject(new ApiError(res.message || 'Failed to create product', xhr.status, res));
        }
      } catch {
        reject(new ApiError('Invalid server response', xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError('Network error', 0));
    xhr.ontimeout = () => reject(new ApiError('Request timed out', 0));
    xhr.send(formData);
  });
}

/**
 * Update an existing product.
 */
export async function updateProduct(id: number, data: UpdateProductData): Promise<Product> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  // For updates without image, use JSON
  if (!data.image) {
    const response = await api.request<Product>(`/products/${id}`, {
      method: 'PUT',
      token,
      body: data as unknown as Record<string, unknown>,
    });
    return response.data;
  }

  // With image, use FormData + XHR
  const formData = new FormData();
  if (data.name) formData.append('name', data.name);
  if (data.description) formData.append('description', data.description);
  if (data.category) formData.append('category', data.category);
  if (data.price !== undefined) formData.append('price', String(data.price));
  if (data.unit) formData.append('unit', data.unit);
  if (data.is_available !== undefined) formData.append('is_available', data.is_available ? '1' : '0');

  formData.append('image', {
    uri: data.image.uri,
    name: data.image.name,
    type: data.image.type,
  } as unknown as Blob);

  // Laravel doesn't handle PUT with FormData well, use POST with _method
  formData.append('_method', 'PUT');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/products/${id}`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 30000;

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(res.data);
        } else {
          reject(new ApiError(res.message || 'Failed to update product', xhr.status, res));
        }
      } catch {
        reject(new ApiError('Invalid server response', xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError('Network error', 0));
    xhr.ontimeout = () => reject(new ApiError('Request timed out', 0));
    xhr.send(formData);
  });
}

/**
 * Delete a product.
 */
export async function deleteProduct(id: number): Promise<void> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  await api.request(`/products/${id}`, {
    method: 'DELETE',
    token,
  });
}

export const PRODUCT_UNITS = ['kg', 'pcs', 'bundle', 'pack', 'liter', 'dozen'] as const;

export const PRODUCT_CATEGORIES = [
  'Meat', 'Fish', 'Vegetables', 'Fruits', 'Spices',
  'Poultry', 'Seafood', 'Dairy', 'Grains & Rice', 'Condiments',
] as const;
