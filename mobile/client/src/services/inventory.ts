/**
 * Inventory Service — CRUD operations for vendor inventory management.
 */

import { api, ApiError } from './api';
import { getToken } from './auth';
import type { Product } from './products';

export interface Inventory {
  id: number;
  product_id: number;
  vendor_id: number;
  stock_quantity: number;
  reorder_level: number;
  max_stock_level: number | null;
  cost_price: string | null;
  selling_price: string;
  markup_percentage: string | null;
  status: 'active' | 'inactive' | 'seasonal' | 'discontinued';
  created_at: string;
  updated_at: string;
  product: Product;
}

export interface CreateInventoryData {
  product_id: number;
  stock_quantity: number;
  reorder_level?: number;
  max_stock_level?: number;
  cost_price?: number;
  selling_price: number;
  markup_percentage?: number;
  status?: 'active' | 'inactive' | 'seasonal' | 'discontinued';
}

export interface UpdateInventoryData {
  stock_quantity?: number;
  reorder_level?: number;
  max_stock_level?: number;
  cost_price?: number;
  selling_price?: number;
  markup_percentage?: number;
  status?: 'active' | 'inactive' | 'seasonal' | 'discontinued';
}

export interface InventorySummary {
  total_products: number;
  total_units: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  total_cost_value: number;
  total_selling_value: number;
  estimated_profit: number;
}

/**
 * Fetch all inventory items for the authenticated vendor.
 */
export async function fetchInventory(filters?: {
  status?: string;
  stock_status?: string;
  category?: string;
  search?: string;
}): Promise<Inventory[]> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.stock_status) params.append('stock_status', filters.stock_status);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  const url = `/inventory${queryString ? `?${queryString}` : ''}`;

  const response = await api.request<Inventory[]>(url, {
    method: 'GET',
    token,
  });

  return response.data;
}

/**
 * Fetch inventory summary stats.
 */
export async function fetchInventorySummary(): Promise<InventorySummary> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const response = await api.request<InventorySummary>('/inventory/summary', {
    method: 'GET',
    token,
  });

  return response.data;
}

/**
 * Create a new inventory record for a product.
 */
export async function createInventory(data: CreateInventoryData): Promise<Inventory> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const response = await api.request<Inventory>('/inventory', {
    method: 'POST',
    token,
    body: data as unknown as Record<string, unknown>,
  });

  return response.data;
}

/**
 * Update an existing inventory record.
 */
export async function updateInventory(id: number, data: UpdateInventoryData): Promise<Inventory> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const response = await api.request<Inventory>(`/inventory/${id}`, {
    method: 'PUT',
    token,
    body: data as unknown as Record<string, unknown>,
  });

  return response.data;
}

/**
 * Adjust stock quantity for an inventory item.
 */
export async function adjustStock(
  id: number,
  quantity: number,
  type: 'restock' | 'sold' | 'spoiled' | 'adjustment',
  reason?: string
): Promise<Inventory> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  const response = await api.request<Inventory>(`/inventory/${id}/adjust`, {
    method: 'POST',
    token,
    body: { quantity, type, reason } as unknown as Record<string, unknown>,
  });

  return response.data;
}

/**
 * Delete an inventory record.
 */
export async function deleteInventory(id: number): Promise<void> {
  const token = await getToken();
  if (!token) throw new ApiError('Not authenticated', 401);

  await api.request(`/inventory/${id}`, {
    method: 'DELETE',
    token,
  });
}
