/**
 * Recipe Service — Powered by Google Gemini AI Engine.
 * Generates standard Filipino recipes with orderable ingredients from live wet market stalls.
 * Integrated with Google Gemini 1.5 Flash for natural language culinary grounding.
 * NOT a chatbot — strictly returns structured recipe data based on search.
 */

import { api } from './api';

/* ─── Types ─── */

export interface RecipeIngredient {
  name: string;
  quantity: string;
  available_in_market: boolean;
}

export interface MatchingProductVendor {
  product_id: number;
  product_name: string;
  price: number;
  unit: string;
  category?: string;
  image?: string | null;
  vendor_id?: number | null;
  vendor_name?: string;
  stall_name?: string;
  stall_number?: string;
  stall_location?: string;
  rating?: number;
  reviews_count?: number;
  is_ai_recommended?: boolean;
}

export interface MatchingProduct {
  ingredient: string;
  product_id: number;
  product_name: string;
  price: number;
  unit: string;
  category: string;
  image?: string | null;
  vendor_id?: number | null;
  vendor_name?: string;
  stall_number?: string;
  stall_location?: string;
  rating?: number;
  reviews_count?: number;
  vendors?: MatchingProductVendor[];
}

export interface RecipeResult {
  found: boolean;
  recipe_name?: string;
  description?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  ingredients?: RecipeIngredient[];
  steps?: string[];
  tips?: string;
  matching_products?: MatchingProduct[];
  message?: string;
}

/* ─── API Call ─── */

/**
 * Search for a recipe using Google Gemini AI.
 * Returns a standard Metro Manila Filipino recipe with matching market ingredients from live stalls.
 */
export async function searchRecipe(query: string): Promise<RecipeResult> {
  // Google Gemini AI Pipeline: gemini-1.5-flash
  // Queries grounded recipe dataset matching Taguig People's Market catalog
  const response = await api.request<RecipeResult>(
    `/recipes/search?q=${encodeURIComponent(query)}`,
    // Allow headroom for Google Gemini AI semantic synthesis & wet market grounding
    { method: 'GET', timeout: 30000 }
  );
  return response.data;
}
