/**
 * Inventory Screen — Stock management & product availability control.
 * Displays all products in a list with quick stock adjustments,
 * availability toggles, and detailed stock overview.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  type Product,
  fetchProducts,
  updateProduct,
} from '@/services/products';
import { ApiError } from '@/services/api';

/* ─── Types ─── */

type StockView = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export default function InventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<StockView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Stock summary stats
  const stockSummary = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.stock_quantity > 5).length;
    const lowStock = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 5).length;
    const outOfStock = products.filter((p) => p.stock_quantity === 0).length;
    const unavailable = products.filter((p) => !p.is_available).length;
    const totalUnits = products.reduce((sum, p) => sum + p.stock_quantity, 0);
    return { total, inStock, lowStock, outOfStock, unavailable, totalUnits };
  }, [products]);

  // Filtered list
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }

    // Stock view filter
    if (activeView === 'in_stock') {
      result = result.filter((p) => p.stock_quantity > 5);
    } else if (activeView === 'low_stock') {
      result = result.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 5);
    } else if (activeView === 'out_of_stock') {
      result = result.filter((p) => p.stock_quantity === 0);
    }

    // Sort: out of stock first, then low stock, then by name
    result.sort((a, b) => {
      if (a.stock_quantity === 0 && b.stock_quantity !== 0) return -1;
      if (b.stock_quantity === 0 && a.stock_quantity !== 0) return 1;
      if (a.stock_quantity <= 5 && b.stock_quantity > 5) return -1;
      if (b.stock_quantity <= 5 && a.stock_quantity > 5) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [products, searchQuery, activeView]);

  async function handleQuickStockUpdate(productId: number, newStock: number) {
    try {
      const updated = await updateProduct(productId, { stock_quantity: newStock });
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to update';
      Alert.alert('Error', msg);
    }
  }

  async function handleToggleAvailability(product: Product) {
    try {
      const updated = await updateProduct(product.id, { is_available: !product.is_available });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to update';
      Alert.alert('Error', msg);
    }
  }

  async function handleStockModalSave(productId: number, newStock: number, isAvailable: boolean) {
    try {
      const updated = await updateProduct(productId, {
        stock_quantity: newStock,
        is_available: isAvailable,
      });
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      setStockModalProduct(updated);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to update stock';
      Alert.alert('Error', msg);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadProducts();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>Manage stock & availability</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.totalUnitsBadge}>
            <Feather name="package" size={14} color="#1B6B45" />
            <Text style={styles.totalUnitsText}>{stockSummary.totalUnits} units</Text>
          </View>
        </View>
      </View>

      {/* Stock Summary Cards */}
      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, activeView === 'in_stock' && styles.summaryCardActive]}
          onPress={() => setActiveView(activeView === 'in_stock' ? 'all' : 'in_stock')}
        >
          <View style={[styles.summaryDot, { backgroundColor: '#1B6B45' }]} />
          <Text style={styles.summaryCount}>{stockSummary.inStock}</Text>
          <Text style={styles.summaryLabel}>In Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.summaryCard, activeView === 'low_stock' && styles.summaryCardWarning]}
          onPress={() => setActiveView(activeView === 'low_stock' ? 'all' : 'low_stock')}
        >
          <View style={[styles.summaryDot, { backgroundColor: '#F97316' }]} />
          <Text style={styles.summaryCount}>{stockSummary.lowStock}</Text>
          <Text style={styles.summaryLabel}>Low Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.summaryCard, activeView === 'out_of_stock' && styles.summaryCardDanger]}
          onPress={() => setActiveView(activeView === 'out_of_stock' ? 'all' : 'out_of_stock')}
        >
          <View style={[styles.summaryDot, { backgroundColor: '#DC2626' }]} />
          <Text style={styles.summaryCount}>{stockSummary.outOfStock}</Text>
          <Text style={styles.summaryLabel}>Out</Text>
        </TouchableOpacity>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryDot, { backgroundColor: '#6B7280' }]} />
          <Text style={styles.summaryCount}>{stockSummary.unavailable}</Text>
          <Text style={styles.summaryLabel}>Hidden</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filter Indicator */}
      {activeView !== 'all' && (
        <View style={styles.activeFilterRow}>
          <Text style={styles.activeFilterText}>
            Showing: {activeView === 'in_stock' ? 'In Stock' : activeView === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
            {' '}({filteredProducts.length})
          </Text>
          <TouchableOpacity onPress={() => setActiveView('all')}>
            <Text style={styles.activeFilterClear}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Product List */}
      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="inbox" size={40} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching products' : 'No products in this category'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? 'Try a different search term' : 'All products are well-stocked!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <InventoryItem
              product={item}
              onQuickAdjust={(amount) =>
                handleQuickStockUpdate(item.id, Math.max(0, item.stock_quantity + amount))
              }
              onToggleAvailability={() => handleToggleAvailability(item)}
              onOpenDetail={() => setStockModalProduct(item)}
            />
          )}
        />
      )}

      {/* Stock Detail Modal */}
      <StockDetailModal
        visible={!!stockModalProduct}
        product={stockModalProduct}
        onClose={() => setStockModalProduct(null)}
        onUpdate={handleStockModalSave}
      />
    </SafeAreaView>
  );
}

/* ─── Inventory Item Row ─── */

function InventoryItem({
  product,
  onQuickAdjust,
  onToggleAvailability,
  onOpenDetail,
}: {
  product: Product;
  onQuickAdjust: (amount: number) => void;
  onToggleAvailability: () => void;
  onOpenDetail: () => void;
}) {
  const stockColor =
    product.stock_quantity === 0
      ? '#DC2626'
      : product.stock_quantity <= 5
      ? '#F97316'
      : '#1B6B45';

  const stockLabel =
    product.stock_quantity === 0
      ? 'OUT'
      : product.stock_quantity <= 5
      ? 'LOW'
      : 'OK';

  return (
    <TouchableOpacity style={styles.inventoryItem} onPress={onOpenDetail} activeOpacity={0.7}>
      {/* Left: Status indicator + Info */}
      <View style={styles.itemLeft}>
        <View style={[styles.itemStatusBar, { backgroundColor: stockColor }]} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{product.name}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemCategory}>{product.category}</Text>
            <Text style={styles.itemPrice}>₱{Number(product.price).toFixed(2)}/{product.unit}</Text>
          </View>
        </View>
      </View>

      {/* Center: Stock quantity + quick adjust */}
      <View style={styles.itemCenter}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onQuickAdjust(-1)}
          disabled={product.stock_quantity === 0}
        >
          <Feather name="minus" size={14} color={product.stock_quantity === 0 ? '#D1D5DB' : '#DC2626'} />
        </TouchableOpacity>

        <View style={styles.stockDisplay}>
          <Text style={[styles.stockValue, { color: stockColor }]}>
            {product.stock_quantity}
          </Text>
          <Text style={[styles.stockTag, { color: stockColor, backgroundColor: `${stockColor}15` }]}>
            {stockLabel}
          </Text>
        </View>

        <TouchableOpacity style={styles.quickBtn} onPress={() => onQuickAdjust(1)}>
          <Feather name="plus" size={14} color="#1B6B45" />
        </TouchableOpacity>
      </View>

      {/* Right: Availability toggle */}
      <TouchableOpacity
        style={[
          styles.availToggle,
          product.is_available ? styles.availToggleOn : styles.availToggleOff,
        ]}
        onPress={onToggleAvailability}
      >
        <Feather
          name={product.is_available ? 'eye' : 'eye-off'}
          size={14}
          color={product.is_available ? '#1B6B45' : '#DC2626'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/* ─── Stock Detail Modal ─── */

function StockDetailModal({
  visible,
  product,
  onClose,
  onUpdate,
}: {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onUpdate: (productId: number, newStock: number, isAvailable: boolean) => Promise<void>;
}) {
  const [localStock, setLocalStock] = useState(0);
  const [localAvailable, setLocalAvailable] = useState(true);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product && visible) {
      setLocalStock(product.stock_quantity);
      setLocalAvailable(product.is_available);
      setAdjustAmount('');
    }
  }, [product, visible]);

  if (!product) return null;

  const stockColor =
    localStock === 0 ? '#DC2626' : localStock <= 5 ? '#F97316' : '#1B6B45';

  const stockStatus =
    localStock === 0 ? 'Out of Stock' : localStock <= 5 ? 'Low Stock' : 'In Stock';

  const stockIcon =
    localStock === 0 ? 'alert-circle' : localStock <= 5 ? 'alert-triangle' : 'check-circle';

  function increment(amount: number) {
    setLocalStock((s) => Math.max(0, s + amount));
  }

  function handleSetStock() {
    const val = parseInt(adjustAmount, 10);
    if (!isNaN(val) && val >= 0) {
      setLocalStock(val);
      setAdjustAmount('');
    }
  }

  async function handleSave() {
    if (!product) return;
    setSaving(true);
    await onUpdate(product.id, localStock, localAvailable);
    setSaving(false);
    onClose();
  }

  const hasChanges = localStock !== product.stock_quantity || localAvailable !== product.is_available;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Manage Stock</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product Info */}
          <View style={styles.detailProductCard}>
            <Text style={styles.detailProductName}>{product.name}</Text>
            <Text style={styles.detailProductMeta}>
              {product.category} · ₱{Number(product.price).toFixed(2)}/{product.unit}
            </Text>
          </View>

          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: `${stockColor}10`, borderColor: `${stockColor}30` }]}>
            <Feather name={stockIcon as keyof typeof Feather.glyphMap} size={20} color={stockColor} />
            <View style={styles.statusBannerInfo}>
              <Text style={[styles.statusBannerLabel, { color: stockColor }]}>{stockStatus}</Text>
              <Text style={styles.statusBannerDetail}>
                {localStock === 0
                  ? 'This product cannot be ordered by customers'
                  : localStock <= 5
                  ? `Only ${localStock} units remaining — consider restocking`
                  : `${localStock} units available for orders`}
              </Text>
            </View>
          </View>

          {/* Quantity Controls */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Stock Quantity</Text>
            <View style={styles.controlRow}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => increment(-10)}>
                <Text style={styles.ctrlBtnTextRed}>-10</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => increment(-1)}>
                <Text style={styles.ctrlBtnTextRed}>-1</Text>
              </TouchableOpacity>

              <View style={styles.bigStockDisplay}>
                <Text style={[styles.bigStockValue, { color: stockColor }]}>{localStock}</Text>
                <Text style={styles.bigStockUnit}>{product.unit}</Text>
              </View>

              <TouchableOpacity style={styles.ctrlBtnGreen} onPress={() => increment(1)}>
                <Text style={styles.ctrlBtnTextGreen}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtnGreen} onPress={() => increment(10)}>
                <Text style={styles.ctrlBtnTextGreen}>+10</Text>
              </TouchableOpacity>
            </View>

            {/* Set exact */}
            <View style={styles.setExactRow}>
              <TextInput
                style={styles.setExactInput}
                placeholder="Set exact quantity"
                placeholderTextColor="#9CA3AF"
                value={adjustAmount}
                onChangeText={setAdjustAmount}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.setExactBtn, !adjustAmount && styles.setExactBtnDisabled]}
                onPress={handleSetStock}
                disabled={!adjustAmount}
              >
                <Text style={styles.setExactBtnText}>Set</Text>
              </TouchableOpacity>
            </View>

            {/* Quick presets */}
            <Text style={styles.presetsLabel}>Quick restock:</Text>
            <View style={styles.presetsRow}>
              {[5, 10, 25, 50, 100].map((n) => (
                <TouchableOpacity key={n} style={styles.presetChip} onPress={() => setLocalStock(n)}>
                  <Text style={styles.presetChipText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Availability */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Product Availability</Text>
            <View style={styles.availRow}>
              <TouchableOpacity
                style={[styles.availCard, localAvailable && styles.availCardActive]}
                onPress={() => setLocalAvailable(true)}
              >
                <Feather name="eye" size={20} color={localAvailable ? '#1B6B45' : '#9CA3AF'} />
                <Text style={[styles.availCardTitle, localAvailable && { color: '#1B6B45' }]}>Available</Text>
                <Text style={styles.availCardHint}>Customers can see & order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.availCard, !localAvailable && styles.availCardInactive]}
                onPress={() => setLocalAvailable(false)}
              >
                <Feather name="eye-off" size={20} color={!localAvailable ? '#DC2626' : '#9CA3AF'} />
                <Text style={[styles.availCardTitle, !localAvailable && { color: '#DC2626' }]}>Hidden</Text>
                <Text style={styles.availCardHint}>Not visible to customers</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Change Summary */}
          {hasChanges && (
            <View style={styles.changeSummary}>
              <Feather name="info" size={14} color="#2563EB" />
              <Text style={styles.changeSummaryText}>
                {localStock !== product.stock_quantity && localAvailable !== product.is_available
                  ? `Stock: ${product.stock_quantity} → ${localStock} · Visibility: ${product.is_available ? 'On' : 'Off'} → ${localAvailable ? 'On' : 'Off'}`
                  : localStock !== product.stock_quantity
                  ? `Stock: ${product.stock_quantity} → ${localStock} (${localStock > product.stock_quantity ? '+' : ''}${localStock - product.stock_quantity})`
                  : `Visibility: ${product.is_available ? 'Available' : 'Hidden'} → ${localAvailable ? 'Available' : 'Hidden'}`}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Save */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Stock'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
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
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  totalUnitsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  totalUnitsText: { fontSize: 12, fontWeight: '700', color: '#1B6B45' },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#1B6B45',
  },
  summaryCardWarning: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
  },
  summaryCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  summaryCount: { fontSize: 18, fontWeight: '800', color: '#111827' },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', marginTop: 2 },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  // Active filter
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  activeFilterText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  activeFilterClear: { fontSize: 12, fontWeight: '700', color: '#1B6B45' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60, gap: 8 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptySubtext: { fontSize: 13, color: '#9CA3AF' },

  // Inventory Item
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemStatusBar: { width: 4, height: 36, borderRadius: 2 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  itemCategory: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  itemPrice: { fontSize: 11, color: '#6B7280' },

  // Stock controls in row
  itemCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockDisplay: { alignItems: 'center', minWidth: 36 },
  stockValue: { fontSize: 18, fontWeight: '800' },
  stockTag: {
    fontSize: 8,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
    overflow: 'hidden',
  },

  // Availability toggle
  availToggle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  availToggleOn: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  availToggleOff: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },

  // Modal
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalContent: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 120 },

  // Detail modal
  detailProductCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailProductName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  detailProductMeta: { fontSize: 13, color: '#6B7280' },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusBannerInfo: { flex: 1 },
  statusBannerLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  statusBannerDetail: { fontSize: 12, color: '#6B7280', lineHeight: 16 },

  detailSection: { marginBottom: 24 },
  detailSectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 14 },

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  ctrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnGreen: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnTextRed: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  ctrlBtnTextGreen: { fontSize: 14, fontWeight: '700', color: '#1B6B45' },

  bigStockDisplay: { alignItems: 'center', minWidth: 80, paddingHorizontal: 12 },
  bigStockValue: { fontSize: 36, fontWeight: '800', lineHeight: 42 },
  bigStockUnit: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  setExactRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  setExactInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#111827',
  },
  setExactBtn: {
    backgroundColor: '#1B6B45',
    borderRadius: 10,
    paddingHorizontal: 20,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setExactBtnDisabled: { backgroundColor: '#D1D5DB' },
  setExactBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  presetsLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  presetsRow: { flexDirection: 'row', gap: 8 },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // Availability
  availRow: { flexDirection: 'row', gap: 12 },
  availCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  availCardActive: { backgroundColor: '#F0FDF4', borderColor: '#1B6B45' },
  availCardInactive: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  availCardTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  availCardHint: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  // Change summary
  changeSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeSummaryText: { flex: 1, fontSize: 12, color: '#2563EB', lineHeight: 16 },

  // Save button
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1B6B45',
    borderRadius: 14,
    height: 54,
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
