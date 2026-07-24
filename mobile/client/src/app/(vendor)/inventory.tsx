/**
 * Inventory Screen — Stock & pricing management for vendor products.
 * Create inventory records, adjust stock, set pricing (puhunan/tubo).
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
import { Feather } from '@expo/vector-icons';
import {
  type CreateInventoryData,
  type Inventory,
  type UpdateInventoryData,
  adjustStock,
  createInventory,
  deleteInventory,
  fetchInventory,
  updateInventory,
} from '@/services/inventory';
import { type Product, fetchProducts } from '@/services/products';
import { ApiError } from '@/services/api';

/* ─── Types ─── */

type StockView = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type InventoryStatus = 'active' | 'inactive' | 'seasonal' | 'discontinued';

export default function InventoryScreen() {
  const [inventoryItems, setInventoryItems] = useState<Inventory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<StockView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Inventory | null>(null);
  const [adjustModalItem, setAdjustModalItem] = useState<Inventory | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [inv, prods] = await Promise.all([fetchInventory(), fetchProducts()]);
      setInventoryItems(inv);
      setProducts(prods);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Products that don't have inventory yet (for create modal)
  const productsWithoutInventory = useMemo(() => {
    const inventoryProductIds = new Set(inventoryItems.map((i) => i.product_id));
    return products.filter((p) => !inventoryProductIds.has(p.id));
  }, [products, inventoryItems]);

  // Stock summary stats
  const stockSummary = useMemo(() => {
    const total = inventoryItems.length;
    const inStock = inventoryItems.filter((i) => i.stock_quantity > i.reorder_level).length;
    const lowStock = inventoryItems.filter(
      (i) => i.stock_quantity > 0 && i.stock_quantity <= i.reorder_level
    ).length;
    const outOfStock = inventoryItems.filter((i) => i.stock_quantity === 0).length;
    const totalUnits = inventoryItems.reduce((sum, i) => sum + i.stock_quantity, 0);
    return { total, inStock, lowStock, outOfStock, totalUnits };
  }, [inventoryItems]);

  // Filtered list
  const filteredItems = useMemo(() => {
    let result = [...inventoryItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.product.name.toLowerCase().includes(q) ||
          i.product.category.toLowerCase().includes(q)
      );
    }

    if (activeView === 'in_stock') {
      result = result.filter((i) => i.stock_quantity > i.reorder_level);
    } else if (activeView === 'low_stock') {
      result = result.filter((i) => i.stock_quantity > 0 && i.stock_quantity <= i.reorder_level);
    } else if (activeView === 'out_of_stock') {
      result = result.filter((i) => i.stock_quantity === 0);
    }

    result.sort((a, b) => {
      if (a.stock_quantity === 0 && b.stock_quantity !== 0) return -1;
      if (b.stock_quantity === 0 && a.stock_quantity !== 0) return 1;
      if (a.stock_quantity <= a.reorder_level && b.stock_quantity > b.reorder_level) return -1;
      if (b.stock_quantity <= b.reorder_level && a.stock_quantity > a.reorder_level) return 1;
      return a.product.name.localeCompare(b.product.name);
    });

    return result;
  }, [inventoryItems, searchQuery, activeView]);

  async function handleCreateInventory(data: CreateInventoryData) {
    try {
      const created = await createInventory(data);
      setInventoryItems((prev) => [created, ...prev]);
      setCreateModalVisible(false);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to create inventory';
      Alert.alert('Error', msg);
    }
  }

  async function handleUpdateInventory(id: number, data: UpdateInventoryData) {
    try {
      const updated = await updateInventory(id, data);
      setInventoryItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setEditItem(null);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to update';
      Alert.alert('Error', msg);
    }
  }

  async function handleAdjustStock(
    id: number,
    quantity: number,
    type: 'restock' | 'sold' | 'spoiled' | 'adjustment',
    reason?: string
  ) {
    try {
      const updated = await adjustStock(id, quantity, type, reason);
      setInventoryItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setAdjustModalItem(null);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to adjust stock';
      Alert.alert('Error', msg);
    }
  }

  async function handleDeleteInventory(item: Inventory) {
    Alert.alert(
      'Delete Inventory',
      `Remove inventory record for "${item.product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInventory(item.id);
              setInventoryItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch (error) {
              const msg = error instanceof ApiError ? error.message : 'Failed to delete';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  }

  function handleRefresh() {
    setRefreshing(true);
    loadData();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>Stock & pricing management</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.totalUnitsBadge}>
            <Feather name="package" size={14} color="#1B6B45" />
            <Text style={styles.totalUnitsText}>{stockSummary.totalUnits} units</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setCreateModalVisible(true)}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
          </TouchableOpacity>
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
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
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
            {' '}({filteredItems.length})
          </Text>
          <TouchableOpacity onPress={() => setActiveView('all')}>
            <Text style={styles.activeFilterClear}>Show All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inventory List */}
      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : inventoryItems.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="inbox" size={40} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No inventory yet</Text>
          <Text style={styles.emptySubtext}>
            Create inventory for your products to manage stock
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={() => setCreateModalVisible(true)}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.emptyAddText}>Create Inventory</Text>
          </TouchableOpacity>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="search" size={40} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No matching items</Text>
          <Text style={styles.emptySubtext}>Try a different search or filter</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <InventoryItemRow
              item={item}
              onAdjust={() => setAdjustModalItem(item)}
              onEdit={() => setEditItem(item)}
              onDelete={() => handleDeleteInventory(item)}
            />
          )}
        />
      )}

      {/* Create Inventory Modal */}
      <CreateInventoryModal
        visible={createModalVisible}
        products={productsWithoutInventory}
        onClose={() => setCreateModalVisible(false)}
        onSave={handleCreateInventory}
      />

      {/* Edit Inventory Modal */}
      <EditInventoryModal
        visible={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleUpdateInventory}
      />

      {/* Stock Adjust Modal */}
      <AdjustStockModal
        visible={!!adjustModalItem}
        item={adjustModalItem}
        onClose={() => setAdjustModalItem(null)}
        onAdjust={handleAdjustStock}
      />
    </SafeAreaView>
  );
}

/* ─── Inventory Item Row ─── */

function InventoryItemRow({
  item,
  onAdjust,
  onEdit,
  onDelete,
}: {
  item: Inventory;
  onAdjust: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stockColor =
    item.stock_quantity === 0
      ? '#DC2626'
      : item.stock_quantity <= item.reorder_level
      ? '#F97316'
      : '#1B6B45';

  const stockLabel =
    item.stock_quantity === 0
      ? 'OUT'
      : item.stock_quantity <= item.reorder_level
      ? 'LOW'
      : 'OK';

  const costPrice = item.cost_price ? Number(item.cost_price) : null;
  const sellingPrice = Number(item.selling_price);
  const profit = costPrice ? sellingPrice - costPrice : null;

  return (
    <View style={styles.inventoryItem}>
      {/* Left: Status + Info */}
      <View style={styles.itemLeft}>
        <View style={[styles.itemStatusBar, { backgroundColor: stockColor }]} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemCategory}>{item.product.category}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                {item.status}
              </Text>
            </View>
          </View>
          <View style={styles.pricingRow}>
            {costPrice !== null && (
              <Text style={styles.costText}>Cost: ₱{costPrice.toFixed(2)}</Text>
            )}
            <Text style={styles.sellText}>Sell: ₱{sellingPrice.toFixed(2)}</Text>
            {profit !== null && (
              <Text style={styles.profitText}>+₱{profit.toFixed(2)}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Right: Stock + Actions */}
      <View style={styles.itemRight}>
        <View style={styles.stockDisplay}>
          <Text style={[styles.stockValue, { color: stockColor }]}>
            {item.stock_quantity}
          </Text>
          <Text style={[styles.stockTag, { color: stockColor, backgroundColor: `${stockColor}15` }]}>
            {stockLabel}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={onAdjust}>
            <Feather name="plus-circle" size={16} color="#1B6B45" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
            <Feather name="edit-2" size={14} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
            <Feather name="trash-2" size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#1B6B45';
    case 'inactive': return '#6B7280';
    case 'seasonal': return '#F97316';
    case 'discontinued': return '#DC2626';
    default: return '#6B7280';
  }
}

/* ─── Create Inventory Modal ─── */

function CreateInventoryModal({
  visible,
  products,
  onClose,
  onSave,
}: {
  visible: boolean;
  products: Product[];
  onClose: () => void;
  onSave: (data: CreateInventoryData) => Promise<void>;
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [markupPercentage, setMarkupPercentage] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [maxStockLevel, setMaxStockLevel] = useState('');
  const [status, setStatus] = useState<InventoryStatus>('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedProduct(null);
      setStockQuantity('');
      setCostPrice('');
      setSellingPrice('');
      setMarkupPercentage('');
      setReorderLevel('5');
      setMaxStockLevel('');
      setStatus('active');
    }
  }, [visible]);

  // Auto-calculate markup when cost and selling price change
  useEffect(() => {
    const cost = parseFloat(costPrice);
    const sell = parseFloat(sellingPrice);
    if (!isNaN(cost) && !isNaN(sell) && cost > 0) {
      const markup = ((sell - cost) / cost) * 100;
      setMarkupPercentage(markup.toFixed(1));
    }
  }, [costPrice, sellingPrice]);

  // Set selling price from product price when selected
  useEffect(() => {
    if (selectedProduct) {
      setSellingPrice(String(selectedProduct.price));
    }
  }, [selectedProduct]);

  async function handleSubmit() {
    if (!selectedProduct) {
      Alert.alert('Required', 'Please select a product.');
      return;
    }
    if (!stockQuantity || !sellingPrice) {
      Alert.alert('Required', 'Please fill in stock quantity and selling price.');
      return;
    }

    setSaving(true);
    const data: CreateInventoryData = {
      product_id: selectedProduct.id,
      stock_quantity: parseInt(stockQuantity, 10),
      selling_price: parseFloat(sellingPrice),
      reorder_level: parseInt(reorderLevel, 10) || 5,
      status,
    };
    if (costPrice) data.cost_price = parseFloat(costPrice);
    if (markupPercentage) data.markup_percentage = parseFloat(markupPercentage);
    if (maxStockLevel) data.max_stock_level = parseInt(maxStockLevel, 10);

    await onSave(data);
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create Inventory</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product Selection */}
          <Text style={styles.fieldLabel}>Select Product</Text>
          {products.length === 0 ? (
            <View style={styles.noProductsBanner}>
              <Feather name="info" size={16} color="#F97316" />
              <Text style={styles.noProductsText}>
                All products already have inventory records.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productChipsRow}
            >
              {products.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.productChip,
                    selectedProduct?.id === p.id && styles.productChipActive,
                  ]}
                  onPress={() => setSelectedProduct(p)}
                >
                  <Text
                    style={[
                      styles.productChipText,
                      selectedProduct?.id === p.id && styles.productChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Text style={styles.productChipCategory}>{p.category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Stock Quantity */}
          <Text style={styles.fieldLabel}>Stock Quantity</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            value={stockQuantity}
            onChangeText={setStockQuantity}
            keyboardType="number-pad"
          />

          {/* Pricing Section */}
          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Cost Price (Puhunan)</Text>
              <TextInput
                style={styles.input}
                placeholder="₱0.00"
                placeholderTextColor="#9CA3AF"
                value={costPrice}
                onChangeText={setCostPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Selling Price</Text>
              <TextInput
                style={styles.input}
                placeholder="₱0.00"
                placeholderTextColor="#9CA3AF"
                value={sellingPrice}
                onChangeText={setSellingPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Markup % (Tubo)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            placeholder="Auto-calculated"
            placeholderTextColor="#9CA3AF"
            value={markupPercentage ? `${markupPercentage}%` : ''}
            editable={false}
          />

          {/* Stock Levels */}
          <Text style={styles.sectionTitle}>Stock Levels</Text>
          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Reorder Level</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                placeholderTextColor="#9CA3AF"
                value={reorderLevel}
                onChangeText={setReorderLevel}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Max Stock</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor="#9CA3AF"
                value={maxStockLevel}
                onChangeText={setMaxStockLevel}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Status */}
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusChipsRow}>
            {(['active', 'inactive', 'seasonal', 'discontinued'] as InventoryStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, status === s && styles.statusChipActive]}
                onPress={() => setStatus(s)}
              >
                <Text
                  style={[styles.statusChipText, status === s && styles.statusChipTextActive]}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, (!selectedProduct || saving) && styles.saveBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selectedProduct || saving}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>
              {saving ? 'Creating...' : 'Create Inventory'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Edit Inventory Modal ─── */

function EditInventoryModal({
  visible,
  item,
  onClose,
  onSave,
}: {
  visible: boolean;
  item: Inventory | null;
  onClose: () => void;
  onSave: (id: number, data: UpdateInventoryData) => Promise<void>;
}) {
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [markupPercentage, setMarkupPercentage] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [maxStockLevel, setMaxStockLevel] = useState('');
  const [status, setStatus] = useState<InventoryStatus>('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && visible) {
      setCostPrice(item.cost_price ? String(item.cost_price) : '');
      setSellingPrice(String(item.selling_price));
      setMarkupPercentage(item.markup_percentage ? String(item.markup_percentage) : '');
      setReorderLevel(String(item.reorder_level));
      setMaxStockLevel(item.max_stock_level ? String(item.max_stock_level) : '');
      setStatus(item.status);
    }
  }, [item, visible]);

  useEffect(() => {
    const cost = parseFloat(costPrice);
    const sell = parseFloat(sellingPrice);
    if (!isNaN(cost) && !isNaN(sell) && cost > 0) {
      const markup = ((sell - cost) / cost) * 100;
      setMarkupPercentage(markup.toFixed(1));
    }
  }, [costPrice, sellingPrice]);

  if (!item) return null;

  async function handleSubmit() {
    if (!item) return;
    setSaving(true);
    const data: UpdateInventoryData = {
      selling_price: parseFloat(sellingPrice),
      reorder_level: parseInt(reorderLevel, 10) || 5,
      status,
    };
    if (costPrice) data.cost_price = parseFloat(costPrice);
    if (markupPercentage) data.markup_percentage = parseFloat(markupPercentage);
    if (maxStockLevel) data.max_stock_level = parseInt(maxStockLevel, 10);

    await onSave(item.id, data);
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Inventory</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product Info */}
          <View style={styles.detailProductCard}>
            <Text style={styles.detailProductName}>{item.product.name}</Text>
            <Text style={styles.detailProductMeta}>
              {item.product.category} · Current stock: {item.stock_quantity}
            </Text>
          </View>

          {/* Pricing */}
          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Cost Price (Puhunan)</Text>
              <TextInput
                style={styles.input}
                placeholder="₱0.00"
                placeholderTextColor="#9CA3AF"
                value={costPrice}
                onChangeText={setCostPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Selling Price</Text>
              <TextInput
                style={styles.input}
                placeholder="₱0.00"
                placeholderTextColor="#9CA3AF"
                value={sellingPrice}
                onChangeText={setSellingPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Markup % (Tubo)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={markupPercentage ? `${markupPercentage}%` : ''}
            editable={false}
          />

          {/* Stock Levels */}
          <Text style={styles.sectionTitle}>Stock Levels</Text>
          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Reorder Level</Text>
              <TextInput
                style={styles.input}
                value={reorderLevel}
                onChangeText={setReorderLevel}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Max Stock</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor="#9CA3AF"
                value={maxStockLevel}
                onChangeText={setMaxStockLevel}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Status */}
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusChipsRow}>
            {(['active', 'inactive', 'seasonal', 'discontinued'] as InventoryStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, status === s && styles.statusChipActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Adjust Stock Modal ─── */

function AdjustStockModal({
  visible,
  item,
  onClose,
  onAdjust,
}: {
  visible: boolean;
  item: Inventory | null;
  onClose: () => void;
  onAdjust: (id: number, quantity: number, type: 'restock' | 'sold' | 'spoiled' | 'adjustment', reason?: string) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState<'restock' | 'sold' | 'spoiled' | 'adjustment'>('restock');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuantity('');
      setType('restock');
      setReason('');
    }
  }, [visible]);

  if (!item) return null;

  async function handleSubmit() {
    if (!item || !quantity) return;
    setSaving(true);
    await onAdjust(item.id, parseInt(quantity, 10), type, reason || undefined);
    setSaving(false);
  }

  const adjustTypes: { value: typeof type; label: string; icon: string; color: string }[] = [
    { value: 'restock', label: 'Restock', icon: 'plus-circle', color: '#1B6B45' },
    { value: 'sold', label: 'Sold', icon: 'shopping-cart', color: '#2563EB' },
    { value: 'spoiled', label: 'Spoiled', icon: 'alert-triangle', color: '#DC2626' },
    { value: 'adjustment', label: 'Adjust', icon: 'edit-3', color: '#F97316' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Adjust Stock</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.detailProductCard}>
            <Text style={styles.detailProductName}>{item.product.name}</Text>
            <Text style={styles.detailProductMeta}>
              Current stock: {item.stock_quantity} · Reorder at: {item.reorder_level}
            </Text>
          </View>

          {/* Type Selection */}
          <Text style={styles.fieldLabel}>Adjustment Type</Text>
          <View style={styles.adjustTypeRow}>
            {adjustTypes.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.adjustTypeBtn,
                  type === t.value && { backgroundColor: `${t.color}15`, borderColor: t.color },
                ]}
                onPress={() => setType(t.value)}
              >
                <Feather
                  name={t.icon as keyof typeof Feather.glyphMap}
                  size={16}
                  color={type === t.value ? t.color : '#9CA3AF'}
                />
                <Text
                  style={[
                    styles.adjustTypeText,
                    type === t.value && { color: t.color, fontWeight: '700' },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quantity */}
          <Text style={styles.fieldLabel}>Quantity</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter quantity"
            placeholderTextColor="#9CA3AF"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
          />

          {/* Quick presets */}
          <View style={styles.presetsRow}>
            {[1, 5, 10, 25, 50].map((n) => (
              <TouchableOpacity
                key={n}
                style={styles.presetChip}
                onPress={() => setQuantity(String(n))}
              >
                <Text style={styles.presetChipText}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reason */}
          <Text style={styles.fieldLabel}>Reason (optional)</Text>
          <TextInput
            style={[styles.input, { height: 60 }]}
            placeholder="Why are you adjusting?"
            placeholderTextColor="#9CA3AF"
            value={reason}
            onChangeText={setReason}
            multiline
          />
        </ScrollView>

        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, (!quantity || saving) && styles.saveBtnDisabled]}
            onPress={handleSubmit}
            disabled={!quantity || saving}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>
              {saving ? 'Adjusting...' : 'Confirm Adjustment'}
            </Text>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1B6B45',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary
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
  summaryCardActive: { backgroundColor: '#F0FDF4', borderColor: '#1B6B45' },
  summaryCardWarning: { backgroundColor: '#FFF7ED', borderColor: '#F97316' },
  summaryCardDanger: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
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
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B6B45',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  emptyAddText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

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
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemStatusBar: { width: 4, height: 50, borderRadius: 2, marginTop: 2 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  itemCategory: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  pricingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  costText: { fontSize: 11, color: '#6B7280' },
  sellText: { fontSize: 11, fontWeight: '600', color: '#111827' },
  profitText: { fontSize: 11, fontWeight: '700', color: '#1B6B45' },

  // Right side
  itemRight: { alignItems: 'center', gap: 6 },
  stockDisplay: { alignItems: 'center', minWidth: 40 },
  stockValue: { fontSize: 20, fontWeight: '800' },
  stockTag: {
    fontSize: 8,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
    overflow: 'hidden',
  },
  actionRow: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  // Form fields
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 4 },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#111827',
  },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },

  // Product chips for selection
  productChipsRow: { paddingVertical: 4, gap: 8, flexDirection: 'row' },
  productChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minWidth: 100,
  },
  productChipActive: { backgroundColor: '#F0FDF4', borderColor: '#1B6B45' },
  productChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  productChipTextActive: { color: '#1B6B45' },
  productChipCategory: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  // No products banner
  noProductsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  noProductsText: { flex: 1, fontSize: 12, color: '#F97316' },

  // Status chips
  statusChipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusChipActive: { backgroundColor: '#F0FDF4', borderColor: '#1B6B45' },
  statusChipText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  statusChipTextActive: { color: '#1B6B45', fontWeight: '700' },

  // Adjust type
  adjustTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  adjustTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  adjustTypeText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },

  // Presets
  presetsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
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

  // Detail card in modal
  detailProductCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailProductName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  detailProductMeta: { fontSize: 13, color: '#6B7280' },

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
