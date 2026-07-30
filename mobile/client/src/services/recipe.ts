/**
 * Recipe Service — AI-powered recipe search.
 * Generates standard Filipino recipes with orderable ingredients.
 * NOT a chatbot — only returns recipe data based on search.
 */

import { api } from './api';

/* ─── Types ─── */

export interface RecipeIngredient {
  name: string;
  quantity: string;
  available_in_market: boolean;
}

export interface MatchingProduct {
  ingredient: string;
  product_id: number;
  product_name: string;
  price: number;
  unit: string;
  category: string;
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
 * Search for a recipe using AI.
 * Returns a standard Metro Manila Filipino recipe with matching market ingredients.
 */
export async function searchRecipe(query: string): Promise<RecipeResult> {
  const response = await api.request<RecipeResult>(
    `/recipes/search?q=${encodeURIComponent(query)}`,
    { method: 'GET' }
  );
  return response.data;
}
