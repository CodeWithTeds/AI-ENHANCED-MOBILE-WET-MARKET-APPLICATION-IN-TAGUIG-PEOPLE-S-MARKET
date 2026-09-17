/**
 * Customer Reports — purchases and total spending with date range.
 *
 * Features:
 *  - Preset ranges: All, Today, 7 Days, 30 Days, 90 Days, Custom
 *  - Custom From/To inputs (YYYY-MM-DD)
 *  - Generate report → summary, daily trend, vendor/category/payment breakdown, detailed orders with items
 *  - Share report via system share sheet (formatted text)
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getCustomerToken } from '@/services/customer-auth';
import {
  buildReportShareText,
  formatCompactPeso,
  formatPeso,
  getCustomerReport,
  type CustomerReport,
  type CustomerReportParams,
} from '@/services/customer-reports';

const SCREEN_WIDTH = Dimensions.get('window').width;

const C = {
  bg: '#F4F7F5',
  card: '#FFFFFF',
  ink: '#0F1E17',
  sub: '#586A61',
  muted: '#94A39A',
  line: '#E7ECE9',
  brand: '#10B981',
  brandDark: '#0B8F60',
  brandSoft: '#E7F7EF',
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
} as const;

type Preset = 'all' | 'today' | '7d' | '30d' | '90d' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: 'custom', label: 'Custom' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function shiftISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function presetToParams(preset: Preset): CustomerReportParams {
  if (preset === 'all') return {};
  if (preset === 'today') {
    const t = todayISO();
    return { date_from: t, date_to: t };
  }
  if (preset === '7d') return { date_from: shiftISO(-6), date_to: todayISO() };
  if (preset === '30d') return { date_from: shiftISO(-29), date_to: todayISO() };
  if (preset === '90d') return { date_from: shiftISO(-89), date_to: todayISO() };
  return {};
}

export default function CustomerReportsScreen() {
  const { token } = useCustomerAuth();
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState(shiftISO(-29));
  const [customTo, setCustomTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<CustomerReport | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedParams: CustomerReportParams = useMemo(() => {
    if (preset === 'custom') {
      return { date_from: customFrom.trim() || undefined, date_to: customTo.trim() || undefined };
    }
    return presetToParams(preset);
  }, [preset, customFrom, customTo]);

  const fetchReport = useCallback(
    async (isRefresh = false) => {
      const authToken = token ?? (await getCustomerToken());
      if (!authToken) {
        Alert.alert('Sign In Required', 'Please sign in to view reports.');
        return;
      }
      if (preset === 'custom') {
        if (customFrom && !/^\d{4}-\d{2}-\d{2}$/.test(customFrom)) {
          setError('Custom From date must be YYYY-MM-DD');
          return;
        }
        if (customTo && !/^\d{4}-\d{2}-\d{2}$/.test(customTo)) {
          setError('Custom To date must be YYYY-MM-DD');
          return;
        }
      }
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const data = await getCustomerReport(authToken, resolvedParams);
        setReport(data);
        setHasGenerated(true);
      } catch (e: any) {
        const raw = e.message || 'Failed to generate report';
        // Map low-level network errors to user-friendly message
        const friendly =
          raw.includes('Connection reset') || raw.includes('fetch failed') || raw.includes('Network request failed') || e.status === 0
            ? 'Cannot reach server at https://ai-enhanced-mobile-wet-market-application-in-tag-production.up.railway.app. Check your internet connection or try again. (Local dev: set EXPO_PUBLIC_API_URL=http://192.168.1.2:8080/api/v1)'
            : raw;
        setError(friendly);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, resolvedParams, preset, customFrom, customTo],
  );

  async function handleShare() {
    if (!report) return;
    const text = buildReportShareText(report);
    try {
      await Share.share({ message: text, title: 'Purchase Report' });
    } catch {}
  }

  const summary = report?.summary;
  const daily = report?.daily_spending ?? [];
  const maxDaily = Math.max(...daily.map((d) => d.total), 1);
  const activePoint = selectedBarIndex !== null ? daily[selectedBarIndex] : daily[daily.length - 1];

  return (
    <View style={styles.screen}>
      <View style={styles.headerWrap}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <View style={styles.headerNav}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
                <Ionicons name="arrow-back" size={20} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerEyebrow}>Spending & Purchases</Text>
                <Text style={styles.headerTitle}>Reports</Text>
              </View>
              <TouchableOpacity onPress={handleShare} disabled={!report} style={[styles.headerActionBtn, !report && { opacity: 0.5 }]} accessibilityLabel="Share report">
                <Ionicons name="share-social-outline" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSub}>Select a date range and generate your purchase report with orders, items, and total spent.</Text>
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
              fetchReport(true);
            }}
            tintColor={C.brand}
          />
        }
      >
        {/* ─── Date Range Selector ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: C.brandSoft }]}>
                <Ionicons name="calendar-outline" size={16} color={C.brand} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Date Range</Text>
                <Text style={styles.cardSubtitle}>Choose a preset or set custom dates (YYYY-MM-DD)</Text>
              </View>
            </View>
          </View>

          <View style={styles.presetRow}>
            {PRESETS.map((p) => {
              const active = preset === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  onPress={() => setPreset(p.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {preset === 'custom' && (
            <View style={styles.customRow}>
              <View style={styles.customField}>
                <Text style={styles.customLabel}>From</Text>
                <TextInput
                  style={styles.customInput}
                  value={customFrom}
                  onChangeText={setCustomFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.customField}>
                <Text style={styles.customLabel}>To</Text>
                <TextInput
                  style={styles.customInput}
                  value={customTo}
                  onChangeText={setCustomTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          )}

          {preset !== 'custom' && (
            <View style={styles.rangeHint}>
              <Ionicons name="information-circle-outline" size={14} color={C.muted} />
              <Text style={styles.rangeHintText}>
                {(() => {
                  const p = presetToParams(preset);
                  if (!p.date_from) return 'All time — all your orders';
                  if (p.date_from === p.date_to) return `Today — ${p.date_from}`;
                  return `${p.date_from} → ${p.date_to}`;
                })()}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.generateBtn, loading && { opacity: 0.7 }]}
            onPress={() => fetchReport(false)}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="document-text-outline" size={18} color="#FFF" />}
            <Text style={styles.generateBtnText}>{loading ? 'Generating…' : 'Generate Report'}</Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={C.red} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => fetchReport(false)} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!hasGenerated && !loading ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="chart-box-outline" size={36} color={C.muted} />
            </View>
            <Text style={styles.emptyTitle}>No report yet</Text>
            <Text style={styles.emptySub}>Pick a date range and tap Generate Report to see your purchases, items, quantities, prices, and total spending.</Text>
          </View>
        ) : null}

        {report && (
          <>
            {/* ─── Summary Hero ─── */}
            <View style={styles.heroCard}>
              <View style={styles.heroGlow} />
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroLabel}>Total Spent</Text>
                  <Text style={styles.heroAmount}>{formatPeso(summary?.total_spent ?? 0)}</Text>
                  <Text style={styles.heroSub}>
                    {report.date_range.from && report.date_range.to
                      ? `${report.date_range.from} → ${report.date_range.to}`
                      : 'All time'}
                    {' · '}
                    {summary?.total_orders ?? 0} orders
                  </Text>
                </View>
                <View style={styles.heroIconBadge}>
                  <MaterialCommunityIcons name="cash-multiple" size={28} color={C.brand} />
                </View>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatsGrid}>
                <View style={styles.heroStatItem}>
                  <Ionicons name="receipt-outline" size={16} color={C.brand} />
                  <Text style={styles.heroStatValue}>{summary?.total_orders ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Orders</Text>
                </View>
                <View style={styles.heroStatItem}>
                  <Ionicons name="cube-outline" size={16} color={C.blue} />
                  <Text style={styles.heroStatValue}>{summary?.total_items_purchased ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Items</Text>
                </View>
                <View style={styles.heroStatItem}>
                  <Ionicons name="cash-outline" size={16} color={C.orange} />
                  <Text style={styles.heroStatValue}>{formatPeso(summary?.average_order_value ?? 0)}</Text>
                  <Text style={styles.heroStatLabel}>Avg / Order</Text>
                </View>
                <View style={styles.heroStatItem}>
                  <Ionicons name="star-outline" size={16} color={C.purple} />
                  <Text style={styles.heroStatValue}>{summary?.unique_products ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Products</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="share-social-outline" size={14} color={C.brandDark} />
                <Text style={styles.shareBtnText}>Share Report</Text>
              </TouchableOpacity>
            </View>

            {/* ─── KPI row ─── */}
            <View style={styles.kpiGrid}>
              <KpiCard icon="checkmark-done-circle-outline" label="Completed" value={String(summary?.completed_orders ?? 0)} color={C.brand} bg={C.brandSoft} sub="delivered" />
              <KpiCard icon="time-outline" label="Pending" value={String(summary?.pending_orders ?? 0)} color={C.amber} bg={C.amberSoft} sub="awaiting" />
              <KpiCard icon="close-circle-outline" label="Cancelled" value={String(summary?.cancelled_orders ?? 0)} color={C.red} bg={C.redSoft} sub="voided" />
              <KpiCard icon="wallet-outline" label="Payment" value={summary ? `${summary.total_orders - (summary.cancelled_orders ?? 0)} paid` : '—'} color={C.purple} bg={C.purpleSoft} sub="non-cancelled" />
            </View>

            {/* ─── Daily Spending Chart ─── */}
            {daily.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardHeaderIcon, { backgroundColor: C.brandSoft }]}>
                      <Ionicons name="trending-up" size={16} color={C.brand} />
                    </View>
                    <View>
                      <Text style={styles.cardTitle}>Daily Spending</Text>
                      <Text style={styles.cardSubtitle}>Total spent per day in range</Text>
                    </View>
                  </View>
                </View>

                {activePoint && (
                  <View style={styles.chartActiveBox}>
                    <Text style={styles.chartActiveLabel}>{activePoint.label} ({activePoint.date})</Text>
                    <Text style={styles.chartActiveAmount}>{formatPeso(activePoint.total)}</Text>
                    <Text style={styles.chartActiveMeta}>{activePoint.orders_count} order{activePoint.orders_count !== 1 ? 's' : ''}</Text>
                  </View>
                )}

                <View style={styles.chartBarsWrap}>
                  {daily.map((point, index) => {
                    const heightPercent = maxDaily > 0 ? Math.max(8, (point.total / maxDaily) * 100) : 8;
                    const isSelected = selectedBarIndex === index || (selectedBarIndex === null && index === daily.length - 1);
                    return (
                      <TouchableOpacity
                        key={point.date}
                        style={styles.chartBarCol}
                        onPress={() => setSelectedBarIndex(index)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.chartBarValueTop}>{point.total > 0 ? formatCompactPeso(point.total) : ''}</Text>
                        <View style={styles.chartBarTrack}>
                          <View
                            style={[
                              styles.chartBarFill,
                              { height: `${heightPercent}%` },
                              isSelected ? styles.chartBarFillActive : styles.chartBarFillInactive,
                            ]}
                          />
                        </View>
                        <Text style={[styles.chartBarLabel, isSelected && styles.chartBarLabelActive]}>{point.day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─── Category & Vendor Breakdown ─── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: C.blueSoft }]}>
                    <Ionicons name="pie-chart-outline" size={16} color={C.blue} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Spending Breakdown</Text>
                    <Text style={styles.cardSubtitle}>By category, vendor & payment</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.distribSectionTitle}>Categories</Text>
              {report.category_breakdown.length === 0 ? (
                <Text style={styles.emptySmall}>No category data</Text>
              ) : (
                report.category_breakdown.slice(0, 6).map((cat, idx) => (
                  <View key={cat.category} style={styles.categoryRow}>
                    <View style={styles.categoryInfoRow}>
                      <Text style={styles.categoryName}>{cat.category}</Text>
                      <Text style={styles.categoryAmount}>{formatPeso(cat.total)} ({cat.percent}%) · {cat.quantity} units</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(4, cat.percent))}%`, backgroundColor: getCategoryColor(idx) }]} />
                    </View>
                  </View>
                ))
              )}

              <View style={styles.divider} />

              <Text style={styles.distribSectionTitle}>Vendors</Text>
              {report.vendor_breakdown.length === 0 ? (
                <Text style={styles.emptySmall}>No vendor data</Text>
              ) : (
                report.vendor_breakdown.slice(0, 5).map((v) => (
                  <View key={v.vendor_id} style={styles.vendorRow}>
                    <View style={styles.vendorIcon}>
                      <Ionicons name="storefront-outline" size={14} color={C.sub} />
                    </View>
                    <View style={styles.vendorInfo}>
                      <Text style={styles.vendorName} numberOfLines={1}>{v.stall_name}</Text>
                      <Text style={styles.vendorMeta}>{v.orders_count} orders · {v.items_count} items</Text>
                    </View>
                    <Text style={styles.vendorTotal}>{formatPeso(v.total)}</Text>
                  </View>
                ))
              )}

              <View style={styles.divider} />

              <Text style={styles.distribSectionTitle}>Payment Methods</Text>
              <View style={styles.paymentsRow}>
                {report.payment_breakdown.map((pm) => {
                  const icon = pm.method === 'gcash' ? 'phone-portrait-outline' : pm.method === 'maya' ? 'wallet-outline' : 'cash-outline';
                  const color = pm.method === 'gcash' ? C.blue : pm.method === 'maya' ? '#00D632' : C.brand;
                  return (
                    <View key={pm.method} style={styles.paymentCard}>
                      <Ionicons name={icon as any} size={18} color={color} />
                      <Text style={styles.paymentMethodName}>{pm.label}</Text>
                      <Text style={styles.paymentMethodAmount}>{formatPeso(pm.total)}</Text>
                      <Text style={styles.paymentMethodCount}>{pm.count} orders ({pm.percent}%)</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ─── Top Products ─── */}
            {report.top_products.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardHeaderIcon, { backgroundColor: C.orangeSoft }]}>
                      <Ionicons name="flame" size={16} color={C.orange} />
                    </View>
                    <View>
                      <Text style={styles.cardTitle}>Most Purchased</Text>
                      <Text style={styles.cardSubtitle}>Top products by spending</Text>
                    </View>
                  </View>
                </View>
                {report.top_products.map((p, idx) => (
                  <View key={`${p.product_id}-${idx}`} style={styles.productRow}>
                    <Text style={styles.productRank}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</Text>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{p.product_name}</Text>
                      <Text style={styles.productMeta}>{p.quantity} {p.unit} · {p.category} · {p.orders_count} orders</Text>
                    </View>
                    <View style={styles.productRight}>
                      <Text style={styles.productTotal}>{formatPeso(p.total)}</Text>
                      <Text style={styles.productUnit}>{formatPeso(p.total / Math.max(1, p.quantity))}/unit avg</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ─── Orders Detailed List ─── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: C.brandSoft }]}>
                    <Ionicons name="receipt-outline" size={16} color={C.brand} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Orders</Text>
                    <Text style={styles.cardSubtitle}>{report.orders.length} orders · tap to expand items</Text>
                  </View>
                </View>
              </View>

              {report.orders.length === 0 ? (
                <View style={styles.emptyOrders}>
                  <Ionicons name="receipt-outline" size={32} color={C.muted} />
                  <Text style={styles.emptyOrdersTitle}>No orders in this period</Text>
                  <Text style={styles.emptyOrdersSub}>Try a broader date range.</Text>
                </View>
              ) : (
                report.orders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  const d = new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                  const t = new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <View key={order.id} style={styles.orderCard}>
                      <TouchableOpacity style={styles.orderHeader} onPress={() => setExpandedOrderId(expanded ? null : order.id)} activeOpacity={0.7}>
                        <View style={styles.orderLeft}>
                          <Text style={styles.orderNumber}>{order.order_number}</Text>
                          <Text style={styles.orderDate}>{d} · {t} · {order.status}</Text>
                        </View>
                        <View style={styles.orderRight}>
                          <Text style={styles.orderAmount}>{formatPeso(order.total_amount)}</Text>
                          <View style={styles.orderBadge}>
                            <Text style={styles.orderBadgeText}>{order.payment_method.toUpperCase()}</Text>
                          </View>
                          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
                        </View>
                      </TouchableOpacity>
                      {expanded && (
                        <View style={styles.orderExpanded}>
                          <View style={styles.orderDivider} />
                          {order.items.map((it) => (
                            <View key={it.id} style={styles.itemRow}>
                              <View style={styles.itemLeft}>
                                <Text style={styles.itemName} numberOfLines={1}>{it.product_name}</Text>
                                <Text style={styles.itemMeta}>{it.quantity} {it.unit} × {formatPeso(it.unit_price)} · {it.category} {it.vendor_stall ? `· ${it.vendor_stall}` : ''}</Text>
                              </View>
                              <Text style={styles.itemSubtotal}>{formatPeso(it.subtotal)}</Text>
                            </View>
                          ))}
                          <View style={styles.orderTotalRow}>
                            <Text style={styles.orderTotalLabel}>Total</Text>
                            <Text style={styles.orderTotalValue}>{formatPeso(order.total_amount)}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            <View style={{ height: 12 }} />
            <TouchableOpacity style={styles.shareBtnLarge} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={18} color="#FFF" />
              <Text style={styles.shareBtnLargeText}>Share Report</Text>
            </TouchableOpacity>
            <Text style={styles.shareHint}>Shares as text — orders, items, quantities, prices, and total spent.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function KpiCard({ icon, label, value, color, bg, sub }: { icon: string; label: string; value: string; color: string; bg: string; sub?: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function getCategoryColor(index: number): string {
  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6'];
  return colors[index % colors.length];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  headerWrap: { backgroundColor: C.header, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' as const },
  headerInner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerEyebrow: { fontSize: 11, fontWeight: '700', color: '#B8F0D4', letterSpacing: 0.5 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#FFF', marginTop: 1 },
  headerActionBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerSub: { fontSize: 12, color: '#D6F5E5', marginTop: 10, lineHeight: 16, textAlign: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 14 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  cardSubtitle: { fontSize: 11, color: C.muted, fontWeight: '500', marginTop: 1 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E8EFEA', borderWidth: 1, borderColor: '#E7ECE9' },
  presetChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  presetText: { fontSize: 12, fontWeight: '700', color: C.sub },
  presetTextActive: { color: '#FFF' },
  customRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  customField: { flex: 1 },
  customLabel: { fontSize: 11, fontWeight: '700', color: C.sub, marginBottom: 6 },
  customInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink, fontWeight: '600' },
  rangeHint: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.bg, borderRadius: 10, padding: 10, marginBottom: 12 },
  rangeHintText: { fontSize: 12, color: C.sub, fontWeight: '600' },
  generateBtn: { flexDirection: 'row', gap: 8, backgroundColor: C.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  generateBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  errorBox: { flexDirection: 'row', gap: 8, backgroundColor: C.redSoft, borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#FECACA', alignItems: 'center' },
  errorText: { flex: 1, fontSize: 12, color: C.red, fontWeight: '600' },
  retryBtn: { backgroundColor: C.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  retryText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  emptyCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  emptySub: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 18, paddingHorizontal: 12 },
  heroCard: { backgroundColor: '#FFF', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.line, shadowColor: '#0B8F60', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -50, right: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: C.brandSoft },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase' as const },
  heroAmount: { fontSize: 28, fontWeight: '800', color: C.ink, marginTop: 4, fontVariant: ['tabular-nums'] as any },
  heroSub: { fontSize: 11, color: C.muted, marginTop: 4, fontWeight: '600' },
  heroIconBadge: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  heroDivider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  heroStatsGrid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStatItem: { alignItems: 'center', gap: 2 },
  heroStatValue: { fontSize: 15, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] as any },
  heroStatLabel: { fontSize: 11, fontWeight: '600', color: C.muted },
  shareBtn: { flexDirection: 'row', gap: 6, backgroundColor: C.brandSoft, borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderWidth: 1, borderColor: '#B8F0D4' },
  shareBtnText: { fontSize: 12, fontWeight: '800', color: C.brandDark },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: (SCREEN_WIDTH - 32 - 10) / 2, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line },
  kpiIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiLabel: { fontSize: 11, fontWeight: '600', color: C.muted },
  kpiAmount: { fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 2, fontVariant: ['tabular-nums'] as any },
  kpiSub: { fontSize: 10, color: C.muted, marginTop: 2 },
  chartActiveBox: { backgroundColor: C.bg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginBottom: 14 },
  chartActiveLabel: { fontSize: 11, fontWeight: '600', color: C.sub },
  chartActiveAmount: { fontSize: 18, fontWeight: '800', color: C.brandDark, marginTop: 2 },
  chartActiveMeta: { fontSize: 10, color: C.muted, fontWeight: '600' },
  chartBarsWrap: { flexDirection: 'row', height: 140, alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 16, paddingHorizontal: 4 },
  chartBarCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 },
  chartBarValueTop: { fontSize: 9, fontWeight: '700', color: C.sub, height: 12, fontVariant: ['tabular-nums'] as any },
  chartBarTrack: { width: 22, height: 90, backgroundColor: '#EDF2EE', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBarFill: { width: '100%', borderRadius: 8 },
  chartBarFillActive: { backgroundColor: C.brand },
  chartBarFillInactive: { backgroundColor: '#9EDEC4' },
  chartBarLabel: { fontSize: 10, fontWeight: '700', color: C.muted },
  chartBarLabelActive: { color: C.brandDark, fontWeight: '800' },
  distribSectionTitle: { fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 8 },
  categoryRow: { marginBottom: 10 },
  categoryInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  categoryName: { fontSize: 12, fontWeight: '600', color: C.ink },
  categoryAmount: { fontSize: 11, fontWeight: '700', color: C.sub, fontVariant: ['tabular-nums'] as any },
  progressBarTrack: { height: 6, backgroundColor: '#EBEFEA', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  vendorIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  vendorInfo: { flex: 1 },
  vendorName: { fontSize: 13, fontWeight: '700', color: C.ink },
  vendorMeta: { fontSize: 11, color: C.muted, marginTop: 1 },
  vendorTotal: { fontSize: 13, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] as any },
  paymentsRow: { flexDirection: 'row', gap: 8 },
  paymentCard: { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  paymentMethodName: { fontSize: 11, fontWeight: '800', color: C.ink, marginTop: 2 },
  paymentMethodAmount: { fontSize: 12, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] as any },
  paymentMethodCount: { fontSize: 9, color: C.muted, fontWeight: '600' },
  emptySmall: { fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  productRank: { width: 28, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: '700', color: C.ink },
  productMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  productRight: { alignItems: 'flex-end' },
  productTotal: { fontSize: 13, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] as any },
  productUnit: { fontSize: 10, color: C.muted },
  orderCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: C.line, marginBottom: 8, overflow: 'hidden' },
  orderHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  orderLeft: { flex: 1 },
  orderNumber: { fontSize: 13, fontWeight: '800', color: C.ink },
  orderDate: { fontSize: 11, color: C.muted, marginTop: 1 },
  orderRight: { alignItems: 'flex-end', gap: 2 },
  orderAmount: { fontSize: 13, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] as any },
  orderBadge: { backgroundColor: '#EAEFE9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  orderBadgeText: { fontSize: 8, fontWeight: '800', color: C.sub },
  orderExpanded: { backgroundColor: '#FAFCFA', paddingHorizontal: 14, paddingBottom: 12 },
  orderDivider: { height: 1, backgroundColor: C.line, marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  itemLeft: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 12, fontWeight: '700', color: C.ink },
  itemMeta: { fontSize: 10, color: C.muted, marginTop: 1 },
  itemSubtotal: { fontSize: 12, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] as any },
  orderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line, marginTop: 6, paddingTop: 8 },
  orderTotalLabel: { fontSize: 12, fontWeight: '800', color: C.ink },
  orderTotalValue: { fontSize: 14, fontWeight: '800', color: C.brandDark, fontVariant: ['tabular-nums'] as any },
  emptyOrders: { alignItems: 'center', paddingVertical: 24 },
  emptyOrdersTitle: { fontSize: 14, fontWeight: '700', color: C.ink, marginTop: 8 },
  emptyOrdersSub: { fontSize: 12, color: C.muted, marginTop: 4 },
  shareBtnLarge: { flexDirection: 'row', gap: 8, backgroundColor: C.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  shareBtnLargeText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  shareHint: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 },
});
