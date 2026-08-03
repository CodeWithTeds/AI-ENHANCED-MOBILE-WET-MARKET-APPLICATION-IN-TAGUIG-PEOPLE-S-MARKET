/**
 * CartContext — customer cart with AsyncStorage persistence.
 * Cart survives app restarts and is cleared on logout or after a successful order.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_STORAGE_KEY = '@taguigsuki_cart';

export interface CartItem {
  product_id: number;
  product_name: string;
  price: number;
  unit: string;
  category: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  isLoading: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: number) => boolean;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* Restore cart from AsyncStorage on mount */
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setItems(JSON.parse(raw));
          } catch {
            // corrupted data — start fresh
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  /* Persist to AsyncStorage whenever items change (skip during initial load) */
  function persist(next: CartItem[]) {
    setItems(next);
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function addItem(product: Omit<CartItem, 'quantity'>, quantity = 1) {
    const next = [...items];
    const idx = next.findIndex((i) => i.product_id === product.product_id);
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
    } else {
      next.push({ ...product, quantity });
    }
    persist(next);
  }

  function removeItem(productId: number) {
    persist(items.filter((i) => i.product_id !== productId));
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    persist(items.map((i) => (i.product_id === productId ? { ...i, quantity } : i)));
  }

  function clearCart() {
    setItems([]);
    AsyncStorage.removeItem(CART_STORAGE_KEY);
  }

  function isInCart(productId: number) {
    return items.some((i) => i.product_id === productId);
  }

  return (
    <CartContext.Provider
      value={{ items, totalItems, totalPrice, isLoading, addItem, removeItem, updateQuantity, clearCart, isInCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
