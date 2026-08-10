/**
 * Reviews service — customers rate vendors, products, and recipes.
 * Vendor/product reviews are gated on COMPLETED orders (server-enforced).
 */

import { api } from './api';

/* ─── Types ─── */

export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  user: string;
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

export interface SubmitReviewPayload {
  rating: number;
  comment?: string;
  order_id?: number;
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
