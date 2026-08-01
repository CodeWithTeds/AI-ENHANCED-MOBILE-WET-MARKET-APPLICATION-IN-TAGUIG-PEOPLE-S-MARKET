/**
 * Cart — modern customer shopping cart.
 * Shows items, quantity controls, totals, and checkout action.
 */

import { useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart, type CartItem } from '@/context/CartContext';

export default function CartScreen() {
  const { items, totalItems, totalPrice, clearCart } = useCart();

  if (items.length === 0) {
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
            Search a recipe and add ingredients from the market
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
        <TouchableOpacity style={styles.clearBtn} onPress={clearCart}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Item count */}
      <View style={styles.itemCountRow}>
        <Ionicons name="bag-outline" size={15} color="#6B7280" />
        <Text style={styles.itemCountText}>{totalItems} item{totalItems !== 1 ? 's' : ''} from Taguig People's Market</Text>
      </View>

      {/* Items list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <CartItemCard key={item.product_id} item={item} />
        ))}

        {/* Spacer for summary card */}
        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Order Summary */}
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

        <TouchableOpacity style={styles.checkoutBtn} activeOpacity={0.85}>
          <Ionicons name="bag-check-outline" size={20} color="#FFFFFF" />
          <Text style={styles.checkoutBtnText}>Place Order</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Cart Item Card ─── */

function CartItemCard({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function handleRemove() {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => removeItem(item.product_id));
  }

  function handleDecrement() {
    if (item.quantity === 1) {
      handleRemove();
    } else {
      updateQuantity(item.product_id, item.quantity - 1);
    }
  }

  function handleIncrement() {
    updateQuantity(item.product_id, item.quantity + 1);
  }

  return (
    <Animated.View style={[styles.itemCard, { opacity: fadeAnim }]}>
      {/* Category Icon */}
      <View style={styles.itemIcon}>
        <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
      </View>

      {/* Info */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.itemMeta}>{item.category} · per {item.unit}</Text>
        <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
      </View>

      {/* Qty controls */}
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={handleDecrement}>
          <Ionicons
            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
            size={14}
            color={item.quantity === 1 ? '#DC2626' : '#374151'}
          />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={handleIncrement}>
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/* ─── Helpers ─── */

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    meat: '🥩',
    fish: '🐟',
    vegetables: '🥬',
    fruits: '🍎',
    spices: '🌶️',
    poultry: '🍗',
    condiments: '🫙',
    dairy: '🥛',
  };
  return map[category.toLowerCase()] ?? '🛒';
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  // Item count
  itemCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  itemCountText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16 },

  // Item Card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#1B6B45', marginTop: 4 },

  // Quantity
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qtyBtnAdd: {
    backgroundColor: '#1B6B45',
    borderColor: '#1B6B45',
  },
  qtyText: { fontSize: 14, fontWeight: '700', color: '#111827', minWidth: 22, textAlign: 'center' },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },

  // Summary
  summaryCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  summaryDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  summaryTotal: { fontSize: 16, fontWeight: '800', color: '#111827' },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: '#1B6B45' },
  checkoutBtn: {
    backgroundColor: '#1B6B45',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  checkoutBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
