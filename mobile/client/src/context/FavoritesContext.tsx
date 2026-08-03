/**
 * FavoritesContext — persists customer's favorite recipes and products.
 * Stored in AsyncStorage so favorites survive app restarts.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecipeResult } from '@/services/recipe';
import type { MarketProduct } from '@/services/marketplace';

/* ─── Types ─── */

export interface FavoriteRecipe {
  id: string;               // recipe_name as slug
  recipe_name: string;
  description: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  ingredients: RecipeResult['ingredients'];
  steps: RecipeResult['steps'];
  tips?: string;
  matching_products: RecipeResult['matching_products'];
  saved_at: string;         // ISO timestamp
}

export interface FavoriteProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  stall_name?: string;
  image?: string | null;
  saved_at: string;
}

interface FavoritesState {
  recipes: FavoriteRecipe[];
  products: FavoriteProduct[];
}

interface FavoritesContextValue extends FavoritesState {
  addRecipe: (recipe: RecipeResult) => void;
  removeRecipe: (id: string) => void;
  isRecipeFavorited: (recipeName: string) => boolean;
  addProduct: (product: MarketProduct) => void;
  removeProduct: (id: number) => void;
  isProductFavorited: (id: number) => boolean;
  totalFavorites: number;
}

/* ─── Storage Keys ─── */

const STORAGE_KEY = '@taguigsuki_favorites';

/* ─── Context ─── */

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FavoritesState>({ recipes: [], products: [] });

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setState(JSON.parse(raw));
        } catch {
          // corrupted — ignore
        }
      }
    });
  }, []);

  // Persist whenever state changes
  function persist(next: FavoritesState) {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addRecipe(recipe: RecipeResult) {
    if (!recipe.found || !recipe.recipe_name) return;

    const id = recipe.recipe_name.toLowerCase().replace(/\s+/g, '-');
    if (state.recipes.find((r) => r.id === id)) return;

    const favorite: FavoriteRecipe = {
      id,
      recipe_name: recipe.recipe_name,
      description: recipe.description ?? '',
      servings: recipe.servings ?? '',
      prep_time: recipe.prep_time ?? '',
      cook_time: recipe.cook_time ?? '',
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tips: recipe.tips,
      matching_products: recipe.matching_products,
      saved_at: new Date().toISOString(),
    };

    persist({ ...state, recipes: [favorite, ...state.recipes] });
  }

  function removeRecipe(id: string) {
    persist({ ...state, recipes: state.recipes.filter((r) => r.id !== id) });
  }

  function isRecipeFavorited(recipeName: string) {
    const id = recipeName.toLowerCase().replace(/\s+/g, '-');
    return state.recipes.some((r) => r.id === id);
  }

  function addProduct(product: MarketProduct) {
    if (state.products.find((p) => p.id === product.id)) return;

    const favorite: FavoriteProduct = {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      unit: product.unit,
      stall_name: product.vendor?.stall_name,
      image: product.image,
      saved_at: new Date().toISOString(),
    };

    persist({ ...state, products: [favorite, ...state.products] });
  }

  function removeProduct(id: number) {
    persist({ ...state, products: state.products.filter((p) => p.id !== id) });
  }

  function isProductFavorited(id: number) {
    return state.products.some((p) => p.id === id);
  }

  const totalFavorites = state.recipes.length + state.products.length;

  return (
    <FavoritesContext.Provider
      value={{
        ...state,
        addRecipe,
        removeRecipe,
        isRecipeFavorited,
        addProduct,
        removeProduct,
        isProductFavorited,
        totalFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
