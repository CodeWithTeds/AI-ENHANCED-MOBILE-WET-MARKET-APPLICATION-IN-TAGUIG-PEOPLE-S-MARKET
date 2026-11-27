/**
 * Marketplace Service — fetches products for customer browsing.
 * Public endpoints, no auth required for browsing.
 */

import { api } from './api';

/* ─── Types ─── */

export interface VendorComparisonItem {
  product_id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  image: string | null;
  is_available: boolean;
  is_out_of_stock?: boolean;
  stock_quantity: number;
  reorder_level?: number | null;
  vendor_id: number;
  stall_name: string;
  stall_location: string;
  rating: number;
  reviews_count: number;
  is_current: boolean;
  is_ai_recommended: boolean;
}

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
  is_out_of_stock?: boolean;
  created_at: string;
  rating?: number;
  product_rating?: number | null;
  reviews_count?: number;
  vendor_rating?: number;
  vendor_review_count?: number;
  stock_quantity?: number;
  reorder_level?: number | null;
  is_ai_recommended?: boolean;
  comparison_vendors?: VendorComparisonItem[];
  vendor?: {
    id: number;
    stall_name: string;
    stall_location: string;
    opening_time?: string;
    closing_time?: string;
    operating_hours?: string;
    is_open?: boolean;
  };
}

export interface VendorStoreData {
  vendor: {
    id: number;
    stall_name: string;
    stall_location: string;
    opening_time?: string;
    closing_time?: string;
    operating_hours?: string;
    is_open?: boolean;
    product_categories?: string[];
  };
  products: MarketProduct[];
}

export interface PaginatedProducts {
  data: MarketProduct[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export function formatStockQuantity(qty?: number | null): string {
  if (qty === undefined || qty === null || Number.isNaN(Number(qty))) return '0';
  const n = Number(qty);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

export function isProductOutOfStock(
  item?: {
    is_available?: boolean;
    is_out_of_stock?: boolean;
    stock_quantity?: number | null;
  } | null,
): boolean {
  if (!item) return true;
  if (item.is_out_of_stock) return true;
  if (item.is_available === false) return true;
  if (
    item.stock_quantity !== undefined &&
    item.stock_quantity !== null &&
    !Number.isNaN(Number(item.stock_quantity)) &&
    Number(item.stock_quantity) <= 0
  ) {
    return true;
  }
  return false;
}

export function getMaxOrderQuantity(
  item?: { stock_quantity?: number | null; reorder_level?: number | null } | null,
): number | null {
  if (!item) return null;
  const hasStock =
    item.stock_quantity !== undefined &&
    item.stock_quantity !== null &&
    !Number.isNaN(Number(item.stock_quantity));
  const hasReorder =
    item.reorder_level !== undefined &&
    item.reorder_level !== null &&
    !Number.isNaN(Number(item.reorder_level)) &&
    Number(item.reorder_level) > 0;

  if (hasStock && hasReorder) {
    return Math.min(Number(item.stock_quantity), Number(item.reorder_level));
  }
  if (hasReorder) {
    return Number(item.reorder_level);
  }
  if (hasStock) {
    return Number(item.stock_quantity);
  }
  return null;
}

export function validateOrderQuantity(
  rawQty: number,
  options: {
    unit: string;
    stockQuantity?: number | null;
    reorderLevel?: number | null;
    extraExistingQty?: number;
  },
): string | null {
  const isWeight = options.unit.toLowerCase() === 'kg';
  const minQty = isWeight ? 0.5 : 1;

  if (Number.isNaN(rawQty) || rawQty < minQty) {
    return `Enter at least ${minQty} ${options.unit}.`;
  }

  if (isWeight) {
    if (Math.abs(rawQty * 2 - Math.round(rawQty * 2)) > 0.0001) {
      return 'For per kg items, enter increments of 0.5 (e.g. 0.5, 1, 1.5).';
    }
  } else if (Math.abs(rawQty - Math.round(rawQty)) > 0.0001) {
    return `Quantity for ${options.unit} must be a whole number.`;
  }

  const totalQty = rawQty + (options.extraExistingQty ?? 0);

  if (
    options.reorderLevel !== undefined &&
    options.reorderLevel !== null &&
    !Number.isNaN(Number(options.reorderLevel)) &&
    Number(options.reorderLevel) > 0 &&
    totalQty > Number(options.reorderLevel) + 1e-9
  ) {
    const maxStr = formatStockQuantity(Number(options.reorderLevel));
    return `Max allowed is ${maxStr} ${options.unit} per order (Reorder Level: ${maxStr}).`;
  }

  if (
    options.stockQuantity !== undefined &&
    options.stockQuantity !== null &&
    !Number.isNaN(Number(options.stockQuantity)) &&
    totalQty > Number(options.stockQuantity) + 1e-9
  ) {
    const stockStr = formatStockQuantity(Number(options.stockQuantity));
    return `Only ${stockStr} ${options.unit} remaining in stock.`;
  }

  return null;
}

export function formatStocksAvailable(stockQty?: number | null, isAvailable = true): string {
  if (!isAvailable) {
    return 'Out of Stock';
  }
  if (stockQty === undefined || stockQty === null || Number.isNaN(Number(stockQty))) {
    return 'Available';
  }
  const n = Number(stockQty);
  if (n <= 0) {
    return 'Out of Stock';
  }
  const label = n === 1 ? 'stock' : 'stocks';
  return `${formatStockQuantity(n)} ${label} available`;
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

/**
 * Get vendor store details and products.
 */
export async function getVendorStore(vendorId: number): Promise<VendorStoreData> {
  const response = await api.request<VendorStoreData>(`/marketplace/vendors/${vendorId}`, {
    method: 'GET',
  });
  return response.data;
}
