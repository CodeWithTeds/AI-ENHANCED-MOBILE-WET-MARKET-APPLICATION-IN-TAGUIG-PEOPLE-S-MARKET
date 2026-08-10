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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
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
import { getToken } from '@/services/auth';
import {
  getOrderTracking,
  ORDER_STATUS_CONFIG,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@/services/orders';
import {
  getEligibleReviews,
  submitProductReview,
  submitVendorReview,
  type EligibleOrder,
} from '@/services/reviews';
import { StarRating } from '@/components/customer/StarRating';
import { ApiError } from '@/services/api';

const STATUS_STEPS: OrderStatus[] = ['pending', 'confirmed', 'processing', 'ready', 'completed'];
const POLL_INTERVAL_MS = 5000;

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);

  const { token } = useCustomerAuth();
  const getAuthToken = async () => token ?? await getToken();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [eligible, setEligible] = useState<EligibleOrder | null>(null);

  const fetchTracking = useCallback(async () => {
    const authToken = await getAuthToken();
    if (!authToken || !orderId) return;
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
            <ItemRow key={item.id} item={item} />
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

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.itemMeta}>
          ×{item.quantity} {item.unit} · {item.vendor?.stall_name ?? `Vendor #${item.vendor_id}`}
        </Text>
      </View>
      <Text style={styles.itemSubtotal}>₱{Number(item.subtotal).toFixed(2)}</Text>
    </View>
  );
}

/* ─── Review bottom sheet ─── */

function ReviewSheet({
  visible,
  onClose,
  order,
  eligible,
  onSubmitted,
}: {
  visible: boolean;
  onClose: () => void;
  order: Order;
  eligible: EligibleOrder | null;
  onSubmitted: () => void;
}) {
  const { token } = useCustomerAuth();
  const getAuthToken = async () => token ?? await getToken();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [target, setTarget] = useState<{ type: 'vendor' | 'product'; id: number; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const vendors = eligible?.vendors ?? [];
  const products = eligible?.products ?? [];

  function isReviewed(type: 'vendor' | 'product', id: number): boolean {
    if (type === 'vendor') return eligible?.vendors.find((v) => v.id === id)?.reviewed ?? false;
    return eligible?.products.find((p) => p.id === id)?.reviewed ?? false;
  }

  function openTarget(type: 'vendor' | 'product', id: number, name: string) {
    setTarget({ type, id, name });
    setRating(0);
    setComment('');
    setError(null);
  }

  async function handleSubmit() {
    if (!target || rating === 0) return;
    const authToken = await getAuthToken();
    if (!authToken) return;

    setSubmitting(true);
    setError(null);
    try {
      if (target.type === 'vendor') {
        await submitVendorReview(target.id, { rating, comment: comment || undefined, order_id: order.id }, authToken);
      } else {
        await submitProductReview(target.id, { rating, comment: comment || undefined, order_id: order.id }, authToken);
      }
      setDone((prev) => new Set(prev).add(`${target.type}:${target.id}`));
      setTarget(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not submit review. Try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const pendingVendors = vendors.filter((v) => !v.reviewed && !done.has(`vendor:${v.id}`));
  const pendingProducts = products.filter((p) => !p.reviewed && !done.has(`product:${p.id}`));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={sheetStyles.sheet}>
        <View style={sheetStyles.handle} />
        <View style={sheetStyles.header}>
          <Text style={sheetStyles.title}>Rate Your Purchase</Text>
          <Text style={sheetStyles.subtitle}>Order {order.order_number}</Text>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={sheetStyles.content} showsVerticalScrollIndicator={false}>
          {pendingVendors.length === 0 && pendingProducts.length === 0 ? (
            <View style={sheetStyles.allDone}>
              <Ionicons name="checkmark-done-circle" size={44} color="#16A34A" />
              <Text style={sheetStyles.allDoneTitle}>All rated! Salamat!</Text>
              <Text style={sheetStyles.allDoneSub}>
                You've reviewed everything from this order.
              </Text>
              <TouchableOpacity style={sheetStyles.doneBtn} onPress={onSubmitted}>
                <Text style={sheetStyles.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Vendors */}
              {pendingVendors.length > 0 && (
                <>
                  <Text style={sheetStyles.sectionLabel}>Vendors</Text>
                  {pendingVendors.map((vendor) => (
                    <ReviewRow
                      key={`v-${vendor.id}`}
                      icon="storefront-outline"
                      name={vendor.stall_name}
                      meta={vendor.stall_location}
                      onPress={() => openTarget('vendor', vendor.id, vendor.stall_name)}
                    />
                  ))}
                </>
              )}

              {/* Products */}
              {pendingProducts.length > 0 && (
                <>
                  <Text style={[sheetStyles.sectionLabel, { marginTop: 18 }]}>Products</Text>
                  {pendingProducts.map((product) => (
                    <ReviewRow
                      key={`p-${product.id}`}
                      icon="cube-outline"
                      name={product.name}
                      meta={`${product.category} · per ${product.unit} · ₱${Number(product.price).toFixed(2)}`}
                      onPress={() => openTarget('product', product.id, product.name)}
                    />
                  ))}
                </>
              )}

              {/* Rating editor */}
              {target && (
                <View style={sheetStyles.editor}>
                  <Text style={sheetStyles.editorTitle}>Rate {target.name}</Text>
                  <StarRating value={rating} onChange={setRating} size={34} />
                  <TextInput
                    style={sheetStyles.commentInput}
                    placeholder="Share your experience (optional)..."
                    placeholderTextColor="#9CA3AF"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    maxLength={1000}
                  />
                  {error && <Text style={sheetStyles.errorText}>{error}</Text>}
                  <TouchableOpacity
                    style={[sheetStyles.submitBtn, (rating === 0 || submitting) && sheetStyles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={rating === 0 || submitting}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="star" size={16} color="#FFFFFF" />
                        <Text style={sheetStyles.submitBtnText}>Submit Review</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ReviewRow({
  icon,
  name,
  meta,
  onPress,
}: {
  icon: string;
  name: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={sheetStyles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={sheetStyles.rowIcon}>
        <Ionicons name={icon as any} size={18} color="#1B6B45" />
      </View>
      <View style={sheetStyles.rowInfo}>
        <Text style={sheetStyles.rowName} numberOfLines={1}>{name}</Text>
        <Text style={sheetStyles.rowMeta} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={sheetStyles.rowCta}>
        <Ionicons name="star-outline" size={16} color="#F59E0B" />
        <Text style={sheetStyles.rowCtaText}>Rate</Text>
      </View>
    </TouchableOpacity>
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

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    meat: '🥩', fish: '🐟', vegetables: '🥬', fruits: '🍎',
    spices: '🌶️', poultry: '🍗', condiments: '🫙', dairy: '🥛',
    grains: '🌾', herbs: '🌿',
  };
  return map[category.toLowerCase()] ?? '🛒';
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

  cancelledNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
  },
  cancelledNoteText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },
});

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  closeBtn: { position: 'absolute', top: 4, right: 16 },
  content: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 10 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  rowCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  rowCtaText: { fontSize: 12, fontWeight: '700', color: '#B45309' },

  editor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    alignItems: 'center',
  },
  editorTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  commentInput: {
    width: '100%',
    minHeight: 70,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
    marginTop: 12,
  },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1B6B45',
    borderRadius: 12,
    paddingVertical: 13,
    width: '100%',
    marginTop: 12,
  },
  submitBtnDisabled: { backgroundColor: '#A7D4BE' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  allDone: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  allDoneTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 4 },
  allDoneSub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  doneBtn: {
    backgroundColor: '#1B6B45',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 10,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
