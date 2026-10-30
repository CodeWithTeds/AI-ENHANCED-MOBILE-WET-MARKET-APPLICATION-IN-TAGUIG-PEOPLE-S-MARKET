/**
 * Order Tracking — real-time status timeline for a placed order.
 *
 * Features:
 *  - Polls /orders/{id}/track every 5 seconds while the screen is focused
 *  - Vertical status timeline (Pending → Confirmed → Processing → Ready → Completed)
 *  - "Live" pulsing indicator on the current step
 *  - Refreshes when the app returns to the foreground
 *  - Items list with vendor stall names
 *  - "Rate your purchase" section (enabled only for COMPLETED orders):
 *    rate the vendors and products from this order
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getCategoryEmoji } from '@/constants/categories';
import { getCustomerToken } from '@/services/customer-auth';
import {
  getOrderTracking,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
} from '@/services/orders';
import {
  getEligibleReviews,
  type EligibleOrder,
} from '@/services/reviews';
import { ReviewSheet } from '@/components/customer/ReviewSheet';
import { OrderChatModal } from '@/components/chat/OrderChatModal';
import { ApiError } from '@/services/api';
import { getProductImageUrl } from '@/utils/image';

const STATUS_STEPS: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed'];
const POLL_INTERVAL_MS = 5000;

export default function OrderTrackingScreen() {
  const { id, rate } = useLocalSearchParams<{ id: string; rate?: string }>();
  const orderId = Number(id);

  const { token } = useCustomerAuth();
  const getAuthToken = async () => token ?? await getCustomerToken();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [eligible, setEligible] = useState<EligibleOrder | null>(null);
  const [activeChatVendor, setActiveChatVendor] = useState<{ id: number; stall_name: string } | null>(null);
  const [currentToken, setCurrentToken] = useState<string>('');

  const fetchTracking = useCallback(async () => {
    const authToken = await getAuthToken();
    if (!authToken || !orderId) return;
    setCurrentToken(authToken);
    try {
      const data = await getOrderTracking(orderId, authToken);
      setOrder(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Order not found.');
      } else {
        setError('Could not load tracking. Pull down to retry.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, token]);

  /* Real-time: poll every 5s while screen is focused */
  useFocusEffect(
    useCallback(() => {
      fetchTracking();
      const interval = setInterval(fetchTracking, POLL_INTERVAL_MS);

      // Also refresh immediately when the app comes back to the foreground
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') fetchTracking();
      });

      return () => {
        clearInterval(interval);
        sub.remove();
      };
    }, [fetchTracking])
  );

  /* Fetch what's reviewable once the order is completed */
  useEffect(() => {
    if (order?.status !== 'completed') return;
    (async () => {
      const authToken = await getAuthToken();
      if (!authToken) return;
      try {
        const list = await getEligibleReviews(authToken);
        const mine = (list ?? []).find((e) => e.order_id === order.id);
        setEligible(mine ?? null);
      } catch {
        /* non-fatal — review section just won't know prior reviews */
      }
    })();
  }, [order?.status, order?.id]);

  /* Auto-open the rating sheet when arriving from the "Rate Your Purchase" button */
  useEffect(() => {
    if (order?.status === 'completed' && rate === '1') {
      setReviewSheetOpen(true);
    }
  }, [order?.status, rate]);

  function onRefresh() {
    setRefreshing(true);
    fetchTracking();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B6B45" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <Header orderNumber="Tracking" />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#D1D5DB" />
          <Text style={styles.errorText}>{error ?? 'Order not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted = order.status === 'completed';
  const isCancelled = order.status === 'cancelled';

  return (
    <SafeAreaView style={styles.container}>
      <Header orderNumber={order.order_number} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B6B45" />}
      >
        {/* Current status banner */}
        <StatusBanner order={order} />

        {/* COD Confirmation Required Card */}
        {order.payment_method === 'cash' && (order.confirmation_status === 'pending_confirmation' || order.status === 'pending_confirmation') && (
          <View style={styles.codCard}>
            <View style={styles.codHeaderRow}>
              <View style={styles.codIconWrap}>
                <Ionicons name="alert-circle" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.codTitle}>Order Confirmation Required (COD)</Text>
                <Text style={styles.codSub}>
                  Vendors require your confirmation before butchering and preparing fresh items. Please confirm in the order chat.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.codChatBtn}
              activeOpacity={0.85}
              onPress={() => {
                const vendorItem = order.items.find((i) => !!i.vendor) ?? order.items[0];
                const vId = vendorItem?.vendor?.id ?? vendorItem?.vendor_id ?? 1;
                const vName = vendorItem?.vendor?.stall_name ?? 'Vendor';
                setActiveChatVendor({ id: vId, stall_name: vName });
              }}
            >
              <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
              <Text style={styles.codChatBtnText}>Open Order Chat to Confirm</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payment verification status for GCash/Maya */}
        {(order.payment_method === 'gcash' || order.payment_method === 'maya') && order.payment_status && (
          <View style={[styles.card, { borderColor: (PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.color ?? '#9CA3AF') + '30', borderWidth: 1.5 }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name={(PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.icon as any) ?? 'card-outline'} size={16} color={PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.color ?? '#6B7280'} />
              <Text style={styles.cardTitle}>Payment — {PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.label ?? order.payment_status}</Text>
              <View style={[styles.liveBadge, { backgroundColor: PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.bg ?? '#F3F4F6' }]}>
                <Text style={[styles.liveText, { color: PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.color ?? '#6B7280' }]}>{order.payment_method.toUpperCase()}</Text>
              </View>
            </View>
            {order.payment_reference_number ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Reference</Text>
                <Text style={styles.paymentValue}>{order.payment_reference_number}</Text>
              </View>
            ) : null}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Status</Text>
              <Text style={[styles.paymentValue, { color: PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.color }]}>{PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]?.label}</Text>
            </View>
            {order.payment_status === 'pending_verification' && (
              <View style={styles.paymentHintBox}>
                <Ionicons name="hourglass-outline" size={14} color="#D97706" />
                <Text style={styles.paymentHintText}>Payment is pending vendor verification. It will become Paid only after the vendor confirms in their GCash/Maya app — not automatically.</Text>
              </View>
            )}
            {order.payment_status === 'paid' && order.payment_verified_at && (
              <View style={styles.paymentHintBoxSuccess}>
                <Ionicons name="checkmark-done-circle" size={14} color="#16A34A" />
                <Text style={styles.paymentHintTextSuccess}>Verified as Paid on {formatDateTime(order.payment_verified_at)}</Text>
              </View>
            )}
            {order.payment_status === 'rejected' && (
              <View style={styles.paymentHintBoxError}>
                <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                <Text style={styles.paymentHintTextError}>Payment rejected — please contact the vendor or resubmit a valid reference via Orders.</Text>
              </View>
            )}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="pulse-outline" size={16} color="#1B6B45" />
            <Text style={styles.cardTitle}>Order Progress</Text>
            {!isCancelled && <LiveBadge />}
          </View>
          <Timeline order={order} />
        </View>

        {/* Items */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="cube-outline" size={16} color="#1B6B45" />
            <Text style={styles.cardTitle}>Items</Text>
            <Text style={styles.cardTotal}>₱{Number(order.total_amount).toFixed(2)}</Text>
          </View>
          {order.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onChatVendor={(vendorId, stallName) => {
                setActiveChatVendor({ id: vendorId, stall_name: stallName });
              }}
            />
          ))}
        </View>

        {/* Rate your purchase — only for completed orders */}
        {isCompleted && (
          <TouchableOpacity
            style={styles.rateBtn}
            activeOpacity={0.85}
            onPress={() => setReviewSheetOpen(true)}
          >
            <Ionicons name="star" size={18} color="#FFFFFF" />
            <Text style={styles.rateBtnText}>Rate Your Purchase</Text>
            <Text style={styles.rateBtnSub}>
              {eligible ? countUnreviewed(eligible) : 'Share your experience'}
            </Text>
          </TouchableOpacity>
        )}

        {isCancelled && (
          <View style={styles.cancelledNote}>
            <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
            <Text style={styles.cancelledNoteText}>
              This order was cancelled. Contact the market administrator if you have questions.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Review bottom sheet */}
      {isCompleted && (
        <ReviewSheet
          visible={reviewSheetOpen}
          onClose={() => setReviewSheetOpen(false)}
          order={order}
          eligible={eligible}
          onSubmitted={() => {
            setReviewSheetOpen(false);
            setEligible(null);
          }}
        />
      )}
      {/* In-App Customer-Vendor Order Chat Modal */}
      {activeChatVendor && currentToken ? (
        <OrderChatModal
          visible={true}
          orderId={order.id}
          vendorId={activeChatVendor.id}
          token={currentToken}
          userRole="customer"
          stallName={activeChatVendor.stall_name}
          orderNumber={order.order_number}
          isCod={order.payment_method === 'cash'}
          onClose={() => setActiveChatVendor(null)}
          onStatusUpdated={() => fetchTracking()}
        />
      ) : null}
    </SafeAreaView>
  );
}

/* ─── Header ─── */

function Header({ orderNumber }: { orderNumber: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={20} color="#111827" />
      </TouchableOpacity>
      <View style={styles.headerTextWrap}>
        <Text style={styles.headerTitle}>Track Order</Text>
        <Text style={styles.headerSub}>{orderNumber}</Text>
      </View>
    </View>
  );
}

/* ─── Status banner ─── */

function StatusBanner({ order }: { order: Order }) {
  const cfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];

  if (order.status === 'cancelled') {
    return (
      <View style={[styles.statusBanner, { backgroundColor: '#FEE2E2' }]}>
        <Ionicons name="close-circle" size={22} color="#DC2626" />
        <View>
          <Text style={[styles.statusBannerLabel, { color: '#DC2626' }]}>Cancelled</Text>
          <Text style={[styles.statusBannerSub, { color: '#B91C1C' }]}>
            This order was cancelled
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
      <View>
        <Text style={[styles.statusBannerLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <Text style={[styles.statusBannerSub, { color: cfg.color, opacity: 0.8 }]}>
          Updated {formatDateTime(order.updated_at)}
        </Text>
      </View>
    </View>
  );
}

/* ─── Live badge ─── */

function LiveBadge() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.liveBadge}>
      <Animated.View style={[styles.liveDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

/* ─── Timeline ─── */

function Timeline({ order }: { order: Order }) {
  const history = order.status_history ?? [];
  const currentIndex = STATUS_STEPS.indexOf(order.status as OrderStatus);
  const hasEntry = (status: OrderStatus) => history.find((h) => h.status === status);
  const timestampFor = (status: OrderStatus): string | null => {
    const entry = history.find((h) => h.status === status);
    return entry ? formatDateTime(entry.created_at) : null;
  };

  return (
    <View style={styles.timeline}>
      {STATUS_STEPS.map((status, index) => {
        const done = index < currentIndex || order.status === 'completed';
        const current = index === currentIndex && order.status !== 'completed';
        const entry = hasEntry(status);

        return (
          <View key={status} style={styles.timelineRow}>
            {/* Icon column + connector */}
            <View style={styles.timelineIconCol}>
              {current ? (
                <PulsingDot />
              ) : (
                <View style={[styles.timelineIcon, done && styles.timelineIconDone]}>
                  <Ionicons
                    name={done ? 'checkmark' : 'ellipse-outline'}
                    size={13}
                    color={done ? '#FFFFFF' : '#D1D5DB'}
                  />
                </View>
              )}
              {index < STATUS_STEPS.length - 1 && (
                <View style={[styles.timelineConnector, done && styles.timelineConnectorDone]} />
              )}
            </View>

            {/* Label column */}
            <View style={styles.timelineLabelCol}>
              <Text style={[styles.timelineLabel, (done || current) && styles.timelineLabelActive]}>
                {ORDER_STATUS_CONFIG[status].label}
              </Text>
              <Text style={styles.timelineTime}>
                {timestampFor(status) ?? (entry ? 'Completed' : 'Waiting')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PulsingDot() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.timelineIcon,
        styles.timelineIconCurrent,
        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
      ]}
    >
      <Ionicons name="ellipse" size={10} color="#FFFFFF" />
    </Animated.View>
  );
}

/* ─── Item row ─── */

function ItemRow({
  item,
  onChatVendor,
}: {
  item: OrderItem;
  onChatVendor?: (vendorId: number, stallName: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getProductImageUrl(item.product?.image);
  const stallName = item.vendor?.stall_name ?? `Vendor #${item.vendor_id}`;

  return (
    <View style={styles.itemRow}>
      {imageUrl && !imageFailed ? (
        <View style={styles.itemImageWrap}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.itemImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        </View>
      ) : (
        <View style={styles.itemEmojiWrap}>
          <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.itemMeta}>
          ×{item.quantity} {item.unit} · {stallName}
        </Text>
      </View>

      <View style={styles.itemRightAction}>
        <Text style={styles.itemSubtotal}>₱{Number(item.subtotal).toFixed(2)}</Text>
        {onChatVendor && (
          <TouchableOpacity
            style={styles.itemChatSmallBtn}
            onPress={() => onChatVendor(item.vendor_id, stallName)}
            accessibilityLabel={`Chat with ${stallName}`}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={12} color="#059669" />
            <Text style={styles.itemChatSmallText}>Chat</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── Helpers ─── */

function countUnreviewed(eligible: EligibleOrder): string {
  const vendors = eligible.vendors.filter((v) => !v.reviewed).length;
  const products = eligible.products.filter((p) => !p.reviewed).length;
  const total = vendors + products;
  return total === 0 ? 'Thanks for rating!' : `${total} review${total > 1 ? 's' : ''} remaining`;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statusBannerLabel: { fontSize: 16, fontWeight: '800' },
  statusBannerSub: { fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#111827' },
  cardTotal: { fontSize: 15, fontWeight: '800', color: '#1B6B45' },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#15803D', letterSpacing: 0.5 },

  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', minHeight: 52 },
  timelineIconCol: { alignItems: 'center', width: 28 },
  timelineIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  timelineIconCurrent: { backgroundColor: '#1B6B45', borderColor: '#1B6B45' },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  timelineConnectorDone: { backgroundColor: '#16A34A' },
  timelineLabelCol: { flex: 1, paddingLeft: 10, paddingTop: 3 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  timelineLabelActive: { color: '#111827', fontWeight: '700' },
  timelineTime: { fontSize: 11, color: '#D1D5DB', marginTop: 1 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  itemImageWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemImage: { width: '100%', height: '100%' },
  itemEmojiWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  itemSubtotal: { fontSize: 13, fontWeight: '700', color: '#1B6B45' },

  rateBtn: {
    backgroundColor: '#1B6B45',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  rateBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  rateBtnSub: { marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  paymentLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  paymentValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  paymentHintBox: { flexDirection: 'row', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FDE68A', marginTop: 8, alignItems: 'flex-start' },
  paymentHintText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 14 },
  paymentHintBoxSuccess: { flexDirection: 'row', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#DCFCE7', marginTop: 8, alignItems: 'center' },
  paymentHintTextSuccess: { flex: 1, fontSize: 11, color: '#15803D', fontWeight: '600' },
  paymentHintBoxError: { flexDirection: 'row', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FECACA', marginTop: 8, alignItems: 'center' },
  paymentHintTextError: { flex: 1, fontSize: 11, color: '#B91C1C', lineHeight: 14 },

  cancelledNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
  },
  cancelledNoteText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },

  /* COD Confirmation card */
  codCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  codHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  codIconWrap: {
    marginTop: 2,
  },
  codTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  codSub: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  codChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
  },
  codChatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemRightAction: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemChatSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  itemChatSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
});
