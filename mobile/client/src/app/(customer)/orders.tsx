/**
 * Orders — customer order history with live status badges + payment verification.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getCustomerToken } from '@/services/customer-auth';
import {
  getOrders,
  submitPaymentReference,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from '@/services/orders';
import { ApiError } from '@/services/api';
import { OrderChatModal } from '@/components/chat/OrderChatModal';
import { ReviewSheet } from '@/components/customer/ReviewSheet';
import { getEligibleReviews, type EligibleOrder } from '@/services/reviews';
import { getProductImageUrl } from '@/utils/image';
import { getCategoryEmoji } from '@/constants/categories';

export default function OrdersScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { token } = useCustomerAuth();

  const getAuthToken = async () => token ?? await getCustomerToken();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatOrder, setChatOrder] = useState<{ order: Order; vendorId: number; stallName: string } | null>(null);
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [eligibleList, setEligibleList] = useState<EligibleOrder[]>([]);
  const [currentToken, setCurrentToken] = useState<string>('');

  const fetchOrders = useCallback(async () => {
    const authToken = await getAuthToken();
    if (!authToken) { setLoading(false); return; }
    setCurrentToken(authToken);
    try {
      const [result, eligible] = await Promise.all([
        getOrders(authToken),
        getEligibleReviews(authToken).catch(() => [] as EligibleOrder[]),
      ]);
      setOrders(result.data ?? []);
      setEligibleList(eligible ?? []);
      setError(null);
    } catch {
      setError('Could not load orders. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  // Focus and expand order if navigated with ?focus=[orderId]
  useEffect(() => {
    const orderId = Number(focus);
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    setExpandedId(orderId);
  }, [focus]);

  function onRefresh() {
    setRefreshing(true);
    fetchOrders();
  }

  function handleUpdated(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Orders</Text>
          <Text style={styles.headerSub}>
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.reportsBtn}
          onPress={() => router.push('/(customer)/reports' as any)}
          activeOpacity={0.8}
          accessibilityLabel="View Reports"
        >
          <Ionicons name="bar-chart-outline" size={16} color="#1B6B45" />
          <Text style={styles.reportsBtnText}>Reports</Text>
        </TouchableOpacity>
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
          orders.map((order) => {
            const orderEligible = eligibleList.find((e) => e.order_id === order.id);
            const canRate = orderEligible
              ? orderEligible.vendors.some((v) => !v.reviewed) || orderEligible.products.some((p) => !p.reviewed)
              : false;

            return (
              <OrderCard
                key={order.id}
                order={order}
                expanded={expandedId === order.id}
                onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                onUpdated={handleUpdated}
                getToken={getAuthToken}
                canRate={canRate}
                onOpenChat={(ord) => {
                  const firstVendor = ord.items.find((i) => !!i.vendor) ?? ord.items[0];
                  const vId = firstVendor?.vendor?.id ?? firstVendor?.vendor_id ?? 1;
                  const vName = firstVendor?.vendor?.stall_name ?? 'Vendor Stall';
                  setChatOrder({ order: ord, vendorId: vId, stallName: vName });
                }}
                onRate={(ord) => setRatingOrder(ord)}
              />
            );
          })
        )}
      </ScrollView>

      {/* In-App Order Chat Modal */}
      {chatOrder && currentToken ? (
        <OrderChatModal
          visible={true}
          orderId={chatOrder.order.id}
          vendorId={chatOrder.vendorId}
          token={currentToken}
          userRole="customer"
          stallName={chatOrder.stallName}
          orderNumber={chatOrder.order.order_number}
          isCod={chatOrder.order.payment_method === 'cash'}
          onClose={() => setChatOrder(null)}
          onStatusUpdated={() => fetchOrders()}
        />
      ) : null}

      {/* Rate Your Purchase Modal */}
      {ratingOrder && (
        <ReviewSheet
          visible={!!ratingOrder}
          onClose={() => setRatingOrder(null)}
          order={ratingOrder}
          eligible={eligibleList.find((e) => e.order_id === ratingOrder.id) ?? null}
          onSubmitted={() => {
            setRatingOrder(null);
            fetchOrders();
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── Order Card ─── */

function OrderCard({
  order: initialOrder,
  expanded,
  onToggle,
  onUpdated,
  getToken,
  onOpenChat,
  onRate,
  canRate = false,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: (o: Order) => void;
  getToken: () => Promise<string | null>;
  onOpenChat?: (order: Order) => void;
  onRate?: (order: Order) => void;
  canRate?: boolean;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [refInput, setRefInput] = useState('');
  const [portionRefInputs, setPortionRefInputs] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Keep local order in sync if parent updates
  useEffect(() => setOrder(initialOrder), [initialOrder]);

  const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const paymentStatus = (order.payment_status as PaymentStatus) ?? 'unpaid';
  const paymentCfg = PAYMENT_STATUS_CONFIG[paymentStatus] ?? PAYMENT_STATUS_CONFIG.unpaid;
  const isEwallet = order.payment_method === 'gcash' || order.payment_method === 'maya';

  const date = new Date(order.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = new Date(order.created_at).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  });

  async function handleSubmitReference(targetVendorId?: number, customRef?: string) {
    const valueToSubmit = (customRef ?? refInput).trim();
    if (!valueToSubmit) {
      setSubmitError('Enter your GCash/Maya reference number.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const updated = await submitPaymentReference(order.id, valueToSubmit, token, targetVendorId);
      setOrder(updated);
      onUpdated(updated);
      if (targetVendorId) {
        setPortionRefInputs((prev) => ({ ...prev, [targetVendorId]: '' }));
      } else {
        setRefInput('');
      }
      Alert.alert('Submitted', 'Payment proof submitted — pending vendor verification.');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Failed to submit reference';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.card}>
      {/* Top Row */}
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <Text style={styles.orderDate}>{date} · {time}</Text>
        </View>

        <View style={styles.cardHeaderRight}>
          {order.confirmation_status === 'pending_confirmation' && order.status !== 'cancelled' ? (
            <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={12} color="#D97706" />
              <Text style={[styles.statusText, { color: '#D97706' }]}>
                Pending Confirmation
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: statusCfg?.bg ?? '#FEF3C7' }]}>
              <Ionicons name={(statusCfg?.icon as any) ?? 'time-outline'} size={12} color={statusCfg?.color ?? '#D97706'} />
              <Text style={[styles.statusText, { color: statusCfg?.color ?? '#D97706' }]}>
                {statusCfg?.label ?? order.status}
              </Text>
            </View>
          )}
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
          <Ionicons name={isEwallet ? (order.payment_method === 'gcash' ? 'phone-portrait-outline' as any : 'card-outline' as any) : 'cash-outline' as any} size={13} color="#6B7280" />
          <Text style={styles.summaryChipText}>{order.payment_method.toUpperCase()}</Text>
        </View>
        {isEwallet && (
          <View style={[styles.paymentBadge, { backgroundColor: paymentCfg.bg }]}>
            <Ionicons name={paymentCfg.icon as any} size={11} color={paymentCfg.color} />
            <Text style={[styles.paymentBadgeText, { color: paymentCfg.color }]}>{paymentCfg.label}</Text>
          </View>
        )}
        <Text style={styles.cardTotal}>₱{Number(order.total_amount).toFixed(2)}</Text>
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={styles.itemsSection}>
          <View style={styles.itemsDivider} />

          {/* Payment Status Banner for e-wallet */}
          {isEwallet && (
            <View style={[styles.paymentBanner, { backgroundColor: paymentCfg.bg, borderColor: paymentCfg.color + '25' }]}>
              <View style={[styles.paymentBannerIcon, { backgroundColor: paymentCfg.color + '15' }]}>
                <Ionicons name={paymentCfg.icon as any} size={18} color={paymentCfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.paymentBannerLabel, { color: paymentCfg.color }]}>{paymentCfg.label}</Text>
                {order.payment_reference_number ? (
                  <Text style={styles.paymentBannerSub}>Ref: {order.payment_reference_number}</Text>
                ) : paymentStatus === 'unpaid' ? (
                  <Text style={styles.paymentBannerSub}>No reference submitted yet</Text>
                ) : null}
                {paymentStatus === 'pending_verification' && (
                  <Text style={styles.paymentBannerHint}>Awaiting vendor verification — will become Paid only after approval.</Text>
                )}
                {paymentStatus === 'paid' && order.payment_verified_at && (
                  <Text style={styles.paymentBannerHint}>Verified on {new Date(order.payment_verified_at).toLocaleDateString('en-PH')}</Text>
                )}
                {paymentStatus === 'rejected' && (
                  <Text style={[styles.paymentBannerHint, { color: '#B91C1C' }]}>Rejected — please resubmit a valid reference.</Text>
                )}
              </View>
            </View>
          )}

          {/* Multi-Vendor Portions breakdown */}
          {order.vendor_portions && order.vendor_portions.length > 1 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.vendorBreakdownTitle}>Vendor Portions & Payment Statuses</Text>
              {order.vendor_portions.map((portion) => {
                const pCfg = PAYMENT_STATUS_CONFIG[portion.payment_status] ?? PAYMENT_STATUS_CONFIG.unpaid;
                const canSubmit = isEwallet && (portion.payment_status === 'unpaid' || portion.payment_status === 'rejected');

                return (
                  <View key={portion.vendor_id} style={styles.portionSectionCard}>
                    <View style={styles.portionHeader}>
                      <View style={styles.portionStallInfo}>
                        <Text style={styles.portionStallName} numberOfLines={1}>{portion.stall_name}</Text>
                        {portion.stall_location ? (
                          <Text style={styles.portionStallLocation} numberOfLines={1}>{portion.stall_location}</Text>
                        ) : null}
                      </View>
                      <View style={styles.portionAmountBadge}>
                        <Text style={styles.portionAmountText}>₱{Number(portion.subtotal).toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* Status row */}
                    <View style={styles.portionStatusRow}>
                      <View style={[styles.paymentBadge, { backgroundColor: pCfg.bg }]}>
                        <Ionicons name={pCfg.icon as any} size={11} color={pCfg.color} />
                        <Text style={[styles.paymentBadgeText, { color: pCfg.color }]}>{pCfg.label}</Text>
                      </View>
                      {portion.payment_reference_number ? (
                        <Text style={styles.portionRefText}>Ref: {portion.payment_reference_number}</Text>
                      ) : null}
                    </View>

                    {/* Inline Submit reference for this vendor if unpaid or rejected */}
                    {canSubmit && (
                      <View style={styles.portionSubmitBox}>
                        <Text style={styles.portionSubmitLabel}>
                          {portion.payment_status === 'rejected' ? 'Resubmit' : 'Submit'} Reference for {portion.stall_name}
                        </Text>
                        <View style={styles.portionSubmitRow}>
                          <TextInput
                            style={styles.portionSubmitInput}
                            value={portionRefInputs[portion.vendor_id] || ''}
                            onChangeText={(val) => setPortionRefInputs((prev) => ({ ...prev, [portion.vendor_id]: val }))}
                            placeholder={`e.g. GCash Ref`}
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="characters"
                            autoCorrect={false}
                          />
                          <TouchableOpacity
                            style={[styles.portionSubmitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={() => handleSubmitReference(portion.vendor_id, portionRefInputs[portion.vendor_id])}
                            disabled={submitting}
                          >
                            <Text style={styles.portionSubmitBtnText}>{submitting ? '…' : 'Submit'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Items belonging to this vendor */}
                    {portion.items.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <OrderItemThumbnail image={item.product?.image} category={item.category} />
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
                  </View>
                );
              })}
            </View>
          ) : (
            <>
              {/* Submit reference form when unpaid or rejected (Single Vendor) */}
              {isEwallet && (paymentStatus === 'unpaid' || paymentStatus === 'rejected') && (
                <View style={styles.submitRefBox}>
                  <Text style={styles.submitRefTitle}>
                    {paymentStatus === 'rejected' ? 'Resubmit Reference Number' : 'Submit Payment Reference'}
                  </Text>
                  <Text style={styles.submitRefHint}>
                    Enter the reference/transaction ID from your {order.payment_method.toUpperCase()} app after sending ₱{Number(order.total_amount).toFixed(2)}.
                  </Text>
                  <TextInput
                    style={styles.submitRefInput}
                    value={refInput}
                    onChangeText={setRefInput}
                    placeholder={`e.g., 1234567890123`}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {submitError && (
                    <View style={styles.submitError}>
                      <Ionicons name="alert-circle-outline" size={13} color="#DC2626" />
                      <Text style={styles.submitErrorText}>{submitError}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={() => handleSubmitReference()}
                    disabled={submitting}
                    activeOpacity={0.85}
                  >
                    {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send-outline" size={14} color="#FFF" />}
                    <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Reference'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {order.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <OrderItemThumbnail image={item.product?.image} category={item.category} />
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
            </>
          )}
          <View style={styles.itemsTotalRow}>
            <Text style={styles.itemsTotalLabel}>Total</Text>
            <Text style={styles.itemsTotalValue}>
              ₱{Number(order.total_amount).toFixed(2)}
            </Text>
          </View>

          {/* Track + Review actions */}
          {onOpenChat && (
            <TouchableOpacity
              style={styles.chatVendorBtn}
              activeOpacity={0.85}
              onPress={() => onOpenChat(order)}
            >
              <Ionicons name="chatbubbles-outline" size={16} color="#059669" />
              <Text style={styles.chatVendorBtnText}>
                {order.confirmation_status === 'pending_confirmation' ? 'Confirm / Chat with Vendor' : 'Chat with Vendor'}
              </Text>
            </TouchableOpacity>
          )}

          {order.status === 'completed' && canRate && (
            <TouchableOpacity
              style={styles.rateBtn}
              activeOpacity={0.85}
              onPress={() => (onRate ? onRate(order) : router.push(`/(customer)/track/${order.id}?rate=1` as any))}
            >
              <Ionicons name="star" size={16} color="#FFFFFF" />
              <Text style={styles.rateBtnText}>Rate Your Purchase</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.trackBtn, order.status === 'completed' && canRate && styles.trackBtnOutline]}
            activeOpacity={0.85}
            onPress={() => router.push(`/(customer)/track/${order.id}` as any)}
          >
            <Ionicons
              name="pulse-outline"
              size={16}
              color={order.status === 'completed' && canRate ? '#1B6B45' : '#FFFFFF'}
            />
            <Text style={[styles.trackBtnText, order.status === 'completed' && canRate && styles.trackBtnTextOutline]}>
              Track Order
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ─── Helpers ─── */

function OrderItemThumbnail({ image, category }: { image?: string | null; category: string }) {
  const [failed, setFailed] = useState(false);
  const url = getProductImageUrl(image);

  if (url && !failed) {
    return (
      <View style={styles.itemImageWrap}>
        <Image
          source={{ uri: url }}
          style={styles.itemImage}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={styles.itemEmojiWrap}>
      <Text style={styles.itemEmoji}>{getCategoryEmoji(category)}</Text>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  reportsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E7F7EF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B8F0D4',
  },
  reportsBtnText: { fontSize: 12, fontWeight: '800', color: '#1B6B45' },

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
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingBottom: 12, flexWrap: 'wrap',
  },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  summaryChipText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  paymentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  paymentBadgeText: { fontSize: 10, fontWeight: '800' },
  cardTotal: { marginLeft: 'auto', fontSize: 16, fontWeight: '800', color: '#1B6B45' },

  itemsSection: { paddingHorizontal: 14, paddingBottom: 14 },
  itemsDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },

  paymentBanner: {
    flexDirection: 'row', gap: 10, borderRadius: 12, padding: 12,
    borderWidth: 1, marginBottom: 12, alignItems: 'flex-start',
  },
  paymentBannerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  paymentBannerLabel: { fontSize: 13, fontWeight: '800' },
  paymentBannerSub: { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '600' },
  paymentBannerHint: { fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 14 },

  submitRefBox: {
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FDE68A', marginBottom: 12,
  },
  submitRefTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  submitRefHint: { fontSize: 11, color: '#92400E', lineHeight: 15, marginBottom: 8 },
  submitRefInput: {
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#111827', fontWeight: '600',
  },
  submitError: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  submitErrorText: { fontSize: 11, color: '#DC2626', flex: 1 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1B6B45', borderRadius: 10, paddingVertical: 11, marginTop: 10,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  vendorBreakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  portionSectionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  portionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  portionStallInfo: {
    flex: 1,
    marginRight: 8,
  },
  portionStallName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  portionStallLocation: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  portionAmountBadge: {
    alignItems: 'flex-end',
  },
  portionAmountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B6B45',
  },
  portionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  portionRefText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  portionSubmitBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  portionSubmitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  portionSubmitRow: {
    flexDirection: 'row',
    gap: 6,
  },
  portionSubmitInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#111827',
  },
  portionSubmitBtn: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portionSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  itemImageWrap: {
    width: 38, height: 38, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  itemImage: { width: '100%', height: '100%' },
  itemEmojiWrap: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
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

  chatVendorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12,
  },
  chatVendorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
});
