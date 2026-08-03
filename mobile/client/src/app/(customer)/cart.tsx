/**
 * Cart — customer shopping cart with persistent state + Place Order flow.
 *
 * Features:
 *  - Quantity controls, swipe-to-remove
 *  - Payment method selector (Cash / GCash / Maya)
 *  - Place Order → loading indicator → stock validation → DB save → inventory deduction
 *  - Order Confirmation modal with order details
 *  - All errors shown inline (stock issues, network errors)
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart, type CartItem } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/services/auth';
import { placeOrder, ORDER_STATUS_CONFIG, type Order } from '@/services/orders';
import { ApiError } from '@/services/api';

type PaymentMethod = 'cash' | 'gcash' | 'maya';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string; color: string }[] = [
  { value: 'cash',  label: 'Cash on Pickup',  icon: 'cash-outline',   color: '#16A34A' },
  { value: 'gcash', label: 'GCash',           icon: 'phone-portrait-outline', color: '#2563EB' },
  { value: 'maya',  label: 'Maya',            icon: 'card-outline',   color: '#7C3AED' },
];

export default function CartScreen() {
  const { items, totalItems, totalPrice, clearCart } = useCart();
  const { token } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  async function handlePlaceOrder() {
    // Read token directly from AsyncStorage — never blocked by context hydration timing
    const authToken = token ?? await getToken();

    if (!authToken) {
      Alert.alert('Sign In Required', 'Please sign in to place an order.');
      return;
    }
    if (items.length === 0) return;

    setPlacing(true);
    setErrorMsg(null);

    try {
      const order = await placeOrder(
        {
          items: items.map((i) => ({
            product_id:   i.product_id,
            product_name: i.product_name,
            quantity:     i.quantity,
          })),
          payment_method: paymentMethod,
        },
        authToken,
      );

      clearCart();
      setConfirmedOrder(order);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not place order. Please check your connection and try again.';
      setErrorMsg(msg);
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0 && !confirmedOrder) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cart-outline" size={56} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse the marketplace and add products to get started.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Cart</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={clearCart} disabled={placing}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Item count */}
      <View style={styles.itemCountRow}>
        <Ionicons name="bag-outline" size={15} color="#6B7280" />
        <Text style={styles.itemCountText}>
          {totalItems} item{totalItems !== 1 ? 's' : ''} · Taguig People's Market
        </Text>
      </View>

      {/* Error Banner */}
      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => setErrorMsg(null)}>
            <Ionicons name="close" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cart Items */}
        {items.map((item) => (
          <CartItemCard key={item.product_id} item={item} disabled={placing} />
        ))}

        {/* Payment Method */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentGrid}>
            {PAYMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.paymentOption,
                  paymentMethod === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '10' },
                ]}
                onPress={() => setPaymentMethod(opt.value)}
                disabled={placing}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={20}
                  color={paymentMethod === opt.value ? opt.color : '#9CA3AF'}
                />
                <Text
                  style={[
                    styles.paymentLabel,
                    paymentMethod === opt.value && { color: opt.color, fontWeight: '700' },
                  ]}
                >
                  {opt.label}
                </Text>
                {paymentMethod === opt.value && (
                  <View style={[styles.paymentCheck, { backgroundColor: opt.color }]}>
                    <Ionicons name="checkmark" size={10} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spacer for the fixed summary card */}
        <View style={{ height: 220 }} />
      </ScrollView>

      {/* Order Summary + Place Order */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₱{totalPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Market fee</Text>
          <Text style={styles.summaryValue}>₱0.00</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotal}>Total</Text>
          <Text style={styles.summaryTotalValue}>₱{totalPrice.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutBtn, placing && styles.checkoutBtnDisabled]}
          onPress={handlePlaceOrder}
          disabled={placing}
          activeOpacity={0.85}
        >
          {placing ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.checkoutBtnText}>Placing Order…</Text>
            </>
          ) : (
            <>
              <Ionicons name="bag-check-outline" size={20} color="#FFFFFF" />
              <Text style={styles.checkoutBtnText}>Place Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Order Confirmation Modal */}
      {confirmedOrder && (
        <OrderConfirmationModal
          order={confirmedOrder}
          onClose={() => {
            setConfirmedOrder(null);
          }}
          onViewOrders={() => {
            setConfirmedOrder(null);
            router.push('/(customer)/orders');
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── Cart Item Card ─── */

function CartItemCard({ item, disabled }: { item: CartItem; disabled: boolean }) {
  const { updateQuantity, removeItem } = useCart();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function handleRemove() {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
      () => removeItem(item.product_id),
    );
  }

  function handleDecrement() {
    if (item.quantity === 1) handleRemove();
    else updateQuantity(item.product_id, item.quantity - 1);
  }

  return (
    <Animated.View style={[styles.itemCard, { opacity: fadeAnim }]}>
      <View style={styles.itemIcon}>
        <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.itemMeta}>{item.category} · per {item.unit}</Text>
        <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
      </View>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={handleDecrement} disabled={disabled}>
          <Ionicons
            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
            size={14}
            color={item.quantity === 1 ? '#DC2626' : '#374151'}
          />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          style={[styles.qtyBtn, styles.qtyBtnAdd]}
          onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
          disabled={disabled}
        >
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/* ─── Order Confirmation Modal ─── */

function OrderConfirmationModal({
  order,
  onClose,
  onViewOrders,
}: {
  order: Order;
  onClose: () => void;
  onViewOrders: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  const statusCfg = ORDER_STATUS_CONFIG[order.status];
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + 1);
  const estimatedStr = estimatedDate.toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <Modal visible transparent animationType="none">
      <View style={confirmStyles.backdrop}>
        <Animated.View
          style={[confirmStyles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
        >
          {/* Success Icon */}
          <View style={confirmStyles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
          </View>

          <Text style={confirmStyles.title}>Order Placed!</Text>
          <Text style={confirmStyles.subtitle}>Your order is being prepared by the vendor.</Text>

          {/* Order Number */}
          <View style={confirmStyles.orderNumBox}>
            <Text style={confirmStyles.orderNumLabel}>Order Number</Text>
            <Text style={confirmStyles.orderNum}>{order.order_number}</Text>
          </View>

          <ScrollView
            style={confirmStyles.itemsScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Items */}
            <Text style={confirmStyles.sectionLabel}>Items Ordered</Text>
            {order.items.map((item) => (
              <View key={item.id} style={confirmStyles.itemRow}>
                <Text style={confirmStyles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
                <View style={confirmStyles.itemInfo}>
                  <Text style={confirmStyles.itemName} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={confirmStyles.itemMeta}>×{item.quantity} {item.unit}</Text>
                </View>
                <Text style={confirmStyles.itemSubtotal}>₱{Number(item.subtotal).toFixed(2)}</Text>
              </View>
            ))}

            {/* Summary */}
            <View style={confirmStyles.summaryBox}>
              <View style={confirmStyles.summaryRow}>
                <Text style={confirmStyles.summaryLabel}>Total Amount</Text>
                <Text style={confirmStyles.summaryValue}>₱{Number(order.total_amount).toFixed(2)}</Text>
              </View>
              <View style={confirmStyles.summaryRow}>
                <Text style={confirmStyles.summaryLabel}>Payment</Text>
                <Text style={confirmStyles.summaryValue}>
                  {order.payment_method.toUpperCase()}
                </Text>
              </View>
              <View style={confirmStyles.summaryRow}>
                <Text style={confirmStyles.summaryLabel}>Status</Text>
                <View style={[confirmStyles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[confirmStyles.statusText, { color: statusCfg.color }]}>
                    {statusCfg.label}
                  </Text>
                </View>
              </View>
              <View style={confirmStyles.summaryRow}>
                <Text style={confirmStyles.summaryLabel}>Est. Ready By</Text>
                <Text style={confirmStyles.summaryValue}>{estimatedStr}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <TouchableOpacity style={confirmStyles.primaryBtn} onPress={onViewOrders}>
            <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
            <Text style={confirmStyles.primaryBtnText}>View My Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity style={confirmStyles.secondaryBtn} onPress={onClose}>
            <Text style={confirmStyles.secondaryBtnText}>Continue Shopping</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  itemCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, marginBottom: 10,
  },
  itemCountText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '500' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16 },

  itemCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#F3F4F6', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  itemIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  itemEmoji: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#1B6B45', marginTop: 4 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  qtyBtnAdd: { backgroundColor: '#1B6B45', borderColor: '#1B6B45' },
  qtyText: { fontSize: 14, fontWeight: '700', color: '#111827', minWidth: 22, textAlign: 'center' },

  sectionBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  paymentGrid: { gap: 8 },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#F3F4F6',
    borderRadius: 12, padding: 12,
  },
  paymentLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  paymentCheck: {
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIconWrap: {
    width: 100, height: 100, borderRadius: 30,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },

  summaryCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  summaryDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  summaryTotal: { fontSize: 16, fontWeight: '800', color: '#111827' },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: '#1B6B45' },

  checkoutBtn: {
    backgroundColor: '#1B6B45', borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14,
    shadowColor: '#1B6B45', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  checkoutBtnDisabled: { backgroundColor: '#6B7280', shadowOpacity: 0, elevation: 0 },
  checkoutBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

/* ─── Confirmation Modal Styles ─── */

const confirmStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24,
    width: '100%', maxHeight: '90%',
    padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 30, elevation: 20,
  },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 16 },

  orderNumBox: {
    backgroundColor: '#F0FDF4', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#DCFCE7', width: '100%',
  },
  orderNumLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  orderNum: { fontSize: 18, fontWeight: '800', color: '#16A34A', marginTop: 2 },

  itemsScroll: { width: '100%', maxHeight: 300 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10,
  },
  itemEmoji: { fontSize: 20 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF' },
  itemSubtotal: { fontSize: 14, fontWeight: '700', color: '#1B6B45' },

  summaryBox: {
    backgroundColor: '#F9FAFB', borderRadius: 14,
    padding: 14, marginTop: 12, gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: '#6B7280' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  primaryBtn: {
    backgroundColor: '#1B6B45', borderRadius: 14, height: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', marginTop: 16,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  secondaryBtn: { paddingVertical: 12, marginTop: 6 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
