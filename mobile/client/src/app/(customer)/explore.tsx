/**
 * Favorites — saved AI recipes and market products.
 * Quick access to everything the customer has hearted.
 */

import { useRef, useState } from 'react';
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
import { useFavorites, type FavoriteRecipe, type FavoriteProduct } from '@/context/FavoritesContext';
import { useCart } from '@/context/CartContext';

type Tab = 'recipes' | 'products';

export default function FavoritesScreen() {
  const { recipes, products } = useFavorites();
  const [activeTab, setActiveTab] = useState<Tab>('recipes');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.headerSubtitle}>
          {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} · {products.length} product{products.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TabButton label="Recipes" count={recipes.length} icon="flash-outline" active={activeTab === 'recipes'} onPress={() => setActiveTab('recipes')} />
        <TabButton label="Products" count={products.length} icon="cube-outline" active={activeTab === 'products'} onPress={() => setActiveTab('products')} />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'recipes' ? (
          recipes.length === 0 ? (
            <EmptyState
              icon="flash-outline"
              title="No saved recipes yet"
              subtitle="Search for a Filipino dish and tap the heart icon to save it here"
            />
          ) : (
            recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)
          )
        ) : (
          products.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No saved products yet"
              subtitle="Tap the heart icon on any product in the marketplace to save it"
            />
          ) : (
            products.map((product) => <ProductCard key={product.id} product={product} />)
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Recipe Card ─── */

function RecipeCard({ recipe }: { recipe: FavoriteRecipe }) {
  const { removeRecipe } = useFavorites();
  const [expanded, setExpanded] = useState(false);
  const heartAnim = useRef(new Animated.Value(1)).current;

  function handleRemove() {
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start(() => removeRecipe(recipe.id));
  }

  const savedDate = new Date(recipe.saved_at).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.recipeCard}>
      {/* Top Row */}
      <View style={styles.recipeTop}>
        <View style={styles.recipeAiBadge}>
          <Ionicons name="flash" size={11} color="#FFFFFF" />
          <Text style={styles.recipeAiBadgeText}>AI Recipe</Text>
        </View>
        <View style={styles.recipeTopActions}>
          <Text style={styles.savedDate}>{savedDate}</Text>
          <TouchableOpacity onPress={handleRemove}>
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Ionicons name="heart" size={20} color="#E11D48" />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Title & Meta */}
      <Text style={styles.recipeName}>{recipe.recipe_name}</Text>
      <Text style={styles.recipeDesc} numberOfLines={expanded ? undefined : 2}>{recipe.description}</Text>

      {/* Meta chips */}
      <View style={styles.metaRow}>
        <MetaChip icon="time-outline" label={recipe.cook_time} />
        <MetaChip icon="people-outline" label={recipe.servings} />
        <MetaChip icon="restaurant-outline" label={`${recipe.prep_time} prep`} />
      </View>

      {/* Expand / Collapse */}
      <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(!expanded)}>
        <Text style={styles.expandBtnText}>{expanded ? 'Show less' : 'View full recipe'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#1B6B45" />
      </TouchableOpacity>

      {expanded && (
        <ExpandedRecipe recipe={recipe} />
      )}
    </View>
  );
}

function ExpandedRecipe({ recipe }: { recipe: FavoriteRecipe }) {
  const { addItem, isInCart } = useCart();

  return (
    <View style={styles.expanded}>
      {/* Ingredients */}
      <Text style={styles.expandSection}>Ingredients</Text>
      {recipe.ingredients?.map((ing, i) => (
        <View key={i} style={styles.ingredientRow}>
          <Ionicons
            name={ing.available_in_market ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={ing.available_in_market ? '#1B6B45' : '#D1D5DB'}
          />
          <Text style={styles.ingredientText}>{ing.quantity} {ing.name}</Text>
        </View>
      ))}

      {/* Market Products */}
      {recipe.matching_products && recipe.matching_products.length > 0 && (
        <>
          <Text style={[styles.expandSection, { marginTop: 12 }]}>🛒 Order from Market</Text>
          {recipe.matching_products.map((mp, i) => {
            const inCart = isInCart(mp.product_id);
            return (
              <View key={i} style={styles.marketRow}>
                <View style={styles.marketInfo}>
                  <Text style={styles.marketName}>{mp.product_name}</Text>
                  <Text style={styles.marketMeta}>{mp.category} · per {mp.unit}</Text>
                </View>
                <Text style={styles.marketPrice}>₱{Number(mp.price).toFixed(0)}</Text>
                <TouchableOpacity
                  style={[styles.addBtn, inCart && styles.addBtnAdded]}
                  onPress={() => !inCart && addItem({ product_id: mp.product_id, product_name: mp.product_name, price: mp.price, unit: mp.unit, category: mp.category, quantity: 1 })}
                >
                  <Ionicons name={inCart ? 'checkmark' : 'add'} size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      {/* Steps */}
      <Text style={[styles.expandSection, { marginTop: 12 }]}>Steps</Text>
      {recipe.steps?.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      {/* Tips */}
      {recipe.tips && (
        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={13} color="#F97316" />
          <Text style={styles.tipText}>{recipe.tips}</Text>
        </View>
      )}
    </View>
  );
}

/* ─── Product Card ─── */

function ProductCard({ product }: { product: FavoriteProduct }) {
  const { removeProduct } = useFavorites();
  const { addItem, isInCart } = useCart();
  const heartAnim = useRef(new Animated.Value(1)).current;
  const inCart = isInCart(product.id);

  function handleRemove() {
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start(() => removeProduct(product.id));
  }

  const savedDate = new Date(product.saved_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={styles.productCard}>
      <View style={styles.productEmoji}>
        <Text style={styles.productEmojiText}>{getCategoryEmoji(product.category)}</Text>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productMeta}>{product.category} · per {product.unit}</Text>
        {product.stall_name && (
          <Text style={styles.productStall}>
            <Ionicons name="storefront-outline" size={10} color="#9CA3AF" /> {product.stall_name}
          </Text>
        )}
      </View>
      <View style={styles.productRight}>
        <Text style={styles.productPrice}>₱{Number(product.price).toFixed(0)}</Text>
        <Text style={styles.savedDate}>{savedDate}</Text>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.addBtn, inCart && styles.addBtnAdded]}
            onPress={() => !inCart && addItem({ product_id: product.id, product_name: product.name, price: product.price, unit: product.unit, category: product.category })}
          >
            <Ionicons name={inCart ? 'checkmark' : 'add'} size={15} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRemove}>
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Ionicons name="heart" size={18} color="#E11D48" />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ─── Reusables ─── */

function TabButton({ label, count, icon, active, onPress }: {
  label: string; count: number; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Ionicons name={icon as any} size={16} color={active ? '#1B6B45' : '#9CA3AF'} />
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={[styles.tabCount, active && styles.tabCountActive]}>
          <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MetaChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon as any} size={12} color="#6B7280" />
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={40} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

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

  // Header
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12, marginTop: 6 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6',
  },
  tabBtnActive: { backgroundColor: '#DCFCE7', borderColor: '#1B6B45' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabBtnTextActive: { color: '#1B6B45' },
  tabCount: { backgroundColor: '#F3F4F6', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2 },
  tabCountActive: { backgroundColor: '#1B6B45' },
  tabCountText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },
  tabCountTextActive: { color: '#FFFFFF' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  // Recipe Card
  recipeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  recipeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recipeTopActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipeAiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1B6B45', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  recipeAiBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  savedDate: { fontSize: 11, color: '#9CA3AF' },
  recipeName: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 4 },
  recipeDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  metaChipText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  expandBtnText: { fontSize: 13, fontWeight: '600', color: '#1B6B45' },

  // Expanded
  expanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  expandSection: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  ingredientText: { fontSize: 13, color: '#374151' },
  marketRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 6 },
  marketInfo: { flex: 1 },
  marketName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  marketMeta: { fontSize: 11, color: '#9CA3AF' },
  marketPrice: { fontSize: 14, fontWeight: '800', color: '#1B6B45', marginRight: 8 },
  addBtn: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#1B6B45', alignItems: 'center', justifyContent: 'center' },
  addBtnAdded: { backgroundColor: '#16A34A' },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#1B6B45', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  stepText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  tipBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFF7ED', borderRadius: 8, padding: 10, marginTop: 8 },
  tipText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  // Product Card
  productCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#F3F4F6', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  productEmoji: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  productEmojiText: { fontSize: 22 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  productMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  productStall: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  productRight: { alignItems: 'flex-end', gap: 4 },
  productPrice: { fontSize: 15, fontWeight: '800', color: '#1B6B45' },
  productActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
});
