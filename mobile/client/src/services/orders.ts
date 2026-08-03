/**
 * Orders service — place orders and fetch customer order history.
 */

import { api } from './api';

/* ─── Types ─── */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface OrderItem {
  id: number;
  product_id: number;
  vendor_id: number;
  product_name: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  user?: { id: number; name: string; email: string };
}

export interface PlaceOrderPayload {
  items: {
    product_id: number;
    product_name: string;
    quantity: number;
  }[];
  payment_method?: 'cash' | 'gcash' | 'maya';
  notes?: string;
}

export interface PaginatedOrders {
  data: Order[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/* ─── API Calls ─── */

export async function placeOrder(payload: PlaceOrderPayload, token: string): Promise<Order> {
  const response = await api.request<Order>('/orders', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

export async function getOrders(token: string, page = 1): Promise<PaginatedOrders> {
  const response = await api.request<PaginatedOrders>(`/orders?page=${page}`, {
    method: 'GET',
    token,
  });
  return response.data;
}

export async function getOrder(id: number, token: string): Promise<Order> {
  const response = await api.request<Order>(`/orders/${id}`, {
    method: 'GET',
    token,
  });
  return response.data;
}

export async function getVendorOrders(token: string): Promise<Order[]> {
  const response = await api.request<Order[]>('/vendor/orders', {
    method: 'GET',
    token,
  });
  return response.data;
}

export async function updateOrderStatus(
  id: number,
  status: OrderStatus,
  token: string,
): Promise<Order> {
  const response = await api.request<Order>(`/vendor/orders/${id}/status`, {
    method: 'PATCH',
    body: { status } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

/* ─── Helpers ─── */

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending:    { label: 'Pending',    color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  confirmed:  { label: 'Confirmed',  color: '#2563EB', bg: '#EFF6FF', icon: 'checkmark-circle-outline' },
  processing: { label: 'Processing', color: '#7C3AED', bg: '#F5F3FF', icon: 'refresh-outline' },
  ready:      { label: 'Ready',      color: '#059669', bg: '#ECFDF5', icon: 'bag-check-outline' },
  completed:  { label: 'Completed',  color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-done-outline' },
  cancelled:  { label: 'Cancelled',  color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
};
