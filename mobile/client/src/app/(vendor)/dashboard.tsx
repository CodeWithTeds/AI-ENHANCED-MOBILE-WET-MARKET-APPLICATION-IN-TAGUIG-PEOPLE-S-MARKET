/**
 * Vendor Dashboard — modern overview.
 * Live sales overview, pending orders, and inventory summary.
 */

import { useCallback, useState } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/services/auth';
import {
  getVendorOrders,
  ORDER_STATUS_CONFIG,
  type Order,
  type OrderStatus,
} from '@/services/orders';
import { fetchInventorySummary, type InventorySummary } from '@/services/inventory';

/* ─── Design tokens ─── */

const C = {
  bg: '#F3F6F4',
  card: '#FFFFFF',
  ink: '#0E1F17',
  sub: '#5F6F66',
  muted: '#98A69D',
  brand: '#10B981',
  brandDark: '#0B8F60',
  brandSoft: '#E7F7EF',
  orange: '#F97316',
  orangeSoft: '#FFF2E6',
  blue: '#3E7BFF',
  blueSoft: '#EAF0FF',
  red: '#EF4444',
  redSoft: '#FEEBEB',
  amber: '#F59E0B',
  amberSoft: '#FFF7E0',
  line: '#EDF1EE',
  header: '#0E8F5B',
  headerDeep: '#0A6C46',
} as const;

type Tint = { color: string; bg: string };

const TINTS = {
  orange: { color: C.orange, bg: C.orangeSoft },
  blue: { color: C.blue, bg: C.blueSoft },
  brand: { color: C.brand, bg: C.brandSoft },
  red: { color: C.red, bg: C.redSoft },
  amber: { color: C.amber, bg: C.amberSoft },
  muted: { color: C.muted, bg: 'transparent' },
} as const satisfies Record<string, Tint>;

export default function VendorDashboard() {
  const { vendor, token } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (_isRefresh = false) => {
      const authToken = token ?? (await getToken());
      if (!authToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      try {
        const [orderData, invSummary] = await Promise.all([
          getVendorOrders(authToken),
          fetchInventorySummary(),
        ]);
        setOrders(Array.isArray(orderData) ? orderData : []);
        setSummary(invSummary);
      } catch {
        // keep last known data on refresh failure
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /* ─── Derived stats ─── */

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((o) => new Date(o.created_at) >= startOfToday);
  const todaysSales = round2(todayOrders.reduce((sum, o) => sum + vendorTotal(o), 0));

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const confirmedCount = orders.filter((o) => o.status === 'confirmed' || o.status === 'processing').length;

  const completedOrders = orders.filter((o) => o.status === 'completed');
  const completedCount = completedOrders.length;
  const totalRevenue = round2(completedOrders.reduce((sum, o) => sum + vendorTotal(o), 0));

  const recentOrders = orders.slice(0, 3);

  const productsCount = summary?.total_products ?? 0;
  const totalUnits = summary?.total_units ?? 0;
  const inStock = summary?.in_stock ?? 0;
  const lowStock = summary?.low_stock ?? 0;
  const outStock = summary?.out_of_stock ?? 0;

  const stallName = vendor?.stall_name ?? 'My Store';
  const stallLocation = vendor?.stall_location ?? 'Taguig People\'s Market';
  const greeting = getGreeting();

  if (loading && orders.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']} style={styles.safeHeader}>
            <View style={styles.header} />
          </SafeAreaView>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={styles.loadingText}>Loading your dashboard…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.header}>
            <Circles />
            <View style={styles.headerTopRow}>
              <View style={styles.profileHalo}>
                <Text style={styles.profileInitial}>{stallName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.headerTitles}>
                <Text style={styles.headerEyebrow}>{stallLocation}</Text>
                <Text style={styles.headerName} numberOfLines={1}>{stallName}</Text>
              </View>
              <TouchableOpacity
                style={styles.bell}
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                {pendingCount > 0 && <View style={styles.bellDot} />}
              </TouchableOpacity>
            </View>
            <Text style={styles.greetingText}>{greeting} 👋</Text>
            <Text style={styles.headline}>Here&apos;s what&apos;s happening today.</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={C.brand}
          />
        }
      >
        {/* Hero — all-time revenue & sales analytics entry */}
        <TouchableOpacity
          style={styles.heroCard}
          onPress={() => router.push('/(vendor)/sales' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.heroLeft}>
            <View style={styles.heroHeaderRow}>
              <Text style={styles.heroLabel}>Total Revenue</Text>
              <View style={styles.heroArrowBadge}>
                <Text style={styles.heroArrowText}>Analytics</Text>
                <Ionicons name="chevron-forward" size={12} color={C.brandDark} />
              </View>
            </View>
            <Text style={styles.heroAmount}>{formatMoney(totalRevenue)}</Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroChip}>
                <Ionicons name="checkmark-done-circle" size={12} color={C.brand} />
                <Text style={styles.heroChipText}>{completedCount} completed order{completedCount !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={styles.heroMeta}>· {formatMoney(todaysSales)} today</Text>
            </View>
          </View>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="currency-php" size={30} color={C.brand} />
          </View>
        </TouchableOpacity>

        {/* Metric tiles */}
        <View style={styles.tilesRow}>
          <Tile
            icon="time-outline"
            label="Pending"
            value={pendingCount}
            tint={TINTS.orange}
            onPress={() => router.push('/(vendor)/orders')}
            sub="awaiting pickup"
          />
          <Tile
            icon="bag-check"
            label="Ready upcoming"
            value={confirmedCount}
            tint={TINTS.blue}
            onPress={() => router.push('/(vendor)/orders')}
            sub="confirmed & prep"
          />
          <Tile
            icon="cube-outline"
            label="Products"
            value={productsCount}
            tint={TINTS.brand}
            onPress={() => router.push('/(vendor)/products')}
            sub={`${totalUnits} units`}
          />
          <Tile
            icon="alert-circle-outline"
            label="Low stock"
            value={lowStock}
            tint={lowStock > 0 ? TINTS.red : TINTS.brand}
            onPress={() => router.push('/(vendor)/inventory')}
            sub={outStock > 0 ? `${outStock} out of stock` : 'well stocked'}
          />
        </View>

        {/* Recent Orders */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleWrap}>
              <View style={[styles.cardTitleIcon, { backgroundColor: C.blueSoft }]}>
                <Ionicons name="receipt-outline" size={16} color={C.blue} />
              </View>
              <Text style={styles.cardTitle}>Recent Orders</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(vendor)/orders')} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View all</Text>
              <Ionicons name="chevron-forward" size={14} color={C.brand} />
            </TouchableOpacity>
          </View>

          {recentOrders.length === 0 ? (
            <View style={styles.emptyRow}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={26} color={C.muted} />
              </View>
              <View style={styles.emptyTextWrap}>
                <Text style={styles.emptyTitle}>No orders yet</Text>
                <Text style={styles.emptySub}>Fresh orders will appear here the moment customers check out.</Text>
              </View>
            </View>
          ) : (
            recentOrders.map((order) => (
              <OrderRow key={order.id} order={order} onPress={() => router.push('/(vendor)/orders')} />
            ))
          )}
        </View>

        {/* Inventory snapshot */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleWrap}>
              <View style={[styles.cardTitleIcon, { backgroundColor: C.brandSoft }]}>
                <Ionicons name="cube-outline" size={16} color={C.brand} />
              </View>
              <Text style={styles.cardTitle}>Inventory Snapshot</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(vendor)/inventory')} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>Manage</Text>
              <Ionicons name="chevron-forward" size={14} color={C.brand} />
            </TouchableOpacity>
          </View>

          <View style={styles.invStatsRow}>
            <InvStat value={inStock} label="In stock" tint={TINTS.brand} />
            <InvStat value={lowStock} label="Low stock" tint={TINTS.amber} />
            <InvStat value={outStock} label="Out of stock" tint={TINTS.red} />
          </View>

          <View style={styles.invBarTrack}>
            {inStock > 0 && <View style={[styles.invBarSeg, { backgroundColor: C.brand, flex: inStock }]} />}
            {lowStock > 0 && <View style={[styles.invBarSeg, { backgroundColor: C.amber, flex: lowStock }]} />}
            {outStock > 0 && <View style={[styles.invBarSeg, { backgroundColor: C.red, flex: outStock }]} />}
          </View>
        </View>

        {/* Market hours */}
        <View style={styles.marketBar}>
          <View style={styles.marketIcon}>
            <MaterialCommunityIcons name="store-clock" size={18} color={C.brand} />
          </View>
          <View style={styles.marketInfo}>
            <Text style={styles.marketTime}>Open 4:00 AM – 2:00 PM</Text>
            <Text style={styles.marketLocation}>{stallLocation}</Text>
          </View>
          <View style={styles.openBadge}>
            <View style={styles.openDot} />
            <Text style={styles.openText}>Open now</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Sub-components ─── */

function Circles() {
  return (
    <>
      <View style={[styles.deco, styles.decoA]} />
      <View style={[styles.deco, styles.decoB]} />
    </>
  );
}

function Tile({
  icon, label, value, tint, onPress, sub,
}: {
  icon: string; label: string; value: number; tint: Tint; onPress: () => void; sub: string;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.tileIcon, { backgroundColor: tint.bg }]}>
        <Ionicons name={icon as any} size={18} color={tint.color} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>
    </TouchableOpacity>
  );
}

function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const cfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const customerName = order.user?.name ?? 'Customer';
  const time = new Date(order.created_at).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <TouchableOpacity style={styles.orderRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.orderAvatar, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.orderAvatarText, { color: cfg.color }]}>
          {customerName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.orderInfo}>
        <Text style={styles.orderName} numberOfLines={1}>{customerName}</Text>
        <Text style={styles.orderMeta}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {time}
        </Text>
      </View>
      <View style={styles.orderRight}>
        <Text style={styles.orderAmount}>{formatMoney(vendorTotal(order))}</Text>
        <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function InvStat({ value, label, tint }: { value: number; label: string; tint: Tint }) {
  return (
    <View style={styles.invStat}>
      <View style={[styles.invStatDot, { backgroundColor: tint.color }]} />
      <Text style={styles.invStatValue}>{value}</Text>
      <Text style={styles.invStatLabel}>{label}</Text>
    </View>
  );
}

/* ─── Helpers ─── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function vendorTotal(order: Order): number {
  return round2(order.items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number): string {
  const fixed = value.toFixed(2);
  const [whole, decimals] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱${grouped}.${decimals}`;
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  /* Header */
  headerWrap: {
    backgroundColor: C.header,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  safeHeader: {},
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 26,
    backgroundColor: C.header,
  },
  deco: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decoA: { width: 180, height: 180, top: -80, right: -40 },
  decoB: { width: 90, height: 90, top: 40, left: -30 },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileHalo: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  profileInitial: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  headerTitles: { flex: 1 },
  headerEyebrow: { fontSize: 11, color: '#B8F0D4', fontWeight: '600' },
  headerName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.orange,
    borderWidth: 1.5,
    borderColor: C.header,
  },
  greetingText: { fontSize: 14, color: '#D6F5E5', fontWeight: '600', marginTop: 16 },
  headline: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },

  /* Loading */
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: C.muted, fontWeight: '500' },

  /* Body */
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24, gap: 14 },

  /* Hero */
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#0B8F60',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: C.line,
  },
  heroLeft: { flex: 1 },
  heroHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 10 },
  heroLabel: { fontSize: 13, fontWeight: '600', color: C.muted },
  heroArrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: C.brandSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroArrowText: { fontSize: 10, fontWeight: '700', color: C.brandDark },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: C.ink,
    marginTop: 6,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.brandSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroChipText: { fontSize: 11, fontWeight: '700', color: C.brandDark },
  heroMeta: { fontSize: 11, color: C.muted, fontWeight: '600', marginLeft: 4 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Tiles */
  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileValue: { fontSize: 22, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 11, fontWeight: '600', color: C.sub, marginTop: 2 },
  tileSub: { fontSize: 10, color: C.muted, marginTop: 2 },

  /* Cards */
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 12, fontWeight: '700', color: C.brand },

  /* Orders */
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 14,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextWrap: { flex: 1 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  emptySub: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 16 },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  orderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderAvatarText: { fontSize: 16, fontWeight: '800' },
  orderInfo: { flex: 1 },
  orderName: { fontSize: 14, fontWeight: '700', color: C.ink },
  orderMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderAmount: { fontSize: 14, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7 },
  pillText: { fontSize: 9, fontWeight: '800' },

  /* Inventory */
  invStatsRow: { flexDirection: 'row', gap: 8 },
  invStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.bg,
    borderRadius: 14,
    paddingVertical: 12,
  },
  invStatDot: { width: 8, height: 8, borderRadius: 4 },
  invStatValue: { fontSize: 18, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  invStatLabel: { fontSize: 10, fontWeight: '600', color: C.sub },
  invBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#E8EEE9',
    marginTop: 12,
  },
  invBarSeg: { height: '100%' },

  /* Market bar */
  marketBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.line,
  },
  marketIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketInfo: { flex: 1 },
  marketTime: { fontSize: 14, fontWeight: '800', color: C.ink },
  marketLocation: { fontSize: 11, color: C.muted, marginTop: 2 },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.brandSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brand },
  openText: { fontSize: 11, fontWeight: '700', color: C.brandDark },
});