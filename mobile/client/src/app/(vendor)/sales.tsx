/**
 * Vendor Sales & Revenue Screen — sales history, revenue analytics, and completed transactions.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/services/auth';
import { getVendorOrders } from '@/services/orders';
import {
  computeSalesFromOrders,
  formatCompactPeso,
  formatPeso,
  getVendorSalesAnalytics,
  type CategoryBreakdown,
  type CompletedTransaction,
  type PaymentMethodBreakdown,
  type SalesChartPoint,
  type TopProductSale,
  type VendorSalesAnalyticsResponse,
} from '@/services/sales';

const SCREEN_WIDTH = Dimensions.get('window').width;

/* ─── Color Palette ─── */
const C = {
  bg: '#F4F7F5',
  card: '#FFFFFF',
  ink: '#0F1E17',
  sub: '#586A61',
  muted: '#94A39A',
  line: '#E7ECE9',
  brand: '#10B981',
  brandDark: '#0B8F60',
  brandDeep: '#065F46',
  brandSoft: '#E7F7EF',
  brandAccent: '#16A34A',
  orange: '#F97316',
  orangeSoft: '#FFF4EB',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  purple: '#8B5CF6',
  purpleSoft: '#F5F3FF',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  header: '#0E8F5B',
};

type Period = 'all' | 'month' | 'week' | 'today';
type SortOption = 'newest' | 'oldest' | 'highest';
type PaymentFilter = 'all' | 'cash' | 'gcash' | 'maya';

export default function VendorSalesScreen() {
  const router = useRouter();
  const { vendor, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<VendorSalesAnalyticsResponse | null>(null);

  // Filters & Controls
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);

  const loadData = useCallback(
    async (_isRefresh = false) => {
      const authToken = token ?? (await getToken());
      if (!authToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        // Try backend sales analytics endpoint
        const salesRes = await getVendorSalesAnalytics(authToken, selectedPeriod);
        setData(salesRes);
      } catch {
        // Fallback: fetch orders and calculate client-side
        try {
          const orders = await getVendorOrders(authToken);
          const computed = computeSalesFromOrders(orders, vendor?.id);
          setData(computed);
        } catch {
          // ignore
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, selectedPeriod, vendor?.id],
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const summary = data?.summary ?? {
    total_revenue: 0,
    today_revenue: 0,
    week_revenue: 0,
    month_revenue: 0,
    completed_orders_count: 0,
    total_units_sold: 0,
    average_order_value: 0,
  };

  const chartData = data?.chart_data ?? [];
  const topProducts = data?.top_products ?? [];
  const categoryBreakdown = data?.category_breakdown ?? [];
  const paymentMethods = data?.payment_methods ?? [];
  const allTransactions = data?.completed_transactions ?? [];

  // Filtered & Sorted completed transactions
  const filteredTransactions = useMemo(() => {
    let list = [...allTransactions];

    // Filter by period
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (selectedPeriod === 'today') {
      list = list.filter((tx) => new Date(tx.completed_at || tx.created_at) >= startOfToday);
    } else if (selectedPeriod === 'week') {
      list = list.filter((tx) => new Date(tx.completed_at || tx.created_at) >= startOfWeek);
    } else if (selectedPeriod === 'month') {
      list = list.filter((tx) => new Date(tx.completed_at || tx.created_at) >= startOfMonth);
    }

    // Filter by payment
    if (selectedPayment !== 'all') {
      list = list.filter((tx) => (tx.payment_method || '').toLowerCase() === selectedPayment);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((tx) => {
        const orderMatch = tx.order_number.toLowerCase().includes(q);
        const nameMatch = tx.customer_name.toLowerCase().includes(q);
        const itemMatch = tx.items.some((it) => it.product_name.toLowerCase().includes(q));
        return orderMatch || nameMatch || itemMatch;
      });
    }

    // Sort
    if (sortBy === 'newest') {
      list.sort(
        (a, b) =>
          new Date(b.completed_at || b.created_at).getTime() -
          new Date(a.completed_at || a.created_at).getTime(),
      );
    } else if (sortBy === 'oldest') {
      list.sort(
        (a, b) =>
          new Date(a.completed_at || a.created_at).getTime() -
          new Date(b.completed_at || b.created_at).getTime(),
      );
    } else if (sortBy === 'highest') {
      list.sort((a, b) => b.vendor_subtotal - a.vendor_subtotal);
    }

    return list;
  }, [allTransactions, selectedPeriod, selectedPayment, searchQuery, sortBy]);

  // Derived filtered summary
  const filteredRevenue = useMemo(() => {
    if (selectedPeriod === 'all') return summary.total_revenue;
    if (selectedPeriod === 'month') return summary.month_revenue;
    if (selectedPeriod === 'week') return summary.week_revenue;
    if (selectedPeriod === 'today') return summary.today_revenue;
    return summary.total_revenue;
  }, [selectedPeriod, summary]);

  // Max revenue for chart bar normalization
  const maxChartRevenue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.revenue), 100);
    return max;
  }, [chartData]);

  const activeChartPoint =
    selectedChartIndex !== null ? chartData[selectedChartIndex] : chartData[chartData.length - 1];

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.headerNav}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sales & Revenue</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={styles.loadingText}>Gathering your sales data…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ─── Header ─── */}
      <View style={styles.headerWrap}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <View style={styles.headerNav}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerEyebrow}>Performance & Analytics</Text>
                <Text style={styles.headerTitle}>Sales & Revenue</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setRefreshing(true);
                  loadData(true);
                }}
                style={styles.refreshBtn}
                accessibilityLabel="Refresh sales data"
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            tintColor={C.brand}
          />
        }
      >
        {/* ─── Period Selector Chips ─── */}
        <View style={styles.periodRow}>
          {(
            [
              { key: 'all', label: 'All Time' },
              { key: 'month', label: 'This Month' },
              { key: 'week', label: 'This Week' },
              { key: 'today', label: 'Today' },
            ] as { key: Period; label: string }[]
          ).map((item) => {
            const active = selectedPeriod === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => setSelectedPeriod(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Hero Revenue Card ─── */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroPeriodLabel}>
                {selectedPeriod === 'all'
                  ? 'Total Lifetime Earnings'
                  : selectedPeriod === 'month'
                  ? 'Earnings this Month'
                  : selectedPeriod === 'week'
                  ? 'Earnings this Week'
                  : "Today's Total Sales"}
              </Text>
              <Text style={styles.heroAmount}>{formatPeso(filteredRevenue)}</Text>
            </View>
            <View style={styles.heroIconBadge}>
              <MaterialCommunityIcons name="finance" size={28} color={C.brand} />
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsGrid}>
            <View style={styles.heroStatItem}>
              <Ionicons name="checkmark-done-circle" size={16} color={C.brand} />
              <Text style={styles.heroStatValue}>{filteredTransactions.length}</Text>
              <Text style={styles.heroStatLabel}>Completed</Text>
            </View>
            <View style={styles.heroStatItem}>
              <Ionicons name="cart-outline" size={16} color={C.blue} />
              <Text style={styles.heroStatValue}>
                {formatPeso(
                  filteredTransactions.length > 0
                    ? filteredRevenue / filteredTransactions.length
                    : 0,
                )}
              </Text>
              <Text style={styles.heroStatLabel}>Avg / Order</Text>
            </View>
            <View style={styles.heroStatItem}>
              <Ionicons name="cube-outline" size={16} color={C.orange} />
              <Text style={styles.heroStatValue}>
                {filteredTransactions.reduce((sum, tx) => sum + tx.total_units, 0)}
              </Text>
              <Text style={styles.heroStatLabel}>Units Sold</Text>
            </View>
          </View>
        </View>

        {/* ─── Secondary KPI Cards ─── */}
        <View style={styles.kpiGrid}>
          <KpiCard
            icon="today-outline"
            label="Today's Sales"
            amount={formatPeso(summary.today_revenue)}
            color={C.brand}
            bg={C.brandSoft}
          />
          <KpiCard
            icon="calendar-outline"
            label="This Week"
            amount={formatPeso(summary.week_revenue)}
            color={C.blue}
            bg={C.blueSoft}
          />
          <KpiCard
            icon="stats-chart-outline"
            label="This Month"
            amount={formatPeso(summary.month_revenue)}
            color={C.purple}
            bg={C.purpleSoft}
          />
          <KpiCard
            icon="cash-outline"
            label="All-Time AOV"
            amount={formatPeso(summary.average_order_value)}
            color={C.amber}
            bg={C.amberSoft}
          />
        </View>

        {/* ─── 7-Day Revenue Trend Chart ─── */}
        {chartData.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: C.brandSoft }]}>
                  <Ionicons name="trending-up" size={16} color={C.brand} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>7-Day Sales Trend</Text>
                  <Text style={styles.cardSubtitle}>Daily completed transaction revenue</Text>
                </View>
              </View>
            </View>

            {/* Active Day Detail Callout */}
            {activeChartPoint && (
              <View style={styles.chartActiveBox}>
                <Text style={styles.chartActiveLabel}>{activeChartPoint.full_label}</Text>
                <Text style={styles.chartActiveAmount}>{formatPeso(activeChartPoint.revenue)}</Text>
                <Text style={styles.chartActiveMeta}>
                  {activeChartPoint.orders_count} completed order
                  {activeChartPoint.orders_count !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Bar Chart Visual */}
            <View style={styles.chartBarsWrap}>
              {chartData.map((point, index) => {
                const heightPercent =
                  maxChartRevenue > 0 ? Math.max(8, (point.revenue / maxChartRevenue) * 100) : 8;
                const isSelected =
                  selectedChartIndex === index ||
                  (selectedChartIndex === null && index === chartData.length - 1);

                return (
                  <TouchableOpacity
                    key={point.date}
                    style={styles.chartBarCol}
                    onPress={() => setSelectedChartIndex(index)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.chartBarValueTop}>
                      {point.revenue > 0 ? formatCompactPeso(point.revenue) : ''}
                    </Text>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBarFill,
                          { height: `${heightPercent}%` },
                          isSelected ? styles.chartBarFillActive : styles.chartBarFillInactive,
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartBarLabel, isSelected && styles.chartBarLabelActive]}>
                      {point.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Top Selling Products ─── */}
        {topProducts.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: C.orangeSoft }]}>
                  <Ionicons name="flame" size={16} color={C.orange} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Top Selling Products</Text>
                  <Text style={styles.cardSubtitle}>Best performers by revenue</Text>
                </View>
              </View>
            </View>

            <View style={styles.topProductsList}>
              {topProducts.map((prod, index) => {
                const rankEmoji =
                  index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

                return (
                  <View key={`${prod.product_id}-${index}`} style={styles.productRow}>
                    <View style={styles.productRankWrap}>
                      <Text style={styles.productRankText}>{rankEmoji}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {prod.product_name}
                      </Text>
                      <Text style={styles.productMeta}>
                        {prod.quantity_sold} {prod.unit} sold · {prod.category}
                      </Text>
                    </View>
                    <View style={styles.productRight}>
                      <Text style={styles.productRevenue}>{formatPeso(prod.revenue)}</Text>
                      <Text style={styles.productRevenueLabel}>revenue</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Category & Payment Distribution ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: C.blueSoft }]}>
                <Ionicons name="pie-chart-outline" size={16} color={C.blue} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Sales Distribution</Text>
                <Text style={styles.cardSubtitle}>By Category & Payment Method</Text>
              </View>
            </View>
          </View>

          {/* Categories */}
          <Text style={styles.distribSectionTitle}>Product Categories</Text>
          {categoryBreakdown.length === 0 ? (
            <Text style={styles.emptySmallText}>No category sales recorded yet.</Text>
          ) : (
            categoryBreakdown.map((cat, idx) => (
              <View key={cat.category} style={styles.categoryRow}>
                <View style={styles.categoryInfoRow}>
                  <Text style={styles.categoryName}>{cat.category}</Text>
                  <Text style={styles.categoryAmount}>
                    {formatPeso(cat.revenue)} ({cat.percentage}%)
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, Math.max(4, cat.percentage))}%`,
                        backgroundColor: getCategoryColor(idx),
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}

          <View style={styles.divider} />

          {/* Payment Methods */}
          <Text style={styles.distribSectionTitle}>Payment Methods</Text>
          <View style={styles.paymentsRow}>
            {paymentMethods.map((pm) => {
              const label = pm.payment_method.toUpperCase();
              const icon =
                pm.payment_method === 'gcash'
                  ? 'phone-portrait-outline'
                  : pm.payment_method === 'maya'
                  ? 'wallet-outline'
                  : 'cash-outline';
              const color =
                pm.payment_method === 'gcash'
                  ? C.blue
                  : pm.payment_method === 'maya'
                  ? '#00D632'
                  : C.brand;

              return (
                <View key={pm.payment_method} style={styles.paymentCard}>
                  <Ionicons name={icon as any} size={18} color={color} />
                  <Text style={styles.paymentMethodName}>{label}</Text>
                  <Text style={styles.paymentMethodAmount}>{formatPeso(pm.revenue)}</Text>
                  <Text style={styles.paymentMethodCount}>
                    {pm.count} order{pm.count !== 1 ? 's' : ''} ({pm.percentage}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── Completed Transactions / Sales History Feed ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: C.brandSoft }]}>
                <Ionicons name="receipt-outline" size={16} color={C.brand} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Completed Transactions</Text>
                <Text style={styles.cardSubtitle}>
                  {filteredTransactions.length} recorded transaction
                  {filteredTransactions.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={C.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by order #, customer, product..."
              placeholderTextColor={C.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Payment & Sort Filters */}
          <View style={styles.filterControlsRow}>
            {/* Payment filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
              {(
                [
                  { key: 'all', label: 'All Payments' },
                  { key: 'cash', label: 'Cash' },
                  { key: 'gcash', label: 'GCash' },
                  { key: 'maya', label: 'Maya' },
                ] as { key: PaymentFilter; label: string }[]
              ).map((pm) => {
                const active = selectedPayment === pm.key;
                return (
                  <TouchableOpacity
                    key={pm.key}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setSelectedPayment(pm.key)}
                  >
                    <Text
                      style={[styles.filterPillText, active && styles.filterPillTextActive]}
                    >
                      {pm.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sort toggle */}
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                if (sortBy === 'newest') setSortBy('highest');
                else if (sortBy === 'highest') setSortBy('oldest');
                else setSortBy('newest');
              }}
            >
              <Feather name="bar-chart-2" size={12} color={C.sub} />
              <Text style={styles.sortButtonText}>
                {sortBy === 'newest' ? 'Newest' : sortBy === 'highest' ? 'Highest ₱' : 'Oldest'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={32} color={C.muted} />
              </View>
              <Text style={styles.emptyTitle}>No transactions found</Text>
              <Text style={styles.emptySub}>
                {searchQuery || selectedPayment !== 'all'
                  ? 'Try clearing your search or filters to view records.'
                  : 'Completed customer sales will appear here.'}
              </Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => {
              const isExpanded = expandedTxId === tx.id;
              const dateStr = new Date(tx.completed_at || tx.created_at).toLocaleDateString(
                'en-PH',
                {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                },
              );
              const timeStr = new Date(tx.completed_at || tx.created_at).toLocaleTimeString(
                'en-PH',
                {
                  hour: '2-digit',
                  minute: '2-digit',
                },
              );

              return (
                <View key={tx.id} style={styles.txCard}>
                  <TouchableOpacity
                    style={styles.txCardHeader}
                    onPress={() => setExpandedTxId(isExpanded ? null : tx.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.txAvatar}>
                      <Text style={styles.txAvatarText}>
                        {tx.customer_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.txInfo}>
                      <View style={styles.txTitleRow}>
                        <Text style={styles.txCustomerName} numberOfLines={1}>
                          {tx.customer_name}
                        </Text>
                        <View style={styles.txPaymentBadge}>
                          <Text style={styles.txPaymentBadgeText}>
                            {tx.payment_method.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.txMeta}>
                        {tx.order_number} · {dateStr} at {timeStr}
                      </Text>
                      <Text style={styles.txItemsSummary} numberOfLines={1}>
                        {tx.items.map((it) => `${it.quantity}x ${it.product_name}`).join(', ')}
                      </Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={styles.txAmount}>{formatPeso(tx.vendor_subtotal)}</Text>
                      <View style={styles.txCompletedBadge}>
                        <Ionicons name="checkmark-done" size={10} color={C.brandDark} />
                        <Text style={styles.txCompletedBadgeText}>Paid</Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={C.muted}
                        style={{ marginTop: 2 }}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Receipt Breakdown */}
                  {isExpanded && (
                    <View style={styles.txExpanded}>
                      <View style={styles.txDivider} />

                      <Text style={styles.receiptTitle}>ITEMIZED BREAKDOWN</Text>

                      {tx.items.map((item) => (
                        <View key={item.id} style={styles.receiptItemRow}>
                          <View style={styles.receiptItemLeft}>
                            <Text style={styles.receiptItemName}>{item.product_name}</Text>
                            <Text style={styles.receiptItemUnit}>
                              {item.quantity} {item.unit} × {formatPeso(item.unit_price)}
                            </Text>
                          </View>
                          <Text style={styles.receiptItemSubtotal}>
                            {formatPeso(item.subtotal)}
                          </Text>
                        </View>
                      ))}

                      <View style={styles.receiptTotalRow}>
                        <Text style={styles.receiptTotalLabel}>Vendor Payout Total</Text>
                        <Text style={styles.receiptTotalAmount}>
                          {formatPeso(tx.vendor_subtotal)}
                        </Text>
                      </View>

                      {tx.notes ? (
                        <View style={styles.txNotesBox}>
                          <Text style={styles.txNotesLabel}>Order Note:</Text>
                          <Text style={styles.txNotesContent}>{tx.notes}</Text>
                        </View>
                      ) : null}

                      <View style={styles.verifiedStamp}>
                        <Ionicons name="shield-checkmark" size={14} color={C.brand} />
                        <Text style={styles.verifiedStampText}>
                          Verified completed wet market transaction
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Subcomponents ─── */

function KpiCard({
  icon,
  label,
  amount,
  color,
  bg,
}: {
  icon: string;
  label: string;
  amount: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {amount}
      </Text>
    </View>
  );
}

function getCategoryColor(index: number): string {
  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6'];
  return colors[index % colors.length];
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  /* Header */
  headerWrap: {
    backgroundColor: C.header,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: C.header,
  },
  headerInner: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 22,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerEyebrow: { fontSize: 11, fontWeight: '700', color: '#B8F0D4', letterSpacing: 0.5 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Loading */
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: C.muted, fontWeight: '600' },

  /* Body */
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 14 },

  /* Period selector */
  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#E8EFEA',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  periodChipActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  periodChipText: { fontSize: 12, fontWeight: '700', color: C.sub },
  periodChipTextActive: { color: C.brandDark, fontWeight: '800' },

  /* Hero Card */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#0B8F60',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.brandSoft,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPeriodLabel: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase' },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: C.ink,
    marginTop: 4,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  heroIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  heroStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  heroStatItem: { alignItems: 'center', gap: 2 },
  heroStatValue: { fontSize: 15, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  heroStatLabel: { fontSize: 11, fontWeight: '600', color: C.muted },

  /* KPI Grid */
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiLabel: { fontSize: 11, fontWeight: '600', color: C.muted },
  kpiAmount: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 2, fontVariant: ['tabular-nums'] },

  /* Generic Card */
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  cardSubtitle: { fontSize: 11, color: C.muted, fontWeight: '500', marginTop: 1 },

  /* Chart */
  chartActiveBox: {
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  chartActiveLabel: { fontSize: 11, fontWeight: '600', color: C.sub },
  chartActiveAmount: { fontSize: 20, fontWeight: '800', color: C.brandDark, marginTop: 2 },
  chartActiveMeta: { fontSize: 10, color: C.muted, fontWeight: '600' },
  chartBarsWrap: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBarValueTop: {
    fontSize: 9,
    fontWeight: '700',
    color: C.sub,
    height: 12,
    fontVariant: ['tabular-nums'],
  },
  chartBarTrack: {
    width: 22,
    height: 90,
    backgroundColor: '#EDF2EE',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  chartBarFillActive: {
    backgroundColor: C.brand,
  },
  chartBarFillInactive: {
    backgroundColor: '#9EDEC4',
  },
  chartBarLabel: { fontSize: 10, fontWeight: '700', color: C.muted },
  chartBarLabelActive: { color: C.brandDark, fontWeight: '800' },

  /* Top Products */
  topProductsList: { gap: 10 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  productRankWrap: { width: 28, alignItems: 'center' },
  productRankText: { fontSize: 15, fontWeight: '800' },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: '700', color: C.ink },
  productMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  productRight: { alignItems: 'flex-end' },
  productRevenue: { fontSize: 13, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] },
  productRevenueLabel: { fontSize: 9, color: C.muted, fontWeight: '600' },

  /* Distribution */
  distribSectionTitle: { fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 8 },
  categoryRow: { marginBottom: 8 },
  categoryInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  categoryName: { fontSize: 12, fontWeight: '600', color: C.ink },
  categoryAmount: { fontSize: 11, fontWeight: '700', color: C.sub, fontVariant: ['tabular-nums'] },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#EBEFEA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  paymentsRow: { flexDirection: 'row', gap: 8 },
  paymentCard: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  paymentMethodName: { fontSize: 11, fontWeight: '800', color: C.ink, marginTop: 2 },
  paymentMethodAmount: { fontSize: 12, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] },
  paymentMethodCount: { fontSize: 9, color: C.muted, fontWeight: '600' },
  emptySmallText: { fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 8 },

  /* Completed Transactions */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.ink, padding: 0 },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  filterPills: { flexGrow: 0 },
  filterPill: {
    backgroundColor: C.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
  },
  filterPillActive: { backgroundColor: C.brandSoft, borderWidth: 1, borderColor: C.brand },
  filterPillText: { fontSize: 11, fontWeight: '600', color: C.sub },
  filterPillTextActive: { color: C.brandDark, fontWeight: '800' },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.bg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  sortButtonText: { fontSize: 11, fontWeight: '700', color: C.sub },

  /* Transaction item card */
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 8,
    overflow: 'hidden',
  },
  txCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  txAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txAvatarText: { fontSize: 15, fontWeight: '800', color: C.brandDark },
  txInfo: { flex: 1 },
  txTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txCustomerName: { fontSize: 13, fontWeight: '700', color: C.ink, flexShrink: 1 },
  txPaymentBadge: {
    backgroundColor: '#EAEFE9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  txPaymentBadgeText: { fontSize: 8, fontWeight: '800', color: C.sub },
  txMeta: { fontSize: 10, color: C.muted, marginTop: 2 },
  txItemsSummary: { fontSize: 11, color: C.sub, marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: 13, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] },
  txCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.brandSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txCompletedBadgeText: { fontSize: 9, fontWeight: '800', color: C.brandDark },

  /* Expanded receipt */
  txExpanded: {
    backgroundColor: '#FAFCFA',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  txDivider: { height: 1, backgroundColor: C.line, marginBottom: 8 },
  receiptTitle: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 0.5, marginBottom: 6 },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  receiptItemLeft: { flex: 1 },
  receiptItemName: { fontSize: 12, fontWeight: '700', color: C.ink },
  receiptItemUnit: { fontSize: 10, color: C.muted },
  receiptItemSubtotal: { fontSize: 12, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginTop: 6,
    paddingTop: 8,
  },
  receiptTotalLabel: { fontSize: 12, fontWeight: '800', color: C.ink },
  receiptTotalAmount: { fontSize: 14, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] },
  txNotesBox: {
    backgroundColor: '#F3F6F4',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  txNotesLabel: { fontSize: 10, fontWeight: '700', color: C.sub },
  txNotesContent: { fontSize: 11, color: C.ink, marginTop: 1 },
  verifiedStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 6,
  },
  verifiedStampText: { fontSize: 10, fontWeight: '600', color: C.brandDark },

  /* Empty state */
  emptyBox: { alignItems: 'center', paddingVertical: 28 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: C.ink },
  emptySub: { fontSize: 11, color: C.muted, textAlign: 'center', paddingHorizontal: 20, marginTop: 2 },
});
