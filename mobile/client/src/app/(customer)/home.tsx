/**
 * Customer Home Screen — marketplace with dynamic products.
 * Matches the reference UI: green header, categories, featured products, market hours.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/config/api';
import {
  getCategories,
  getFeaturedProducts,
  browseProducts,
  type MarketProduct,
} from '@/services/marketplace';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

/* ─── Category icons mapping (using emojis for reliability) ─── */
const CATEGORY_EMOJIS: Record<string, { emoji: string; bg: string }> = {
  all: { emoji: '🛒', bg: '#E8F5E9' },
  meat: { emoji: '🥩', bg: '#FFEBEE' },
  fish: { emoji: '🐟', bg: '#E3F2FD' },
  vegetables: { emoji: '🥬', bg: '#E8F5E9' },
  fruits: { emoji: '🍎', bg: '#FFF3E0' },
  spices: { emoji: '🌶️', bg: '#FCE4EC' },
};

export default function CustomerHomeScreen() {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const greeting = getGreeting();

  const fetchData = useCallback(async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        getFeaturedProducts(),
        getCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('[Home] fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCategoryPress(category: string) {
    setSelectedCategory(category);
    setLoading(true);
    try {
      if (category === 'all') {
        const data = await getFeaturedProducts();
        setProducts(data);
      } else {
        const data = await browseProducts(category);
        setProducts(data.data ?? data as unknown as MarketProduct[]);
      }
    } catch (err) {
      console.error('[Home] category filter failed:', err);
    } finally {
      setLoading(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    setSelectedCategory('all');
    fetchData();
  }

  return (
    <View style={styles.screen}>
      {/* Green Header */}
      <View style={styles.headerBg}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.headerTopRow}>
              <View>
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={12} color="#F97316" />
                  <Text style={styles.locationLabel}>Market Location</Text>
                </View>
                <Text style={styles.marketName}>Taguig People's Market</Text>
              </View>
              <TouchableOpacity style={styles.notifButton} accessibilityLabel="Notifications">
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.greetingText}>{greeting} 🇵🇭</Text>
            <Text style={styles.headline}>What will you cook today?</Text>

            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search recipes or ingredients..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.searchFilterBtn}>
                <Ionicons name="flash" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B6B45" />}
      >
        {/* Categories */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
          <CategoryChip
            label="All"
            emoji="🛒"
            bgColor="#E8F5E9"
            isActive={selectedCategory === 'all'}
            onPress={() => handleCategoryPress('all')}
          />
          {categories.map((cat) => {
            const config = CATEGORY_EMOJIS[cat.toLowerCase()] ?? { emoji: '📦', bg: '#F3F4F6' };
            return (
              <CategoryChip
                key={cat}
                label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                emoji={config.emoji}
                bgColor={config.bg}
                isActive={selectedCategory === cat}
                onPress={() => handleCategoryPress(cat)}
              />
            );
          })}
        </ScrollView>

        {/* Featured Products */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="flame-outline" size={16} color="#F97316" />
            <Text style={styles.sectionTitle}>Featured Products</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all &gt;</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1B6B45" />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="basket-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No products available yet</Text>
            <Text style={styles.emptySubtext}>Check back when vendors add their goods!</Text>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        )}

        {/* Market Hours */}
        <View style={styles.marketHoursCard}>
          <View style={styles.marketHoursContent}>
            <Text style={styles.marketHoursLabel}>Today's Market Hours</Text>
            <Text style={styles.marketHoursTime}>4:00 AM – 2:00 PM</Text>
            <Text style={styles.marketHoursNote}>Fresh deliveries every morning!</Text>
          </View>
          <View style={styles.marketHoursIcon}>
            <MaterialCommunityIcons name="truck-delivery" size={24} color="#FFFFFF" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Components ─── */

function CategoryChip({ label, emoji, bgColor, isActive, onPress }: {
  label: string; emoji: string; bgColor: string; isActive: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.categoryChip, isActive && styles.categoryChipActive]} onPress={onPress}>
      <View style={[styles.categoryIcon, { backgroundColor: isActive ? '#1B6B45' : bgColor }]}>
        <Text style={styles.categoryEmoji}>{emoji}</Text>
      </View>
      <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProductCard({ product }: { product: MarketProduct }) {
  const imageUrl = product.image
    ? `${API_BASE_URL.replace('/api/v1', '')}/storage/${product.image}`
    : null;

  return (
    <TouchableOpacity style={styles.productCard} activeOpacity={0.85}>
      {/* Image */}
      <View style={styles.productImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="image-outline" size={28} color="#D1D5DB" />
          </View>
        )}
        {/* Badge */}
        <View style={styles.productBadge}>
          <Ionicons name="star" size={10} color="#F97316" />
          <Text style={styles.productBadgeText}>Fresh</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productVendor} numberOfLines={1}>
          {product.vendor?.stall_name ?? 'Market Vendor'}
        </Text>
        <View style={styles.productBottom}>
          <Text style={styles.productUnit}>per {product.unit}</Text>
          <Text style={styles.productPrice}>₱{Number(product.price).toFixed(0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 18) return 'Good afternoon!';
  return 'Good evening!';
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  headerBg: { backgroundColor: '#1B6B45', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, paddingBottom: 18 },
  headerContent: { paddingHorizontal: 20, paddingTop: 6 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationLabel: { fontSize: 11, color: '#86EFAC', fontWeight: '500' },
  marketName: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },
  notifButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  greetingText: { fontSize: 13, color: '#86EFAC', fontWeight: '500', marginTop: 12 },
  headline: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 2, marginBottom: 14 },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, height: 46, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#374151' },
  searchFilterBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#1B6B45' },

  // Categories
  categoriesRow: { gap: 14, paddingBottom: 16 },
  categoryChip: { alignItems: 'center', gap: 6 },
  categoryChipActive: {},
  categoryIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  categoryEmoji: { fontSize: 22 },
  categoryLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  categoryLabelActive: { color: '#1B6B45', fontWeight: '700' },

  // Products Grid
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, marginBottom: 20 },
  productCard: { width: CARD_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  productImageWrap: { width: '100%', height: CARD_WIDTH * 0.7, backgroundColor: '#F3F4F6', position: 'relative' },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  productBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  productBadgeText: { fontSize: 10, fontWeight: '600', color: '#F97316' },
  productInfo: { padding: 10 },
  productName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  productVendor: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  productUnit: { fontSize: 11, color: '#9CA3AF' },
  productPrice: { fontSize: 16, fontWeight: '800', color: '#1B6B45' },

  // Loading / Empty
  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptySubtext: { fontSize: 13, color: '#9CA3AF' },

  // Market Hours
  marketHoursCard: { flexDirection: 'row', backgroundColor: '#F97316', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'space-between' },
  marketHoursContent: { flex: 1 },
  marketHoursLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  marketHoursTime: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  marketHoursNote: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  marketHoursIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});
