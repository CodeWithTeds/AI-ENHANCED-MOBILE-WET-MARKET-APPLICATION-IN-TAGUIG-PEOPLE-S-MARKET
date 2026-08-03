/**
 * Vendor Orders — incoming customer orders for this vendor's products.
 *
 * Features:
 *  - Shows only orders that contain this vendor's items
 *  - Status filter tabs (All / Pending / Confirmed / Processing / Ready / Completed)
 *  - Expandable order cards with customer name, items, subtotal
 *  - One-tap status update (Confirm → Processing → Ready → Completed)
 *  - Pull-to-refresh
 *  - Badge count on "Pending" tab
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
        <View>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSub}>
            {orders.length} total · {pendingCount} pending
          </Text>
        </View>
      </View>

      {/* Status Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const cfg = tab.value !== 'all' ? ORDER_STATUS_CONFIG[tab.value as OrderStatus] : null;
          const count = tab.value === 'all'
            ? orders.length
            : orders.filter((o) => o.status === tab.value).length;

          return (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.tab,
                isActive && { backgroundColor: cfg?.bg ?? '#F3F4F6', borderColor: cfg?.color ?? '#1B6B45' },
              ]}
              onPress={() => setActiveTab(tab.value)}
            >
              <Text style={[styles.tabLabel, isActive && { color: cfg?.color ?? '#1B6B45', fontWeight: '700' }]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, isActive && { backgroundColor: cfg?.color ?? '#1B6B45' }]}>
                  <Text style={[styles.tabBadgeText, isActive && { color: '#FFF' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Orders List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B6B45" />
        }
      >
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

  const date = new Date(order.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  });
  const time = new Date(order.created_at).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <Text style={styles.orderMeta}>
            {order.user?.name ?? 'Customer'} · {date} {time}
          </Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon as any} size={11} color={statusCfg.color} />
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

      {/* Summary chips */}
      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Ionicons name="cube-outline" size={12} color="#6B7280" />
          <Text style={styles.chipText}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.chip}>
          <Ionicons name="cash-outline" size={12} color="#6B7280" />
          <Text style={styles.chipText}>{order.payment_method.toUpperCase()}</Text>
        </View>
        <Text style={styles.cardTotal}>₱{Number(order.total_amount).toFixed(2)}</Text>
      </View>

      {/* Expanded: items + action button */}
      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.divider} />

          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                <Text style={styles.itemMeta}>
                  ×{item.quantity} {item.unit} · ₱{Number(item.unit_price).toFixed(2)}/unit
                </Text>
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
                <Ionicons name={nextCfg.icon as any} size={16} color="#FFFFFF" />
              )}
              <Text style={styles.actionBtnText}>
                {updating ? 'Updating…' : `Mark as ${nextCfg.label}`}
              </Text>
            </TouchableOpacity>
          )}

          {order.status === 'completed' && (
            <View style={styles.completedRow}>
              <Ionicons name="checkmark-done-circle" size={16} color="#16A34A" />
              <Text style={styles.completedText}>Order completed</Text>
            </View>
          )}

          {order.status === 'cancelled' && (
            <View style={[styles.completedRow, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="close-circle" size={16} color="#DC2626" />
              <Text style={[styles.completedText, { color: '#DC2626' }]}>Order cancelled</Text>
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

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tabsRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tabBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 9,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#6B7280' },

  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },

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

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 14, gap: 10,
  },
  cardHeaderLeft: { flex: 1 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  orderNumber: { fontSize: 15, fontWeight: '800', color: '#111827' },
  orderMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  chipRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  chipText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  cardTotal: { marginLeft: 'auto', fontSize: 16, fontWeight: '800', color: '#1B6B45' },

  expandedSection: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  itemEmoji: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  itemSubtotal: { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

  itemsTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 10, marginBottom: 12,
  },
  itemsTotalLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  itemsTotalValue: { fontSize: 16, fontWeight: '800', color: '#1B6B45' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  completedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10,
  },
  completedText: { fontSize: 13, fontWeight: '600', color: '#16A34A' },
});
