/**
 * Sales & Revenue Service — vendor sales history, revenue analytics, and completed transactions.
 */

import { api } from './api';
import { type Order, type OrderItem } from './orders';

/* ─── Interfaces ─── */

export interface SalesSummary {
  total_revenue: number;
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  completed_orders_count: number;
  total_units_sold: number;
  average_order_value: number;
}

export interface SalesChartPoint {
  date: string;
  label: string;
  full_label: string;
  revenue: number;
  orders_count: number;
}

export interface TopProductSale {
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  quantity_sold: number;
  revenue: number;
}

export interface CategoryBreakdown {
  category: string;
  revenue: number;
  quantity: number;
  percentage: number;
}

export interface PaymentMethodBreakdown {
  payment_method: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface CompletedTransaction {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  payment_method: string;
  total_amount: number;
  vendor_subtotal: number;
  total_units: number;
  notes: string | null;
  created_at: string;
  completed_at: string;
  items: OrderItem[];
}

export interface VendorSalesAnalyticsResponse {
  summary: SalesSummary;
  chart_data: SalesChartPoint[];
  top_products: TopProductSale[];
  category_breakdown: CategoryBreakdown[];
  payment_methods: PaymentMethodBreakdown[];
  completed_transactions: CompletedTransaction[];
}

/* ─── API Methods ─── */

/**
 * Fetch vendor sales analytics and completed transactions from API.
 */
export async function getVendorSalesAnalytics(
  token: string,
  period = 'all',
): Promise<VendorSalesAnalyticsResponse> {
  const response = await api.request<VendorSalesAnalyticsResponse>(
    `/vendor/sales?period=${period}`,
    {
      method: 'GET',
      token,
    },
  );
  return response.data;
}

/**
 * Client-side computation fallback in case of offline or local state caching.
 */
export function computeSalesFromOrders(
  orders: Order[],
  vendorId?: number,
): VendorSalesAnalyticsResponse {
  const completedOrders = orders.filter((o) => o.status === 'completed');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalRevenue = 0;
  let todayRevenue = 0;
  let weekRevenue = 0;
  let monthRevenue = 0;
  let totalUnits = 0;

  const topProductsMap = new Map<number | string, TopProductSale>();
  const categoryMap = new Map<string, { revenue: number; quantity: number }>();
  const paymentMap = new Map<string, { count: number; revenue: number }>();

  const completedTransactions: CompletedTransaction[] = [];

  for (const order of completedOrders) {
    const relevantItems = vendorId
      ? order.items.filter((it) => it.vendor_id === vendorId)
      : order.items;

    const vendorSubtotal = round2(
      relevantItems.reduce((acc, it) => acc + Number(it.subtotal || it.quantity * it.unit_price || 0), 0),
    );
    const orderUnits = relevantItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0);

    totalRevenue += vendorSubtotal;
    totalUnits += orderUnits;

    const orderDate = new Date(order.updated_at || order.created_at);
    if (orderDate >= startOfToday) todayRevenue += vendorSubtotal;
    if (orderDate >= startOfWeek) weekRevenue += vendorSubtotal;
    if (orderDate >= startOfMonth) monthRevenue += vendorSubtotal;

    // Payment method
    const pm = (order.payment_method || 'cash').toLowerCase();
    const currentPm = paymentMap.get(pm) || { count: 0, revenue: 0 };
    paymentMap.set(pm, {
      count: currentPm.count + 1,
      revenue: round2(currentPm.revenue + vendorSubtotal),
    });

    // Items
    for (const item of relevantItems) {
      const pid = item.product_id || item.product_name;
      const sub = Number(item.subtotal || item.quantity * item.unit_price || 0);
      const qty = Number(item.quantity || 0);

      const existingProd = topProductsMap.get(pid) || {
        product_id: item.product_id,
        product_name: item.product_name,
        category: item.category || 'General',
        unit: item.unit || 'unit',
        quantity_sold: 0,
        revenue: 0,
      };

      existingProd.quantity_sold += qty;
      existingProd.revenue = round2(existingProd.revenue + sub);
      topProductsMap.set(pid, existingProd);

      // Category
      const cat = (item.category || 'Other').trim();
      const capCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
      const existingCat = categoryMap.get(capCat) || { revenue: 0, quantity: 0 };
      categoryMap.set(capCat, {
        revenue: round2(existingCat.revenue + sub),
        quantity: existingCat.quantity + qty,
      });
    }

    completedTransactions.push({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.user?.name || 'Customer',
      customer_email: order.user?.email || '',
      payment_method: order.payment_method || 'cash',
      total_amount: Number(order.total_amount || 0),
      vendor_subtotal: vendorSubtotal,
      total_units: orderUnits,
      notes: order.notes,
      created_at: order.created_at,
      completed_at: order.updated_at || order.created_at,
      items: relevantItems,
    });
  }

  const completedCount = completedOrders.length;
  totalRevenue = round2(totalRevenue);
  todayRevenue = round2(todayRevenue);
  weekRevenue = round2(weekRevenue);
  monthRevenue = round2(monthRevenue);
  const avgOrderValue = completedCount > 0 ? round2(totalRevenue / completedCount) : 0;

  // Chart data for last 7 days
  const chartData: SalesChartPoint[] = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);

    const matching = completedTransactions.filter((tx) => {
      const txDate = new Date(tx.completed_at || tx.created_at);
      return txDate >= d && txDate <= dEnd;
    });

    const dayRevenue = round2(matching.reduce((sum, tx) => sum + tx.vendor_subtotal, 0));

    chartData.push({
      date: d.toISOString().split('T')[0],
      label: days[d.getDay()],
      full_label: `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`,
      revenue: dayRevenue,
      orders_count: matching.length,
    });
  }

  // Top products
  const topProducts = Array.from(topProductsMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Category breakdown
  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([cat, val]) => ({
      category: cat,
      revenue: val.revenue,
      quantity: val.quantity,
      percentage: totalRevenue > 0 ? round2((val.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Payment methods
  const paymentMethods: PaymentMethodBreakdown[] = ['cash', 'gcash', 'maya'].map((pm) => {
    const val = paymentMap.get(pm) || { count: 0, revenue: 0 };
    return {
      payment_method: pm,
      count: val.count,
      revenue: val.revenue,
      percentage: totalRevenue > 0 ? round2((val.revenue / totalRevenue) * 100) : 0,
    };
  });

  return {
    summary: {
      total_revenue: totalRevenue,
      today_revenue: todayRevenue,
      week_revenue: weekRevenue,
      month_revenue: monthRevenue,
      completed_orders_count: completedCount,
      total_units_sold: totalUnits,
      average_order_value: avgOrderValue,
    },
    chart_data: chartData,
    top_products: topProducts,
    category_breakdown: categoryBreakdown,
    payment_methods: paymentMethods,
    completed_transactions: completedTransactions,
  };
}

/* ─── Helpers ─── */

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatPeso(amount: number): string {
  const fixed = amount.toFixed(2);
  const [whole, decimals] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱${grouped}.${decimals}`;
}

export function formatCompactPeso(amount: number): string {
  if (amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 10_000) {
    return `₱${(amount / 1_000).toFixed(1)}k`;
  }
  return formatPeso(amount);
}
