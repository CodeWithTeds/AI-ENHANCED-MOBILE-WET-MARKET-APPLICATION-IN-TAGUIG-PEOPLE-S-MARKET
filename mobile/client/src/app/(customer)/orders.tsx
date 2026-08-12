/**
 * Orders — customer order history with live status badges.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getCustomerToken } from '@/services/customer-auth';
import {
  getOrders,
  ORDER_STATUS_CONFIG,
  type Order,
  type OrderStatus,
} from '@/services/orders';

export default function OrdersScreen() {
  const { token } = useCustomerAuth();

  // useCustomerAuth may not have loaded yet — fall back to the stored customer token
  const getAuthToken = async () => token ?? await getCustomerToken();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const authToken = await getAuthToken();
    if (!authToken) { setLoading(false); return; }
    try {
      const result = await getOrders(authToken);
      setOrders(result.data ?? []);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B6B45" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSub}>
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B6B45" />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>
              Your order history will appear here once you place an order.
            </Text>
          </View>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Order Card ─── */

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const date = new Date(order.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = new Date(order.created_at).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.card}>
      {/* Top Row */}
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <Text style={styles.orderDate}>{date} · {time}</Text>
        </View>

        <View style={styles.cardHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#9CA3AF"
          />
        </View>
      </TouchableOpacity>

      {/* Summary Row */}
      <View style={styles.cardSummary}>
        <View style={styles.summaryChip}>
          <Ionicons name="cube-outline" size={13} color="#6B7280" />
          <Text style={styles.summaryChipText}>
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.summaryChip}>
          <Ionicons name="cash-outline" size={13} color="#6B7280" />
          <Text style={styles.summaryChipText}>{order.payment_method.toUpperCase()}</Text>
        </View>
        <Text style={styles.cardTotal}>₱{Number(order.total_amount).toFixed(2)}</Text>
      </View>

      {/* Expanded Items */}
      {expanded && (
        <View style={styles.itemsSection}>
          <View style={styles.itemsDivider} />
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                <Text style={styles.itemMeta}>
                  ×{item.quantity} {item.unit} · ₱{Number(item.unit_price).toFixed(2)}/unit
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>
                ₱{Number(item.subtotal).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={styles.itemsTotalRow}>
            <Text style={styles.itemsTotalLabel}>Total</Text>
            <Text style={styles.itemsTotalValue}>
              ₱{Number(order.total_amount).toFixed(2)}
            </Text>
          </View>

          {/* Track + Review actions */}
          {order.status === 'completed' && (
            <TouchableOpacity
              style={styles.rateBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/track/${order.id}?rate=1`)}
            >
              <Ionicons name="star" size={16} color="#FFFFFF" />
              <Text style={styles.rateBtnText}>Rate Your Purchase</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.trackBtn, order.status === 'completed' && styles.trackBtnOutline]}
            activeOpacity={0.85}
            onPress={() => router.push(`/track/${order.id}`)}
          >
            <Ionicons
              name={order.status === 'completed' ? 'pulse-outline' : 'pulse-outline'}
              size={16}
              color={order.status === 'completed' ? '#1B6B45' : '#FFFFFF'}
            />
            <Text style={[styles.trackBtnText, order.status === 'completed' && styles.trackBtnTextOutline]}>
              Track Order
            </Text>
          </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySub: {
    fontSize: 13, color: '#9CA3AF', textAlign: 'center',
    paddingHorizontal: 40, lineHeight: 18,
  },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6',
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
  orderDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  summaryChipText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  cardTotal: { marginLeft: 'auto', fontSize: 16, fontWeight: '800', color: '#1B6B45' },

  itemsSection: { paddingHorizontal: 14, paddingBottom: 14 },
  itemsDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  itemEmoji: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  itemSubtotal: { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

  itemsTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 10, marginTop: 4,
  },
  itemsTotalLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  itemsTotalValue: { fontSize: 16, fontWeight: '800', color: '#1B6B45' },

  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1B6B45',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  trackBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  rateBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  trackBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1B6B45',
  },
  trackBtnTextOutline: { color: '#1B6B45' },
});
