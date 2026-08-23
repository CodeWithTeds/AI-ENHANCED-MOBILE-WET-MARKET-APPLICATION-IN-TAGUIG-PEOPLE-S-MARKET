/**
 * Vendor Orders — incoming customer orders for this vendor's products.
 *
 * Features:
 *  - Shows only orders that contain this vendor's items
 *  - Segmented status filter (All / Pending / Confirmed / Processing / Ready / Completed) — fits one row, no scrolling
 *  - Expandable order cards with customer avatar, items, subtotal
 *  - One-tap status update (Confirm → Processing → Ready → Completed)
 *  - Pull-to-refresh
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { getToken } from '@/services/auth';
import {
  getVendorOrders,
  updateOrderStatus,
  ORDER_STATUS_CONFIG,
  type Order,
  type OrderStatus,
} from '@/services/orders';
import { ApiError } from '@/services/api';

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready',      label: 'Ready' },
  { value: 'completed',  label: 'Completed' },
];

/** Next logical status a vendor can set */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:    'confirmed',
  confirmed:  'processing',
  processing: 'ready',
  ready:      'completed',
};

export default function VendorOrdersScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const authToken = token ?? await getToken();
    if (!authToken) { setLoading(false); return; }
    try {
      const data = await getVendorOrders(authToken);
      setOrders(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError('Could not load orders. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function onRefresh() {
    setRefreshing(true);
    fetchOrders();
  }

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const completedCount = completedOrders.length;
  const completedRevenue = completedOrders.reduce(
    (sum, o) =>
      sum +
      o.items.reduce(
        (iSum, it) => iSum + Number(it.subtotal || it.quantity * it.unit_price || 0),
        0,
      ),
    0,
  );

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status === activeTab);

  async function handleStatusUpdate(order: Order) {
    const next = NEXT_STATUS[order.status as OrderStatus];
    const authToken = token ?? await getToken();
    if (!next || !authToken) return;

    const cfg = ORDER_STATUS_CONFIG[next];

    Alert.alert(
      'Update Order Status',
      `Mark "${order.order_number}" as ${cfg.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: cfg.label,
          onPress: async () => {
            setUpdatingId(order.id);
            try {
              const updated = await updateOrderStatus(order.id, next, authToken);
              setOrders((prev) =>
                prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o)),
              );
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Failed to update status';
              Alert.alert('Error', msg);
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Orders</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B6B45" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="receipt" size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Orders</Text>
              <Text style={styles.headerSub}>
                {orders.length} total · {pendingCount} waiting
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.salesBtn}
            onPress={() => router.push('/(vendor)/sales' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="trending-up" size={14} color="#1B6B45" />
            <Text style={styles.salesBtnText}>Sales & Revenue</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsRow}>
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const cfg = tab.value !== 'all' ? ORDER_STATUS_CONFIG[tab.value as OrderStatus] : null;

          return (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.tab,
                isActive && {
                  backgroundColor: cfg?.color ?? '#1B6B45',
                  borderColor: cfg?.color ?? '#1B6B45',
                },
              ]}
              onPress={() => setActiveTab(tab.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Orders List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B6B45" />
        }
      >
        {/* Completed revenue banner if on Completed tab */}
        {activeTab === 'completed' && completedCount > 0 && (
          <View style={styles.completedRevenueBanner}>
            <View style={styles.completedRevenueLeft}>
              <Text style={styles.completedRevenueLabel}>COMPLETED REVENUE</Text>
              <Text style={styles.completedRevenueAmount}>₱{completedRevenue.toFixed(2)}</Text>
              <Text style={styles.completedRevenueMeta}>
                {completedCount} completed transaction{completedCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewAnalyticsBtn}
              onPress={() => router.push('/(vendor)/sales' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewAnalyticsText}>Analytics</Text>
              <Ionicons name="arrow-forward" size={13} color="#1B6B45" />
            </TouchableOpacity>
          </View>
        )}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={36} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No orders here</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'all'
                ? 'Customer orders will appear here when someone buys your products.'
                : `No ${activeTab} orders right now.`}
            </Text>
          </View>
        ) : (
          filtered.map((order) => (
            <VendorOrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              updating={updatingId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
              onStatusUpdate={() => handleStatusUpdate(order)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Vendor Order Card ─── */

function VendorOrderCard({
  order,
  expanded,
  updating,
  onToggle,
  onStatusUpdate,
}: {
  order: Order;
  expanded: boolean;
  updating: boolean;
  onToggle: () => void;
  onStatusUpdate: () => void;
}) {
  const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const nextStatus = NEXT_STATUS[order.status as OrderStatus];
  const nextCfg = nextStatus ? ORDER_STATUS_CONFIG[nextStatus] : null;

  const customerName = order.user?.name ?? 'Customer';
  const date = new Date(order.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  });
  const time = new Date(order.created_at).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={[styles.card, { borderLeftColor: statusCfg.color }]}>
      {/* Compact Single-Line Header (collapsed) */}
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.avatarText, { color: statusCfg.color }]}>
            {customerName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardHeaderCenter}>
          <View style={styles.nameRow}>
            <Text style={styles.customerName} numberOfLines={1}>{customerName}</Text>
            {order.status === 'pending' && <View style={styles.newDot} />}
          </View>
        </View>

        <View style={styles.cardHeaderRight}>
          <Text style={styles.cardTotal}>₱{Number(order.total_amount).toFixed(2)}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon as any} size={11} color={statusCfg.color} />
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

      {/* Expanded: meta + items + action button */}
      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.divider} />

          {/* Order details */}
          <View style={styles.detailRow}>
            <Ionicons name="receipt-outline" size={13} color="#9CA3AF" />
            <Text style={styles.detailText}>{order.order_number}</Text>
            <Text style={styles.detailText}>·</Text>
            <Text style={styles.detailText}>{date} {time}</Text>
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="cube-outline" size={13} color="#9CA3AF" />
              <Text style={styles.metaText}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name={paymentIcon(order.payment_method) as any} size={13} color="#9CA3AF" />
              <Text style={styles.metaText}>{order.payment_method.toUpperCase()}</Text>
            </View>
          </View>

          {/* Items */}
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemIconWrap}>
                <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                <View style={styles.itemMetaRow}>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>×{item.quantity} {item.unit}</Text>
                  </View>
                  <Text style={styles.itemUnitPrice}>₱{Number(item.unit_price).toFixed(2)}/unit</Text>
                </View>
              </View>
              <Text style={styles.itemSubtotal}>₱{Number(item.subtotal).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.itemsTotalRow}>
            <Text style={styles.itemsTotalLabel}>Total</Text>
            <Text style={styles.itemsTotalValue}>₱{Number(order.total_amount).toFixed(2)}</Text>
          </View>

          {/* Status Update Button */}
          {nextCfg && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: nextCfg.color }]}
              onPress={onStatusUpdate}
              disabled={updating}
              activeOpacity={0.85}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <View style={styles.actionIconWrap}>
                    <Ionicons name={nextCfg.icon as any} size={16} color={nextCfg.color} />
                  </View>
                  <Text style={styles.actionBtnText}>
                    {updating ? 'Updating…' : `Mark as ${nextCfg.label}`}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.9)" />
                </>
              )}
            </TouchableOpacity>
          )}

          {order.status === 'completed' && (
            <View style={[styles.statusRow, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
              <Text style={[styles.statusRowText, { color: '#15803D' }]}>Order completed</Text>
              <Text style={[styles.statusRowHint, { color: '#16A34A' }]}>
                {new Date(order.updated_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}

          {order.status === 'cancelled' && (
            <View style={[styles.statusRow, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="close-circle" size={18} color="#DC2626" />
              <Text style={[styles.statusRowText, { color: '#B91C1C' }]}>Order cancelled</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ─── Helpers ─── */

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    meat: '🥩', fish: '🐟', vegetables: '🥬', fruits: '🍎',
    spices: '🌶️', poultry: '🍗', condiments: '🫙', dairy: '🥛',
  };
  return map[category.toLowerCase()] ?? '🛒';
}

function paymentIcon(method: string): string {
  switch (method.toLowerCase()) {
    case 'gcash': return 'phone-portrait-outline';
    case 'maya': return 'wallet-outline';
    default: return 'cash-outline';
  }
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: '#1B6B45', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  salesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E7F7EF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B8F0D4',
  },
  salesBtnText: { fontSize: 11, fontWeight: '700', color: '#1B6B45' },

  /* Completed revenue banner */
  completedRevenueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7ECE9',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  completedRevenueLeft: { flex: 1 },
  completedRevenueLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5 },
  completedRevenueAmount: { fontSize: 20, fontWeight: '800', color: '#15803D', marginTop: 2, fontVariant: ['tabular-nums'] },
  completedRevenueMeta: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  viewAnalyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E7F7EF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  viewAnalyticsText: { fontSize: 12, fontWeight: '700', color: '#1B6B45' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Tabs */
  tabsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  tab: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, paddingVertical: 8,
    borderRadius: 22, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#FFFFFF', fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 32 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySub: {
    fontSize: 13, color: '#9CA3AF', textAlign: 'center',
    paddingHorizontal: 32, lineHeight: 18,
  },

  /* Card */
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
    borderLeftWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 10,
  },
  avatar: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800' },
  cardHeaderCenter: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 13, fontWeight: '800', color: '#111827', flexShrink: 1 },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F97316' },
  orderNumber: {
    fontSize: 11, color: '#9CA3AF',
    fontVariant: ['tabular-nums'],
  },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTotal: { fontSize: 14, fontWeight: '800', color: '#15803D' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: '800' },

  /* Expanded: order details */
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  detailText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  /* Expanded: meta */
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: 4,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  /* Expanded */
  expandedSection: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 8 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9,
  },
  itemIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  itemEmoji: { fontSize: 17 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  qtyBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  qtyBadgeText: { fontSize: 10, fontWeight: '800', color: '#374151' },
  itemUnitPrice: { fontSize: 11, color: '#9CA3AF' },
  itemSubtotal: { fontSize: 14, fontWeight: '800', color: '#1B6B45' },

  itemsTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 4, marginBottom: 12,
  },
  itemsTotalLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  itemsTotalValue: { fontSize: 16, fontWeight: '800', color: '#1B6B45' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 13, paddingVertical: 13,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  actionIconWrap: {
    width: 26, height: 26, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 10,
  },
  statusRowText: { flex: 1, fontSize: 13, fontWeight: '700' },
  statusRowHint: { fontSize: 11, fontWeight: '600' },
});
