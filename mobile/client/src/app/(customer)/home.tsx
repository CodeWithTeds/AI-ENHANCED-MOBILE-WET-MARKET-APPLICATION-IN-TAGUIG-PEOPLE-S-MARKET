/**
 * Customer Home Screen — marketplace with dynamic products.
 * Matches the reference UI: green header, categories, featured products, market hours.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  Share,
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
import { searchRecipe, type RecipeResult } from '@/services/recipe';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { ProductDetailModal } from '@/components/customer/ProductDetailModal';

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
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MarketProduct | null>(null);

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
    setRecipe(null);
    fetchData();
  }

  async function handleRecipeSearch() {
    const query = searchQuery.trim();
    if (!query || query.length < 2) return;

    setRecipeLoading(true);
    setRecipe(null);
    try {
      const result = await searchRecipe(query);
      setRecipe(result);
    } catch (err) {
      console.error('[Recipe] search failed:', err);
      setRecipe({ found: false, message: 'Failed to search. Check your connection.' });
    } finally {
      setRecipeLoading(false);
    }
  }

  function clearRecipe() {
    setRecipe(null);
    setSearchQuery('');
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
                onSubmitEditing={handleRecipeSearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchFilterBtn} onPress={handleRecipeSearch}>
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
        {/* Recipe Result (AI-generated) */}
        {recipeLoading && (
          <View style={styles.recipeLoading}>
            <ActivityIndicator size="small" color="#1B6B45" />
            <Text style={styles.recipeLoadingText}>Generating recipe...</Text>
          </View>
        )}

        {recipe && !recipeLoading && (
          <RecipeCard recipe={recipe} onClose={clearRecipe} />
        )}

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
              <ProductCard key={product.id} product={product} onPress={() => setSelectedProduct(product)} />
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

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        visible={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
      />
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

function ProductCard({ product, onPress }: { product: MarketProduct; onPress: () => void }) {
  const { addProduct, removeProduct, isProductFavorited } = useFavorites();
  const heartAnim = useRef(new Animated.Value(1)).current;
  const isFav = isProductFavorited(product.id);

  const imageUrl = product.image
    ? `${API_BASE_URL.replace('/api/v1', '')}/storage/${product.image}`
    : null;

  function handleToggleFavorite() {
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();

    if (isFav) {
      removeProduct(product.id);
    } else {
      addProduct(product);
    }
  }

  return (
    <TouchableOpacity style={styles.productCard} activeOpacity={0.85} onPress={onPress}>
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
        {/* Heart */}
        <TouchableOpacity style={styles.productHeartBtn} onPress={handleToggleFavorite}>
          <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={16} color={isFav ? '#E11D48' : '#FFFFFF'} />
          </Animated.View>
        </TouchableOpacity>
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

function RecipeCard({ recipe, onClose }: { recipe: RecipeResult; onClose: () => void }) {
  const { addRecipe, removeRecipe, isRecipeFavorited } = useFavorites();
  const heartAnim = useRef(new Animated.Value(1)).current;
  const isFav = recipe.recipe_name ? isRecipeFavorited(recipe.recipe_name) : false;

  function handleToggleFavorite() {
    // Pulse animation
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();

    if (isFav) {
      const id = recipe.recipe_name!.toLowerCase().replace(/\s+/g, '-');
      removeRecipe(id);
    } else {
      addRecipe(recipe);
    }
  }

  if (!recipe.found) {
    return (
      <View style={styles.recipeCard}>
        <View style={styles.recipeHeader}>
          <Ionicons name="alert-circle-outline" size={20} color="#F97316" />
          <Text style={styles.recipeNotFound}>{recipe.message || 'Recipe not found'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.recipeCard}>
      {/* Header */}
      <View style={styles.recipeHeader}>
        <View style={styles.recipeAiBadge}>
          <Ionicons name="flash" size={12} color="#FFFFFF" />
          <Text style={styles.recipeAiBadgeText}>AI Recipe</Text>
        </View>
        <View style={styles.recipeHeaderActions}>
          {/* Heart / Favorite */}
          <TouchableOpacity onPress={handleToggleFavorite} accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}>
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={22}
                color={isFav ? '#E11D48' : '#9CA3AF'}
              />
            </Animated.View>
          </TouchableOpacity>
          {/* Close */}
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.recipeName}>{recipe.recipe_name}</Text>
      <Text style={styles.recipeDesc}>{recipe.description}</Text>

      {/* Meta */}
      <View style={styles.recipeMeta}>
        <View style={styles.recipeMetaItem}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text style={styles.recipeMetaText}>{recipe.cook_time}</Text>
        </View>
        <View style={styles.recipeMetaItem}>
          <Ionicons name="people-outline" size={14} color="#6B7280" />
          <Text style={styles.recipeMetaText}>{recipe.servings}</Text>
        </View>
        <View style={styles.recipeMetaItem}>
          <Ionicons name="restaurant-outline" size={14} color="#6B7280" />
          <Text style={styles.recipeMetaText}>{recipe.prep_time} prep</Text>
        </View>
      </View>

      {/* Ingredients */}
      <Text style={styles.recipeSubtitle}>Ingredients</Text>
      {recipe.ingredients?.map((ing, i) => (
        <View key={i} style={styles.ingredientRow}>
          <Ionicons
            name={ing.available_in_market ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={ing.available_in_market ? '#1B6B45' : '#D1D5DB'}
          />
          <Text style={styles.ingredientText}>
            {ing.quantity} {ing.name}
          </Text>
          {ing.available_in_market && (
            <View style={styles.ingredientBadge}>
              <Text style={styles.ingredientBadgeText}>In Market</Text>
            </View>
          )}
        </View>
      ))}

      {/* Orderable Products */}
      {recipe.matching_products && recipe.matching_products.length > 0 && (
        <>
          <Text style={[styles.recipeSubtitle, { marginTop: 14 }]}>🛒 Order from Market</Text>
          {recipe.matching_products.map((mp, i) => (
            <MarketProductRow key={i} product={mp} />
          ))}
        </>
      )}

      {/* Steps */}
      <Text style={[styles.recipeSubtitle, { marginTop: 14 }]}>Steps</Text>
      {recipe.steps?.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      {/* Tips */}
      {recipe.tips && (
        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={14} color="#F97316" />
          <Text style={styles.tipText}>{recipe.tips}</Text>
        </View>
      )}

      {/* Download/Share Button */}
      <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownloadRecipe(recipe)}>
        <Ionicons name="download-outline" size={18} color="#FFFFFF" />
        <Text style={styles.downloadBtnText}>Save Recipe</Text>
      </TouchableOpacity>
    </View>
  );
}

function MarketProductRow({ product }: { product: NonNullable<RecipeResult['matching_products']>[number] }) {
  const { addItem, isInCart } = useCart();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const [added, setAdded] = useState(isInCart(product.product_id));

  function handleAddToCart() {
    if (added) return;

    // Bounce animation
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, speed: 40 }),
      Animated.spring(scaleAnim, { toValue: 1.08, useNativeDriver: true, speed: 30 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();

    // Checkmark fade-in
    Animated.timing(checkAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    addItem({
      product_id: product.product_id,
      product_name: product.product_name,
      price: product.price,
      unit: product.unit,
      category: product.category,
    });

    setAdded(true);
  }

  return (
    <View style={styles.matchingProductRow}>
      <View style={styles.matchingProductInfo}>
        <Text style={styles.matchingProductName}>{product.product_name}</Text>
        <Text style={styles.matchingProductMeta}>{product.category} · per {product.unit}</Text>
      </View>
      <Text style={styles.matchingProductPrice}>₱{Number(product.price).toFixed(0)}</Text>

      <TouchableOpacity
        onPress={handleAddToCart}
        activeOpacity={0.8}
        accessibilityLabel={added ? 'Added to cart' : 'Add to cart'}
      >
        <Animated.View
          style={[
            styles.addCartBtn,
            added && styles.addCartBtnAdded,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Animated.View style={{ opacity: added ? checkAnim : 1 }}>
            <Ionicons
              name={added ? 'checkmark' : 'add'}
              size={18}
              color="#FFFFFF"
            />
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

async function handleDownloadRecipe(recipe: RecipeResult) {
  if (!recipe.found) return;

  const text = formatRecipeAsText(recipe);

  try {
    await Share.share({
      message: text,
      title: recipe.recipe_name ?? 'Recipe',
    });
  } catch (err) {
    console.error('[Recipe] share failed:', err);
  }
}

function formatRecipeAsText(recipe: RecipeResult): string {
  let text = `🍳 ${recipe.recipe_name}\n`;
  text += `${recipe.description}\n\n`;
  text += `⏱ Cook: ${recipe.cook_time} | Prep: ${recipe.prep_time} | Serves: ${recipe.servings}\n\n`;

  text += `📝 INGREDIENTS\n`;
  recipe.ingredients?.forEach((ing) => {
    const marker = ing.available_in_market ? '✅' : '○';
    text += `${marker} ${ing.quantity} ${ing.name}\n`;
  });

  if (recipe.matching_products && recipe.matching_products.length > 0) {
    text += `\n🛒 AVAILABLE AT TAGUIG PEOPLE'S MARKET\n`;
    recipe.matching_products.forEach((mp) => {
      text += `• ${mp.product_name} — ₱${Number(mp.price).toFixed(0)}/${mp.unit}\n`;
    });
  }

  text += `\n👨‍🍳 STEPS\n`;
  recipe.steps?.forEach((step, i) => {
    text += `${i + 1}. ${step}\n`;
  });

  if (recipe.tips) {
    text += `\n💡 TIP: ${recipe.tips}\n`;
  }

  text += `\n— Generated by TaguigSuki AI`;
  return text;
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
  productHeartBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
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

  // Recipe Loading
  recipeLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E8F5E9' },
  recipeLoadingText: { fontSize: 14, color: '#1B6B45', fontWeight: '600' },

  // Recipe Card
  recipeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E8F5E9' },
  recipeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  recipeHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recipeAiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1B6B45', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  recipeAiBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  recipeNotFound: { flex: 1, fontSize: 13, color: '#6B7280', marginLeft: 8 },
  recipeName: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  recipeDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  recipeMeta: { flexDirection: 'row', gap: 16, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recipeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipeMetaText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  recipeSubtitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },

  // Ingredients
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  ingredientText: { flex: 1, fontSize: 13, color: '#374151' },
  ingredientBadge: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ingredientBadgeText: { fontSize: 10, fontWeight: '600', color: '#1B6B45' },

  // Matching Products
  matchingProductRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 6 },
  matchingProductInfo: { flex: 1 },
  matchingProductName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  matchingProductMeta: { fontSize: 11, color: '#9CA3AF' },
  matchingProductPrice: { fontSize: 15, fontWeight: '800', color: '#1B6B45', marginRight: 10 },
  addCartBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#1B6B45', alignItems: 'center', justifyContent: 'center' },
  addCartBtnAdded: { backgroundColor: '#16A34A' },

  // Steps
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1B6B45', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  stepText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },

  // Tips
  tipBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12, marginTop: 12 },
  tipText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  // Download button
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B6B45', borderRadius: 12, paddingVertical: 12, marginTop: 16 },
  downloadBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
