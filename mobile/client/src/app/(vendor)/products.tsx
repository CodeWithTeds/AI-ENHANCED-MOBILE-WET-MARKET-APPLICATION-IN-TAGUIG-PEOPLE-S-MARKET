/**
 * Products Screen — full CRUD for vendor products.
 * Modern card grid design with image picker support.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { API_BASE_URL } from '@/config/api';
import { ApiError } from '@/services/api';

/* ─── Filter Types ─── */

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type AvailabilityFilter = 'all' | 'available' | 'unavailable';
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'price_low' | 'price_high' | 'stock_low' | 'stock_high';

interface FilterState {
  search: string;
  categories: string[];
  stockStatus: StockFilter;
  availability: AvailabilityFilter;
  priceMin: string;
  priceMax: string;
  sortBy: SortOption;
}

const INITIAL_FILTERS: FilterState = {
  search: '',
  categories: [],
  stockStatus: 'all',
  availability: 'all',
  priceMin: '',
  priceMax: '',
  sortBy: 'newest',
};

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'newest', label: 'Newest First', icon: 'clock-outline' },
  { value: 'oldest', label: 'Oldest First', icon: 'clock-outline' },
  { value: 'name_asc', label: 'Name A→Z', icon: 'sort-alphabetical-ascending' },
  { value: 'name_desc', label: 'Name Z→A', icon: 'sort-alphabetical-descending' },
  { value: 'price_low', label: 'Price: Low to High', icon: 'sort-numeric-ascending' },
  { value: 'price_high', label: 'Price: High to Low', icon: 'sort-numeric-descending' },
  { value: 'stock_low', label: 'Stock: Low to High', icon: 'sort-numeric-ascending' },
  { value: 'stock_high', label: 'Stock: High to Low', icon: 'sort-numeric-descending' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2;

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

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

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (filters.search.trim()) count++;
    if (filters.categories.length > 0) count++;
    if (filters.stockStatus !== 'all') count++;
    if (filters.availability !== 'all') count++;
    if (filters.priceMin.trim()) count++;
    if (filters.priceMax.trim()) count++;
    if (filters.sortBy !== 'newest') count++;
    setActiveFilterCount(count);
  }, [filters]);

  // Apply filters and sorting
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      result = result.filter((p) => filters.categories.includes(p.category));
    }

    // Stock status filter
    if (filters.stockStatus === 'out_of_stock') {
      result = result.filter((p) => p.stock_quantity === 0);
    } else if (filters.stockStatus === 'low_stock') {
      result = result.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 5);
    } else if (filters.stockStatus === 'in_stock') {
      result = result.filter((p) => p.stock_quantity > 5);
    }

    // Availability filter
    if (filters.availability === 'available') {
      result = result.filter((p) => p.is_available);
    } else if (filters.availability === 'unavailable') {
      result = result.filter((p) => !p.is_available);
    }

    // Price range filter
    const minPrice = parseFloat(filters.priceMin);
    const maxPrice = parseFloat(filters.priceMax);
    if (!isNaN(minPrice)) {
      result = result.filter((p) => Number(p.price) >= minPrice);
    }
    if (!isNaN(maxPrice)) {
      result = result.filter((p) => Number(p.price) <= maxPrice);
    }

    // Sorting
    switch (filters.sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        break;
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'price_low':
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price_high':
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'stock_low':
        result.sort((a, b) => a.stock_quantity - b.stock_quantity);
        break;
      case 'stock_high':
        result.sort((a, b) => b.stock_quantity - a.stock_quantity);
        break;
    }

    return result;
  }, [products, filters]);

  function handleClearFilters() {
    setFilters(INITIAL_FILTERS);
  }

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
      `Remove "${product.name}" from your store?`,
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

  function getImageUrl(path: string | null): string | null {
    if (!path) return null;
    // Remove /api/v1 from the base URL to get the storage root
    const storageBase = API_BASE_URL.replace('/api/v1', '');
    return `${storageBase}/storage/${path}`;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Products</Text>
          <Text style={styles.subtitle}>
            {filteredProducts.length} of {products.length} items
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Feather name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search + Filter Bar */}
      <View style={styles.searchFilterBar}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#9CA3AF"
            value={filters.search}
            onChangeText={(text) => setFilters((f) => ({ ...f, search: text }))}
          />
          {filters.search.length > 0 && (
            <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, search: '' }))}>
              <Feather name="x-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterToggleBtn, activeFilterCount > 0 && styles.filterToggleBtnActive]}
          onPress={() => setFilterVisible(true)}
        >
          <Feather name="sliders" size={18} color={activeFilterCount > 0 ? '#FFFFFF' : '#374151'} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {filters.categories.length > 0 && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {filters.categories.length === 1 ? filters.categories[0] : `${filters.categories.length} categories`}
              </Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, categories: [] }))}>
                <Feather name="x" size={12} color="#1B6B45" />
              </TouchableOpacity>
            </View>
          )}
          {filters.stockStatus !== 'all' && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {filters.stockStatus === 'in_stock' ? 'In Stock' : filters.stockStatus === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
              </Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, stockStatus: 'all' }))}>
                <Feather name="x" size={12} color="#1B6B45" />
              </TouchableOpacity>
            </View>
          )}
          {filters.availability !== 'all' && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {filters.availability === 'available' ? 'Available' : 'Unavailable'}
              </Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, availability: 'all' }))}>
                <Feather name="x" size={12} color="#1B6B45" />
              </TouchableOpacity>
            </View>
          )}
          {(filters.priceMin || filters.priceMax) && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                ₱{filters.priceMin || '0'} - ₱{filters.priceMax || '∞'}
              </Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, priceMin: '', priceMax: '' }))}>
                <Feather name="x" size={12} color="#1B6B45" />
              </TouchableOpacity>
            </View>
          )}
          {filters.sortBy !== 'newest' && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {SORT_OPTIONS.find((s) => s.value === filters.sortBy)?.label}
              </Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, sortBy: 'newest' }))}>
                <Feather name="x" size={12} color="#1B6B45" />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.clearAllPill} onPress={handleClearFilters}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Products Grid */}
      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Feather name="shopping-bag" size={40} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptySubtext}>
            Add your first product to start selling
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAdd}>
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.emptyAddText}>Add Product</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Feather name="filter" size={40} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>No matching products</Text>
          <Text style={styles.emptySubtext}>
            Try adjusting your filters or search query
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={handleClearFilters}>
            <Feather name="x" size={16} color="#FFFFFF" />
            <Text style={styles.emptyAddText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          numColumns={2}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              imageUrl={getImageUrl(item.image)}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={filterVisible}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
        onClear={handleClearFilters}
      />

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

/* ─── Product Card (Grid) ─── */

function ProductCard({
  product,
  imageUrl,
  onEdit,
  onDelete,
}: {
  product: Product;
  imageUrl: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stockColor =
    product.stock_quantity === 0
      ? '#DC2626'
      : product.stock_quantity <= 5
      ? '#F97316'
      : '#1B6B45';

  const stockLabel =
    product.stock_quantity === 0
      ? 'Out of stock'
      : product.stock_quantity <= 5
      ? 'Low stock'
      : `${product.stock_quantity} in stock`;

  return (
    <View style={styles.card}>
      {/* Image */}
      <View style={styles.cardImageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="fast-food-outline" size={28} color="#D1D5DB" />
          </View>
        )}
        {/* Availability badge */}
        {!product.is_available && (
          <View style={styles.unavailableBadge}>
            <Text style={styles.unavailableText}>Unavailable</Text>
          </View>
        )}
        {/* Stock badge */}
        <View style={[styles.stockBadge, { backgroundColor: `${stockColor}20` }]}>
          <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
          <Text style={[styles.stockText, { color: stockColor }]}>{stockLabel}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>{product.category}</Text>
        <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
        <View style={styles.cardPriceRow}>
          <Text style={styles.cardPrice}>₱{Number(product.price).toFixed(2)}</Text>
          <Text style={styles.cardUnit}>/{product.unit}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardActionBtn} onPress={onEdit}>
          <Feather name="edit-2" size={14} color="#1B6B45" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cardActionBtn, styles.cardDeleteBtn]} onPress={onDelete}>
          <Feather name="trash-2" size={14} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Filter Modal ─── */

function FilterModal({
  visible,
  filters,
  onApply,
  onClose,
  onClear,
}: {
  visible: boolean;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  function handleApply() {
    onApply(localFilters);
  }

  function handleReset() {
    setLocalFilters(INITIAL_FILTERS);
    onClear();
    onClose();
  }

  function toggleCategory(cat: string) {
    setLocalFilters((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        {/* Modal Header */}
        <View style={styles.filterModalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Filter & Sort</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.filterModalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sort By */}
          <View style={styles.filterSection}>
            <View style={styles.filterSectionHeader}>
              <MaterialCommunityIcons name="sort" size={18} color="#374151" />
              <Text style={styles.filterSectionTitle}>Sort By</Text>
            </View>
            <View style={styles.sortGrid}>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sortOption,
                    localFilters.sortBy === option.value && styles.sortOptionActive,
                  ]}
                  onPress={() => setLocalFilters((f) => ({ ...f, sortBy: option.value }))}
                >
                  <MaterialCommunityIcons
                    name={option.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={16}
                    color={localFilters.sortBy === option.value ? '#1B6B45' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.sortOptionText,
                      localFilters.sortBy === option.value && styles.sortOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Filter */}
          <View style={styles.filterSection}>
            <View style={styles.filterSectionHeader}>
              <Feather name="tag" size={16} color="#374151" />
              <Text style={styles.filterSectionTitle}>Category</Text>
              {localFilters.categories.length > 0 && (
                <Text style={styles.filterCountLabel}>{localFilters.categories.length} selected</Text>
              )}
            </View>
            <View style={styles.chipWrap}>
              {PRODUCT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterChip,
                    localFilters.categories.includes(cat) && styles.filterChipActive,
                  ]}
                  onPress={() => toggleCategory(cat)}
                >
                  {localFilters.categories.includes(cat) && (
                    <Feather name="check" size={12} color="#1B6B45" />
                  )}
                  <Text
                    style={[
                      styles.filterChipText,
                      localFilters.categories.includes(cat) && styles.filterChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price Range */}
          <View style={styles.filterSection}>
            <View style={styles.filterSectionHeader}>
              <Feather name="dollar-sign" size={16} color="#374151" />
              <Text style={styles.filterSectionTitle}>Price Range</Text>
            </View>
            <View style={styles.priceRangeRow}>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Min (₱)</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={localFilters.priceMin}
                  onChangeText={(text) => setLocalFilters((f) => ({ ...f, priceMin: text }))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.priceDivider}>
                <Text style={styles.priceDividerText}>—</Text>
              </View>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Max (₱)</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="∞"
                  placeholderTextColor="#9CA3AF"
                  value={localFilters.priceMax}
                  onChangeText={(text) => setLocalFilters((f) => ({ ...f, priceMax: text }))}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Stock Status */}
          <View style={styles.filterSection}>
            <View style={styles.filterSectionHeader}>
              <Feather name="package" size={16} color="#374151" />
              <Text style={styles.filterSectionTitle}>Stock Status</Text>
            </View>
            <View style={styles.statusRow}>
              {([
                { value: 'all', label: 'All', color: '#6B7280' },
                { value: 'in_stock', label: 'In Stock', color: '#1B6B45' },
                { value: 'low_stock', label: 'Low Stock', color: '#F97316' },
                { value: 'out_of_stock', label: 'Out of Stock', color: '#DC2626' },
              ] as { value: StockFilter; label: string; color: string }[]).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.statusChip,
                    localFilters.stockStatus === option.value && {
                      backgroundColor: `${option.color}15`,
                      borderColor: option.color,
                    },
                  ]}
                  onPress={() => setLocalFilters((f) => ({ ...f, stockStatus: option.value }))}
                >
                  {localFilters.stockStatus === option.value && (
                    <View style={[styles.statusDot, { backgroundColor: option.color }]} />
                  )}
                  <Text
                    style={[
                      styles.statusChipText,
                      localFilters.stockStatus === option.value && { color: option.color, fontWeight: '700' },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Availability */}
          <View style={styles.filterSection}>
            <View style={styles.filterSectionHeader}>
              <Feather name="eye" size={16} color="#374151" />
              <Text style={styles.filterSectionTitle}>Availability</Text>
            </View>
            <View style={styles.statusRow}>
              {([
                { value: 'all', label: 'All' },
                { value: 'available', label: 'Available' },
                { value: 'unavailable', label: 'Unavailable' },
              ] as { value: AvailabilityFilter; label: string }[]).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.availChip,
                    localFilters.availability === option.value && styles.availChipActive,
                  ]}
                  onPress={() => setLocalFilters((f) => ({ ...f, availability: option.value }))}
                >
                  <Text
                    style={[
                      styles.availChipText,
                      localFilters.availability === option.value && styles.availChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View style={styles.filterApplyContainer}>
          <TouchableOpacity style={styles.filterApplyBtn} onPress={handleApply} activeOpacity={0.85}>
            <Feather name="check" size={18} color="#FFFFFF" />
            <Text style={styles.filterApplyText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  const [imageFile, setImageFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description ?? '');
      setCategory(product.category);
      setPrice(String(product.price));
      setUnit(product.unit);
      setStock(String(product.stock_quantity));
      setImageFile(null);
    } else {
      setName('');
      setDescription('');
      setCategory('');
      setPrice('');
      setUnit('kg');
      setStock('');
      setImageFile(null);
    }
  }, [product, visible]);

  async function pickImage() {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageFile({
        uri: asset.uri,
        name: asset.fileName || `product_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    }
  }

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
      image: imageFile ?? undefined,
    });
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {product ? 'Edit Product' : 'New Product'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image Picker */}
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {imageFile ? (
              <Image source={{ uri: imageFile.uri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <Feather name="camera" size={28} color="#9CA3AF" />
                <Text style={styles.imagePickerText}>Add Photo</Text>
                <Text style={styles.imagePickerHint}>Tap to select from gallery</Text>
              </View>
            )}
            {imageFile && (
              <View style={styles.imageChangeOverlay}>
                <Feather name="camera" size={16} color="#FFFFFF" />
                <Text style={styles.imageChangeText}>Change</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Product Name <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Fresh Tilapia"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description of the product"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Category <Text style={styles.req}>*</Text></Text>
            <View style={styles.chipWrap}>
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
          </View>

          {/* Price + Unit */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Price (₱) <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Unit <Text style={styles.req}>*</Text></Text>
              <View style={styles.unitRow}>
                {PRODUCT_UNITS.map((u) => (
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
            </View>
          </View>

          {/* Stock */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Stock Quantity <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              value={stock}
              onChangeText={setStock}
              keyboardType="number-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1B6B45',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  // Search & Filter Bar
  searchFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    height: '100%',
  },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterToggleBtnActive: {
    backgroundColor: '#1B6B45',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Filter Pills
  filterPillsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#1B6B4530',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B6B45',
  },
  clearAllPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC262630',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },

  // Grid
  gridContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  gridRow: { gap: 12, marginBottom: 12 },

  // Empty state
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B6B45',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyAddText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Card
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardImageContainer: {
    height: CARD_WIDTH * 0.75,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#DC262690',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unavailableText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  stockBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockText: { fontSize: 10, fontWeight: '600' },

  // Card body
  cardBody: { padding: 12 },
  cardCategory: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 3, lineHeight: 18 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  cardPrice: { fontSize: 17, fontWeight: '800', color: '#1B6B45' },
  cardUnit: { fontSize: 12, color: '#9CA3AF', marginLeft: 2 },

  // Card actions
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cardDeleteBtn: {
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
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
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalContent: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },

  // Image Picker
  imagePicker: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
    position: 'relative',
  },
  imagePickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 16,
    margin: 2,
  },
  imagePickerText: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginTop: 8 },
  imagePickerHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  imagePreview: { width: '100%', height: '100%' },
  imageChangeOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  imageChangeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  // Form
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  req: { color: '#DC2626' },
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#DCFCE7', borderColor: '#1B6B45' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  chipTextActive: { color: '#1B6B45', fontWeight: '700' },

  // Unit chips
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unitChipActive: { backgroundColor: '#DCFCE7', borderColor: '#1B6B45' },
  unitChipText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  unitChipTextActive: { color: '#1B6B45', fontWeight: '700' },

  // Submit
  submitButton: {
    backgroundColor: '#1B6B45',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Filter Modal
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  filterModalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    flex: 1,
  },
  filterCountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B6B45',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // Sort Grid
  sortGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  sortOptionActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#1B6B45',
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  sortOptionTextActive: {
    color: '#1B6B45',
    fontWeight: '700',
  },

  // Filter Chips
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#1B6B45',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#1B6B45',
    fontWeight: '700',
  },

  // Price Range
  priceRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
  },
  priceInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  priceDivider: {
    paddingTop: 18,
  },
  priceDividerText: {
    fontSize: 16,
    color: '#9CA3AF',
  },

  // Stock Status
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },

  // Availability
  availChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  availChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#1B6B45',
  },
  availChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  availChipTextActive: {
    color: '#1B6B45',
    fontWeight: '700',
  },

  // Filter Apply Button
  filterApplyContainer: {
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
  filterApplyBtn: {
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
  filterApplyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
