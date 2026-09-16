/**
 * Customer Reports — purchase history and spending analytics.
 */

import { api } from './api';

export interface ReportSummary {
  total_spent: number;
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  average_order_value: number;
  total_items_purchased: number;
  unique_products: number;
}

export interface ReportOrderItem {
  id: number;
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  vendor_id: number;
  vendor_stall: string | null;
}

export interface ReportOrder {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string | null;
  payment_reference_number: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  notes: string | null;
  items: ReportOrderItem[];
  item_count: number;
  total_units: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  quantity: number;
  total: number;
  orders_count: number;
}

export interface VendorBreakdown {
  vendor_id: number;
  stall_name: string;
  stall_location: string | null;
  orders_count: number;
  items_count: number;
  total: number;
}

export interface CategoryBreakdown {
  category: string;
  quantity: number;
  total: number;
  percent: number;
}

export interface PaymentBreakdown {
  method: string;
  label: string;
  count: number;
  total: number;
  percent: number;
}

export interface StatusBreakdown {
  status: string;
  label: string;
  count: number;
  total: number;
}

export interface DailySpending {
  date: string;
  label: string;
  day: string;
  total: number;
  orders_count: number;
}

export interface CustomerReport {
  summary: ReportSummary;
  date_range: {
    from: string | null;
    to: string | null;
    requested_from: string | null;
    requested_to: string | null;
  };
  orders: ReportOrder[];
  top_products: TopProduct[];
  vendor_breakdown: VendorBreakdown[];
  category_breakdown: CategoryBreakdown[];
  payment_breakdown: PaymentBreakdown[];
  status_breakdown: StatusBreakdown[];
  daily_spending: DailySpending[];
}

export interface CustomerReportParams {
  date_from?: string;
  date_to?: string;
}

function buildQuery(params?: CustomerReportParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function getCustomerReport(
  token: string,
  params?: CustomerReportParams,
): Promise<CustomerReport> {
  const query = buildQuery(params);
  const response = await api.request<CustomerReport>(`/customer/reports${query}`, {
    method: 'GET',
    token,
    timeout: 30000, // reports can be heavier
  });
  return response.data;
}

export function formatPeso(value: number): string {
  return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCompactPeso(value: number): string {
  if (value >= 1000000) return `₱${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₱${(value / 1000).toFixed(1)}k`;
  return `₱${Number(value).toFixed(0)}`;
}

/* Build shareable text report */
export function buildReportShareText(report: CustomerReport): string {
  const { summary, date_range, orders } = report;
  const from = date_range.from ?? 'start';
  const to = date_range.to ?? 'now';
  let text = `🧾 Taguig Suki — Purchase Report\n`;
  text += `Period: ${from} to ${to}\n`;
  text += `Generated: ${new Date().toLocaleString('en-PH')}\n\n`;
  text += `SUMMARY\n`;
  text += `Total Spent: ${formatPeso(summary.total_spent)}\n`;
  text += `Orders: ${summary.total_orders} (Completed: ${summary.completed_orders}, Pending: ${summary.pending_orders}, Cancelled: ${summary.cancelled_orders})\n`;
  text += `Items Purchased: ${summary.total_items_purchased} · Unique Products: ${summary.unique_products}\n`;
  text += `Average Order: ${formatPeso(summary.average_order_value)}\n\n`;

  if (report.vendor_breakdown.length > 0) {
    text += `TOP VENDORS\n`;
    report.vendor_breakdown.slice(0, 5).forEach((v, i) => {
      text += `${i + 1}. ${v.stall_name} — ${formatPeso(v.total)} (${v.orders_count} orders)\n`;
    });
    text += `\n`;
  }

  if (orders.length > 0) {
    text += `ORDERS (${orders.length})\n`;
    orders.slice(0, 20).forEach((o) => {
      const d = new Date(o.created_at).toLocaleDateString('en-PH');
      text += `• ${o.order_number} | ${d} | ${o.status} | ${formatPeso(o.total_amount)}\n`;
      o.items.forEach((it) => {
        text += `   - ${it.product_name} x${it.quantity} ${it.unit} @ ${formatPeso(it.unit_price)} = ${formatPeso(it.subtotal)}\n`;
      });
    });
    if (orders.length > 20) text += `... and ${orders.length - 20} more orders\n`;
  } else {
    text += `No orders in this period.\n`;
  }

  text += `\n— Taguig People's Market · Taguig Suki`;
  return text;
}
