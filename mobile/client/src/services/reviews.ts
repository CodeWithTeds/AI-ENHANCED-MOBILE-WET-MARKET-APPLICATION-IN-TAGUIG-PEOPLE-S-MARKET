/**
 * Reviews service — customers rate vendors, products, and recipes.
 * Vendor/product reviews are gated on COMPLETED orders (server-enforced).
 */

import { api } from './api';
import { API_BASE_URL } from '@/config/api';

/* ─── Types ─── */

export interface ReviewImage {
  id: number;
  path: string;
  url: string;
}

export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  user: string;
  images?: ReviewImage[];
}

export interface ReviewSummary {
  reviews: Review[];
  average_rating: number;
  total: number;
  rating_counts: Record<number, number>;
}

export interface ReviewableVendor {
  id: number;
  stall_name: string;
  stall_location: string;
  reviewed: boolean;
}

export interface ReviewableProduct {
  id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  reviewed: boolean;
}

export interface EligibleOrder {
  order_id: number;
  order_number: string;
  created_at: string;
  vendors: ReviewableVendor[];
  products: ReviewableProduct[];
}

export interface SubmitReviewImage {
  uri: string;
  name?: string;
  type?: string;
}

export interface SubmitReviewPayload {
  rating: number;
  comment?: string;
  order_id?: number;
  images?: SubmitReviewImage[];
}

export function resolveReviewImageUrl(url: string | null, path: string | null): string {
  if (path) {
    const base = API_BASE_URL.replace('/api/v1', '');
    return `${base}/storage/${path.replace(/^\//, '')}`;
  }
  if (url && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    const base = API_BASE_URL.replace('/api/v1', '');
    const idx = url.indexOf('/storage/');
    if (idx !== -1) return base + url.substring(idx);
  }
  return url ?? '';
}

/* ─── API Calls (public) ─── */

export async function getVendorReviews(vendorId: number): Promise<ReviewSummary> {
  const response = await api.request<ReviewSummary>(`/reviews/vendor/${vendorId}`, {
    method: 'GET',
  });
  return response.data;
}

export async function getProductReviews(productId: number): Promise<ReviewSummary> {
  const response = await api.request<ReviewSummary>(`/reviews/product/${productId}`, {
    method: 'GET',
  });
  return response.data;
}

export async function getRecipeReviews(recipeName: string): Promise<ReviewSummary> {
  const response = await api.request<ReviewSummary>(
    `/reviews/recipe?q=${encodeURIComponent(recipeName)}`,
    { method: 'GET' }
  );
  return response.data;
}

/* ─── API Calls (auth required) ─── */

/**
 * Everything the customer can review from their completed orders.
 */
export async function getEligibleReviews(token: string): Promise<EligibleOrder[]> {
  const response = await api.request<EligibleOrder[]>('/reviews/eligible', {
    method: 'GET',
    token,
  });
  return response.data;
}

export async function submitVendorReview(
  vendorId: number,
  payload: SubmitReviewPayload,
  token: string,
): Promise<Review> {
  if (payload.images && payload.images.length > 0) {
    const formData = new FormData();
    formData.append('vendor_id', String(vendorId));
    formData.append('rating', String(payload.rating));
    if (payload.comment) formData.append('comment', payload.comment);
    if (payload.order_id) formData.append('order_id', String(payload.order_id));

    payload.images.forEach((img, index) => {
      const filename = img.name || img.uri.split('/').pop() || `vendor_review_${index}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = img.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

      formData.append('images[]', {
        uri: img.uri,
        name: filename,
        type,
      } as unknown as Blob);
    });

    const response = await api.request<Review>('/reviews/vendor', {
      method: 'POST',
      body: formData,
      isFormData: true,
      token,
    });
    return response.data;
  }

  const response = await api.request<Review>('/reviews/vendor', {
    method: 'POST',
    body: { ...payload, vendor_id: vendorId } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

export async function submitProductReview(
  productId: number,
  payload: SubmitReviewPayload,
  token: string,
): Promise<Review> {
  if (payload.images && payload.images.length > 0) {
    const formData = new FormData();
    formData.append('product_id', String(productId));
    formData.append('rating', String(payload.rating));
    if (payload.comment) formData.append('comment', payload.comment);
    if (payload.order_id) formData.append('order_id', String(payload.order_id));

    payload.images.forEach((img, index) => {
      const filename = img.name || img.uri.split('/').pop() || `product_review_${index}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = img.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

      formData.append('images[]', {
        uri: img.uri,
        name: filename,
        type,
      } as unknown as Blob);
    });

    const response = await api.request<Review>('/reviews/product', {
      method: 'POST',
      body: formData,
      isFormData: true,
      token,
    });
    return response.data;
  }

  const response = await api.request<Review>('/reviews/product', {
    method: 'POST',
    body: { ...payload, product_id: productId } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

export async function submitRecipeReview(
  recipeName: string,
  payload: SubmitReviewPayload,
  token: string,
): Promise<Review> {
  const response = await api.request<Review>('/reviews/recipe', {
    method: 'POST',
    body: { ...payload, recipe_name: recipeName } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

export async function updateReview(
  reviewId: number,
  payload: SubmitReviewPayload,
  token: string,
): Promise<Review> {
  const response = await api.request<Review>(`/reviews/${reviewId}`, {
    method: 'PUT',
    body: payload as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

export async function deleteReview(reviewId: number, token: string): Promise<void> {
  await api.request<null>(`/reviews/${reviewId}`, {
    method: 'DELETE',
    token,
  });
}

/* ─── Vendor Reviews Dashboard (vendor role) ─── */

export interface ProductReviewItem extends Review {
  product_id: number;
  product_name: string;
  product_category: string;
}

export interface VendorReviewsDashboardResponse {
  stall: ReviewSummary;
  products: {
    reviews: ProductReviewItem[];
    average_rating: number;
    total: number;
    rating_counts: Record<number, number>;
  };
}

export async function getVendorReviewsDashboard(token: string): Promise<VendorReviewsDashboardResponse> {
  const response = await api.request<VendorReviewsDashboardResponse>('/vendor/reviews', {
    method: 'GET',
    token,
  });
  return response.data;
}
