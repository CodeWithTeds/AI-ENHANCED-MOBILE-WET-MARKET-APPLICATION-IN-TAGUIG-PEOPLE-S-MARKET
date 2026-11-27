/**
 * Recipe Service — Pinapagana ng Google Gemini AI Engine.
 * Bumubuo ng tradisyunal na lutuing Pilipino na may mga sangkap na mabibili sa mga puwesto sa palengke.
 * Nakakabit sa Google Gemini 1.5 Flash para sa natural language processing at ingredient matching.
 * Hindi chatbot — direktang nagbabalik ng recipe data at mga stall kung saan mabibili ang sangkap.
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
  is_available?: boolean;
  is_out_of_stock?: boolean;
  stock_quantity?: number | null;
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
  is_available?: boolean;
  is_out_of_stock?: boolean;
  stock_quantity?: number | null;
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
 * Maghanap ng recipe gamit ang Google Gemini AI.
 * Nagbabalik ng standard Metro Manila Filipino recipe na may katugmang paninda sa Taguig wet market.
 */
export async function searchRecipe(query: string): Promise<RecipeResult> {
  // Google Gemini AI Pipeline: gemini-1.5-flash
  // Ipinapadala ang query sa backend para itugma ng Gemini sa imbentaryo ng palengke
  const response = await api.request<RecipeResult>(
    `/recipes/search?q=${encodeURIComponent(query)}`,
    // Maglaan ng sapat na oras (timeout) para sa pagsusuri at grounding ng Google Gemini AI
    { method: 'GET', timeout: 30000 }
  );
  return response.data;
}
