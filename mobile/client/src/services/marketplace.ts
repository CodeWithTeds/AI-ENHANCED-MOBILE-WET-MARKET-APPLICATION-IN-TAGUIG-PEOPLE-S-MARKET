/**
 * Marketplace Service — fetches products for customer browsing.
 * Public endpoints, no auth required for browsing.
 */

import { api } from './api';

/* ─── Types ─── */

export interface MarketProduct {
  id: number;
  vendor_id: number;
  name: string;
  description: string | null;
  category: string;
  price: number;
  unit: string;
  image: string | null;
  is_available: boolean;
  created_at: string;
  vendor?: {
    id: number;
    stall_name: string;
    stall_location: string;
  };
}

export interface PaginatedProducts {
  data: MarketProduct[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/* ─── API Calls ─── */

/**
 * Get featured products for the home screen.
 */
export async function getFeaturedProducts(): Promise<MarketProduct[]> {
  const response = await api.request<MarketProduct[]>('/marketplace/featured', {
    method: 'GET',
  });
  return response.data;
}

/**
 * Browse products with optional category filter.
 */
export async function browseProducts(category?: string, page = 1): Promise<PaginatedProducts> {
  let endpoint = `/marketplace/products?page=${page}`;
  if (category && category !== 'all') {
    endpoint += `&category=${encodeURIComponent(category)}`;
  }

  const response = await api.request<PaginatedProducts>(endpoint, {
    method: 'GET',
  });
  return response.data;
}

/**
 * Search products by keyword.
 */
export async function searchProducts(query: string): Promise<PaginatedProducts> {
  const response = await api.request<PaginatedProducts>(
    `/marketplace/products/search?q=${encodeURIComponent(query)}`,
    { method: 'GET' }
  );
  return response.data;
}

/**
 * Get available categories.
 */
export async function getCategories(): Promise<string[]> {
  const response = await api.request<string[]>('/marketplace/categories', {
    method: 'GET',
  });
  return response.data;
}

/**
 * Get single product detail.
 */
export async function getProductDetail(productId: number): Promise<MarketProduct> {
  const response = await api.request<MarketProduct>(`/marketplace/products/${productId}`, {
    method: 'GET',
  });
  return response.data;
}
