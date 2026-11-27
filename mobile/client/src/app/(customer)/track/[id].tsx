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
  Linking,
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
import { getCategoryEmoji, getCategoryImage } from '@/constants/categories';
import { getCustomerToken } from '@/services/customer-auth';
import {
  cancelCustomerOrder,
  canCustomerCancelOrder,
  formatCountdown,
  getOrderTracking,
  getPickupCancelUnlockAt,
  getRemainingSeconds,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
} from '@/services/orders';
import { useNowTick } from '@/hooks/useNowTick';
import {
  getEligibleReviews,
  type EligibleOrder,
} from '@/services/reviews';
import { ReviewSheet } from '@/components/customer/ReviewSheet';
import { OrderChatModal } from '@/components/chat/OrderChatModal';
import { StallComplaintModal, TargetStall } from '@/components/customer/StallComplaintModal';
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
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [targetComplaintStall, setTargetComplaintStall] = useState<TargetStall | null>(null);
  const [cancelling, setCancelling] = useState(false);

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

  const refreshEligible = useCallback(async () => {
    const authToken = await getAuthToken();
    if (!authToken || !order) return;
    try {
      const list = await getEligibleReviews(authToken);
      const mine = (list ?? []).find((e) => e.order_id === order.id);
      setEligible(mine ?? null);
    } catch {
      /* non-fatal — review section just won't know prior reviews */
    }
  }, [order?.id, getAuthToken]);

  const hasRemainingReviews = useMemo(() => {
    if (!eligible) return false;
    const vendors = eligible.vendors.filter((v) => !v.reviewed).length;
    const products = eligible.products.filter((p) => !p.reviewed).length;
    return vendors + products > 0;
  }, [eligible]);

  /* Fetch what's reviewable once the order is completed */
  useEffect(() => {
    if (order?.status !== 'completed') return;
    refreshEligible();
  }, [order?.status, order?.id, refreshEligible]);

  /* Auto-open the rating sheet when arriving from the "Rate Your Purchase" button */
  useEffect(() => {
    if (order?.status === 'completed' && rate === '1' && hasRemainingReviews) {
      setReviewSheetOpen(true);
    }
  }, [order?.status, rate, hasRemainingReviews]);

  function onRefresh() {
    setRefreshing(true);
    fetchTracking();
  }

  const handleCancelOrder = () => {
    if (!order) return;
    Alert.alert(
      'Cancel Order',
      'Cancel this order before the vendor confirms it? Reserved stock will be returned immediately.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            const authToken = await getAuthToken();
            if (!authToken) return;
            setCancelling(true);
            try {
              const updated = await cancelCustomerOrder(
                order.id,
                authToken,
                'Cancelled by customer before vendor confirmation',
              );
              setOrder((prev) => (prev ? { ...prev, ...updated } : updated));
              await fetchTracking();
              Alert.alert('Order Cancelled', 'Your order has been cancelled and stock has been restored.');
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Could not cancel order.';
              Alert.alert('Cannot Cancel Order', msg);
              await fetchTracking();
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const confirmationDeadline =
    order?.status === 'pending' && order.confirmation_status === 'pending_confirmation'
      ? order.confirmation_expires_at
      : null;
  const pickupDeadline = order?.status === 'ready' ? getPickupCancelUnlockAt(order) : null;
  const activeTimerDeadline = confirmationDeadline ?? pickupDeadline;
  const nowMs = useNowTick(
    Boolean(activeTimerDeadline),
    confirmationDeadline,
    confirmationDeadline ? fetchTracking : undefined,
  );
  const confirmationRemaining = getRemainingSeconds(confirmationDeadline, nowMs);
  const pickupRemaining = getRemainingSeconds(pickupDeadline, nowMs);

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

        {/* 1-Hour Countdown Banners */}
        {order.status === 'pending' && order.confirmation_status === 'pending_confirmation' && confirmationRemaining !== null && (
          <View style={styles.timerBannerAmber}>
            <Ionicons name="timer-outline" size={18} color="#D97706" />
            <Text style={styles.timerTextAmber}>
              {confirmationRemaining > 0
                ? `Please confirm within ${formatCountdown(confirmationRemaining)} before automatic cancellation.`
                : '1-hour confirmation window expired — cancelling order…'}
            </Text>
          </View>
        )}

        {order.status === 'ready' && pickupRemaining !== null && (
          <View style={styles.timerBannerGreen}>
            <Ionicons name="time-outline" size={18} color="#15803D" />
            <Text style={styles.timerTextGreen}>
              {pickupRemaining > 0
                ? `Pickup countdown: ${formatCountdown(pickupRemaining)} remaining. Vendor may cancel if unclaimed after 1 hour.`
                : '1 hour has passed since Ready for Pickup. Vendor may now cancel if still unclaimed.'}
            </Text>
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
              onReportStall={(stallInfo) => {
                setTargetComplaintStall(stallInfo);
                setComplaintModalOpen(true);
              }}
            />
          ))}
        </View>

        {/* Customer Cancel Order Action (enabled only while vendor has NOT confirmed) */}
        {!isCompleted && !isCancelled && (
          canCustomerCancelOrder(order) ? (
            <TouchableOpacity
              style={[styles.cancelOrderBtn, cancelling && { opacity: 0.6 }]}
              activeOpacity={0.85}
              disabled={cancelling}
              onPress={handleCancelOrder}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.cancelOrderBtnText}>Cancel Order</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.cancelLockedBtn} accessibilityState={{ disabled: true }}>
              <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />
              <Text style={styles.cancelLockedBtnText}>
                Cancel Order Disabled — Confirmed by Vendor
              </Text>
            </View>
          )
        )}

        {/* Customer Receipt Action Button (Item 9) */}
        <TouchableOpacity
          style={styles.receiptActionBtn}
          activeOpacity={0.85}
          onPress={() => setReceiptModalOpen(true)}
        >
          <View style={styles.receiptActionLeft}>
            <View style={styles.receiptActionIconWrap}>
              <Ionicons name="receipt-outline" size={20} color="#1B6B45" />
            </View>
            <View>
              <Text style={styles.receiptActionTitle}>View Transaction Receipt</Text>
              <Text style={styles.receiptActionSub}>Itemized stall breakdown & payment verification</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Report Stall Concern Action Button (Item 5) */}
        <TouchableOpacity
          style={styles.complaintActionBtn}
          activeOpacity={0.85}
          onPress={() => {
            const firstItem = order.items[0];
            setTargetComplaintStall({
              vendorId: firstItem?.vendor_id,
              stallName: firstItem?.vendor?.stall_name ?? 'Market Vendor',
              stallNumber: firstItem?.vendor?.stall_location,
              sectionName: firstItem?.vendor?.stall_location,
            });
            setComplaintModalOpen(true);
          }}
        >
          <View style={styles.receiptActionLeft}>
            <View style={[styles.receiptActionIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="shield-half-outline" size={20} color="#D97706" />
            </View>
            <View>
              <Text style={styles.receiptActionTitle}>Report Stall Concern</Text>
              <Text style={styles.receiptActionSub}>Report bad smell, sanitation, cleanliness, or obstruction</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Rate your purchase — only for completed orders with unreviewed items */}
        {isCompleted && hasRemainingReviews && (
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
            <Ionicons name="information-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.cancelledNoteText}>
              {order.cancellation_reason
                ? order.cancellation_reason
                : 'This order was cancelled. Contact the market administrator if you have questions.'}
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
            refreshEligible();
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

      {/* Official Transaction Receipt Modal (Item 9) */}
      <Modal
        visible={receiptModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReceiptModalOpen(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalContent}>
            <View style={styles.receiptModalHeader}>
              <View>
                <Text style={styles.receiptOfficialBadge}>TAGUIG CITY PUBLIC MARKET</Text>
                <Text style={styles.receiptModalTitle}>Transaction Receipt</Text>
              </View>
              <TouchableOpacity
                onPress={() => setReceiptModalOpen(false)}
                style={styles.receiptModalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.receiptScroll}>
              <View style={styles.receiptPaper}>
                {/* Header details */}
                <View style={styles.receiptMetaSection}>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaLabel}>Receipt No:</Text>
                    <Text style={styles.receiptMetaValue}>TS-REC-{String(order.id).padStart(6, '0')}</Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaLabel}>Order Ref:</Text>
                    <Text style={styles.receiptMetaValue}>{order.order_number}</Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaLabel}>Date & Time:</Text>
                    <Text style={styles.receiptMetaValue}>{formatDateTime(order.created_at)}</Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaLabel}>Payment Method:</Text>
                    <Text style={[styles.receiptMetaValue, { textTransform: 'uppercase' }]}>{order.payment_method}</Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaLabel}>Payment Status:</Text>
                    <Text style={[styles.receiptMetaValue, { color: order.payment_status === 'paid' ? '#059669' : '#6B7280', fontWeight: '800' }]}>
                      {(order.payment_status || 'unpaid').toUpperCase()}
                    </Text>
                  </View>
                  {order.payment_reference_number ? (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaLabel}>Reference No:</Text>
                      <Text style={[styles.receiptMetaValue, { fontFamily: 'monospace' }]}>{order.payment_reference_number}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Items itemization */}
                <View style={styles.receiptItemsSection}>
                  <Text style={styles.receiptSectionHeader}>PURCHASED PRODUCTS</Text>
                  {order.items.map((item) => (
                    <View key={item.id} style={styles.receiptItemRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.receiptItemName}>{item.product_name}</Text>
                        <Text style={styles.receiptItemStall}>
                          Stall: {item.vendor?.stall_name ?? 'Market Vendor'}
                          {item.vendor?.stall_location ? ` · ${item.vendor.stall_location}` : ''}
                        </Text>
                        <Text style={styles.receiptItemSubText}>
                          {item.quantity} {item.unit} @ ₱{Number(item.unit_price).toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.receiptItemPrice}>
                        ₱{Number(item.subtotal).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Summary */}
                <View style={styles.receiptSummarySection}>
                  <View style={styles.receiptSummaryRow}>
                    <Text style={styles.receiptSummaryLabel}>Subtotal</Text>
                    <Text style={styles.receiptSummaryValue}>₱{Number(order.total_amount).toFixed(2)}</Text>
                  </View>
                  <View style={styles.receiptSummaryRow}>
                    <Text style={styles.receiptSummaryLabel}>Market Processing Fee</Text>
                    <Text style={styles.receiptSummaryValue}>₱0.00</Text>
                  </View>
                  <View style={[styles.receiptSummaryRow, styles.receiptGrandTotalRow]}>
                    <Text style={styles.receiptGrandTotalLabel}>TOTAL AMOUNT</Text>
                    <Text style={styles.receiptGrandTotalValue}>₱{Number(order.total_amount).toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterText}>Taguig Suki · Digital Public Market</Text>
                  <Text style={styles.receiptFooterSub}>General Luna St, Taguig City, Metro Manila</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.receiptModalActions}>
              <TouchableOpacity
                style={styles.receiptDoneBtn}
                onPress={() => setReceiptModalOpen(false)}
              >
                <Text style={styles.receiptDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stall Complaint / Sanitation Report Modal (Item 5) */}
      <StallComplaintModal
        visible={complaintModalOpen}
        onClose={() => {
          setComplaintModalOpen(false);
          setTargetComplaintStall(null);
        }}
        targetStall={targetComplaintStall}
        authToken={currentToken}
      />
    </SafeAreaView>
  );
}

/* ─── Header ─── */

function Header({ orderNumber }: { orderNumber: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(customer)/orders');
          }
        }}
        accessibilityLabel="Go back"
      >
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
    const cancelTitle =
      order.cancelled_by === 'system'
        ? 'Auto-Cancelled (Timeout)'
        : order.cancelled_by === 'vendor'
        ? 'Cancelled by Vendor'
        : 'Cancelled';

    return (
      <View style={[styles.statusBanner, { backgroundColor: '#FEE2E2' }]}>
        <Ionicons name="close-circle" size={22} color="#DC2626" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusBannerLabel, { color: '#DC2626' }]}>{cancelTitle}</Text>
          <Text style={[styles.statusBannerSub, { color: '#B91C1C' }]}>
            {order.cancellation_reason ?? 'This order was cancelled'}
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
  onReportStall,
}: {
  item: OrderItem;
  onChatVendor?: (vendorId: number, stallName: string) => void;
  onReportStall?: (stallInfo: TargetStall) => void;
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
        <View style={styles.itemImageWrap}>
          <Image
            source={getCategoryImage(item.category)}
            style={styles.itemImage}
            resizeMode="cover"
          />
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
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
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
          {onReportStall && (
            <TouchableOpacity
              style={styles.itemReportSmallBtn}
              onPress={() =>
                onReportStall({
                  vendorId: item.vendor_id,
                  stallName,
                  sectionName: item.vendor?.stall_location,
                })
              }
              accessibilityLabel={`Report stall concern for ${stallName}`}
            >
              <Ionicons name="flag-outline" size={12} color="#D97706" />
              <Text style={styles.itemReportSmallText}>Report</Text>
            </TouchableOpacity>
          )}
        </View>
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
  /* Receipt Button */
  receiptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  receiptActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  receiptActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  receiptActionSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  complaintActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    padding: 14,
    marginBottom: 12,
  },
  itemReportSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemReportSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  /* Receipt Modal */
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  receiptModalContent: {
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  receiptModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  receiptOfficialBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  receiptModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  receiptModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptScroll: {
    padding: 16,
  },
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  receiptMetaSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    gap: 6,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptMetaLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  receiptMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  receiptItemsSection: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  receiptSectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  receiptItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  receiptItemStall: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 1,
  },
  receiptItemSubText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  receiptItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  receiptSummarySection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 6,
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptSummaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  receiptSummaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  receiptGrandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    marginTop: 4,
  },
  receiptGrandTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  receiptGrandTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  receiptFooter: {
    alignItems: 'center',
    paddingTop: 14,
    gap: 2,
  },
  receiptFooterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  receiptFooterSub: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  receiptModalActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  receiptDoneBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  receiptDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timerBannerAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  timerTextAmber: { flex: 1, fontSize: 12, fontWeight: '600', color: '#B45309', lineHeight: 17 },
  timerBannerGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  timerTextGreen: { flex: 1, fontSize: 12, fontWeight: '600', color: '#15803D', lineHeight: 17 },
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  cancelOrderBtnText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  cancelLockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  cancelLockedBtnText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
});
