/**
 * Products Screen — full CRUD for vendor products.
 * Add, edit, remove products with same design language as dashboard.
 */

import { useCallback, useEffect, useState } from 'react';
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
  type CreateProductData,
  type Product,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from '@/services/products';
import { ApiError } from '@/services/api';

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProducts();
      setProducts(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function handleAdd() {
    setEditingProduct(null);
    setModalVisible(true);
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setModalVisible(true);
  }

  function handleDelete(product: Product) {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              setProducts((prev) => prev.filter((p) => p.id !== product.id));
            } catch (error) {
              const msg = error instanceof ApiError ? error.message : 'Failed to delete';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  }

  async function handleSave(data: CreateProductData) {
    try {
      if (editingProduct) {
        const updated = await updateProduct(editingProduct.id, data);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? updated : p))
        );
      } else {
        const created = await createProduct(data);
        setProducts((prev) => [created, ...prev]);
      }
      setModalVisible(false);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to save product';
      Alert.alert('Error', msg);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Products</Text>
          <Text style={styles.subtitle}>{products.length} products listed</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Product List */}
      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="package" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptySubtext}>
            Tap "Add" to list your first product
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* Add/Edit Modal */}
      <ProductFormModal
        visible={modalVisible}
        product={editingProduct}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

/* ─── Product Card ─── */

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stockColor = product.stock_quantity === 0
    ? '#DC2626'
    : product.stock_quantity <= 5
    ? '#F97316'
    : '#1B6B45';

  return (
    <View style={styles.productCard}>
      <View style={styles.productImagePlaceholder}>
        <Feather name="image" size={20} color="#D1D5DB" />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productCategory}>{product.category}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>₱{Number(product.price).toFixed(2)}</Text>
          <Text style={styles.productUnit}>/{product.unit}</Text>
          <View style={[styles.stockBadge, { backgroundColor: `${stockColor}15` }]}>
            <Text style={[styles.stockText, { color: stockColor }]}>
              {product.stock_quantity} in stock
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
          <Feather name="edit-2" size={16} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
          <Feather name="trash-2" size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Product Form Modal ─── */

function ProductFormModal({
  visible,
  product,
  onClose,
  onSave,
}: {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: (data: CreateProductData) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [stock, setStock] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description ?? '');
      setCategory(product.category);
      setPrice(String(product.price));
      setUnit(product.unit);
      setStock(String(product.stock_quantity));
    } else {
      setName('');
      setDescription('');
      setCategory('');
      setPrice('');
      setUnit('kg');
      setStock('');
    }
  }, [product, visible]);

  async function handleSubmit() {
    if (!name.trim() || !category || !price || !stock) {
      Alert.alert('Required', 'Please fill in name, category, price, and stock.');
      return;
    }

    setSaving(true);
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      price: parseFloat(price),
      unit,
      stock_quantity: parseInt(stock, 10),
    });
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {product ? 'Edit Product' : 'Add Product'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <FormField label="Product Name" required>
            <TextInput
              style={styles.input}
              placeholder="e.g. Fresh Tilapia"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
            />
          </FormField>

          {/* Description */}
          <FormField label="Description">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />
          </FormField>

          {/* Category */}
          <FormField label="Category" required>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </FormField>

          {/* Price + Unit */}
          <View style={styles.row}>
            <FormField label="Price (₱)" required style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholderTextColor="#9CA3AF"
              />
            </FormField>
            <FormField label="Unit" required style={{ flex: 1 }}>
              <View style={styles.unitRow}>
                {PRODUCT_UNITS.slice(0, 4).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitChip, unit === u && styles.unitChipActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormField>
          </View>

          {/* Stock */}
          <FormField label="Stock Quantity" required>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              value={stock}
              onChangeText={setStock}
              keyboardType="number-pad"
              placeholderTextColor="#9CA3AF"
            />
          </FormField>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.submitText}>
              {saving ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Form Field ─── */

function FormField({
  label,
  required,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.fieldGroup, style]}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
    </View>
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
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B6B45',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // List
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },

  // Product Card
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  productImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  productCategory: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  productMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  productPrice: { fontSize: 16, fontWeight: '800', color: '#1B6B45' },
  productUnit: { fontSize: 12, color: '#9CA3AF' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
  stockText: { fontSize: 11, fontWeight: '600' },
  productActions: { gap: 8 },
  actionBtn: { padding: 8 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalContent: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },

  // Form
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  required: { color: '#DC2626' },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#111827',
  },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },

  // Chips
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#DCFCE7', borderColor: '#1B6B45' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  chipTextActive: { color: '#1B6B45', fontWeight: '700' },

  // Unit chips
  unitRow: { flexDirection: 'row', gap: 6 },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unitChipActive: { backgroundColor: '#DCFCE7', borderColor: '#1B6B45' },
  unitChipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  unitChipTextActive: { color: '#1B6B45', fontWeight: '700' },

  // Submit
  submitButton: {
    backgroundColor: '#1B6B45',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
