/**
 * Orders service — place orders and fetch customer order history.
 */

import { api } from './api';

/* ─── Types ─── */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'gcash' | 'maya';

export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'rejected';

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
  vendor?: {
    id: number;
    stall_name: string;
    stall_location: string;
    gcash_number?: string | null;
    maya_number?: string | null;
    gcash_qr_path?: string | null;
    maya_qr_path?: string | null;
  };
}

/** One step in the order status timeline (recorded server-side). */
export interface OrderStatusHistory {
  id: number;
  order_id: number;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  payment_method: PaymentMethod | string;
  payment_reference_number?: string | null;
  payment_status?: PaymentStatus;
  payment_submitted_at?: string | null;
  payment_verified_at?: string | null;
  payment_verified_by?: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  status_history?: OrderStatusHistory[];
  user?: { id: number; name: string; email: string };
}

export interface PlaceOrderPayload {
  items: {
    product_id: number;
    product_name: string;
    quantity: number;
  }[];
  payment_method?: 'cash' | 'gcash' | 'maya';
  payment_reference_number?: string;
  notes?: string;
}

export interface PaginatedOrders {
  data: Order[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface VendorPaymentDetail {
  vendor_id: number;
  stall_name: string;
  stall_location?: string;
  gcash_number?: string | null;
  gcash_qr_url?: string | null;
  maya_number?: string | null;
  maya_qr_url?: string | null;
  has_gcash?: boolean;
  has_maya?: boolean;
  // batch variant also returns gcash/maya objects
  gcash?: { number: string | null; qr_url: string | null; has_qr: boolean } | null;
  maya?: { number: string | null; qr_url: string | null; has_qr: boolean } | null;
  has_ewallet?: boolean;
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

/**
 * Real-time order tracking — order + items (with vendor stalls) + status timeline.
 * Poll this endpoint while the tracking screen is open.
 */
export async function getOrderTracking(id: number, token: string): Promise<Order> {
  const response = await api.request<Order>(`/orders/${id}/track`, {
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

/* ─── Payment Verification ─── */

export async function submitPaymentReference(
  orderId: number,
  reference: string,
  token: string,
): Promise<Order> {
  const response = await api.request<Order>(`/orders/${orderId}/payment-reference`, {
    method: 'POST',
    body: { payment_reference_number: reference } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

export async function getVendorsPaymentDetails(
  productIds: number[],
  token: string,
): Promise<VendorPaymentDetail[]> {
  const response = await api.request<VendorPaymentDetail[]>('/orders/payment-details', {
    method: 'POST',
    body: { product_ids: productIds } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

export async function getVendorPaymentDetailsByVendorId(
  vendorId: number,
  token?: string,
): Promise<VendorPaymentDetail> {
  const response = await api.request<VendorPaymentDetail>(`/vendors/${vendorId}/payment-details`, {
    method: 'GET',
    token,
  });
  return response.data;
}

export async function getVendorPendingPayments(token: string): Promise<Order[]> {
  const response = await api.request<Order[]>('/vendor/payments/pending', {
    method: 'GET',
    token,
  });
  return response.data;
}

export async function verifyPayment(
  orderId: number,
  action: 'verify' | 'reject',
  token: string,
): Promise<Order> {
  const response = await api.request<Order>(`/vendor/orders/${orderId}/verify-payment`, {
    method: 'PATCH',
    body: { action } as unknown as Record<string, unknown>,
    token,
  });
  return response.data;
}

/* Batch vendor payment details (public, no auth required for vendor QR display) */
export async function getBatchVendorPaymentDetails(
  vendorIds: number[],
  token?: string,
): Promise<VendorPaymentDetail[]> {
  const response = await api.request<VendorPaymentDetail[]>('/vendors/payment-details/batch', {
    method: 'POST',
    body: { vendor_ids: vendorIds } as unknown as Record<string, unknown>,
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
  ready:      { label: 'Ready',      color: '#059669', bg: '#ECFDF5', icon: 'bag-check-outline' },
  completed:  { label: 'Completed',  color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-done-outline' },
  cancelled:  { label: 'Cancelled',  color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

export const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  unpaid:              { label: 'Unpaid',              color: '#6B7280', bg: '#F3F4F6', icon: 'cash-outline' },
  pending_verification:{ label: 'Pending Verification',color: '#D97706', bg: '#FEF3C7', icon: 'hourglass-outline' },
  paid:                { label: 'Paid',                color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-done-outline' },
  rejected:            { label: 'Rejected',            color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

export const PAYMENT_METHOD_CONFIG: Record<
  PaymentMethod,
  { label: string; color: string; bg: string; icon: string }
> = {
  cash:  { label: 'Cash on Pickup', labelShort: 'Cash', color: '#16A34A', bg: '#DCFCE7', icon: 'cash-outline' } as any,
  gcash: { label: 'GCash', labelShort: 'GCash', color: '#2563EB', bg: '#EFF6FF', icon: 'phone-portrait-outline' } as any,
  maya:  { label: 'Maya', labelShort: 'Maya', color: '#7C3AED', bg: '#F5F3FF', icon: 'wallet-outline' } as any,
};
