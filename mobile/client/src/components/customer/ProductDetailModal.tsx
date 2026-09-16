/**
 * ProductDetailModal — production-ready product detail bottom sheet.
 *
 * Features:
 *  - Swipeable image gallery (placeholder emoji fallback)
 *  - Full product info: name, category, price, unit, description, vendor stall & location
 *  - Availability badge
 *  - Quantity selector with animated Add to Cart button
 *  - "Added to Cart" snackbar toast with slide-up animation
 *  - Heart / favorite toggle with pulse animation
 *  - Subtotal live calculation
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import type { MarketProduct } from '@/services/marketplace';
import { getProductReviews, type ReviewSummary } from '@/services/reviews';
import { StarRatingDisplay } from '@/components/customer/StarRating';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.32;

const CATEGORY_EMOJIS: Record<string, string> = {
  meat: '🥩',
  fish: '🐟',
  vegetables: '🥬',
  fruits: '🍎',
  spices: '🌶️',
  poultry: '🍗',
  condiments: '🫙',
  dairy: '🥛',
  grains: '🌾',
  herbs: '🌿',
};

const CATEGORY_COLORS: Record<string, string> = {
  meat: '#FFEBEE',
  fish: '#E3F2FD',
  vegetables: '#E8F5E9',
  fruits: '#FFF3E0',
  spices: '#FCE4EC',
  poultry: '#FFF8E1',
  condiments: '#F3E5F5',
  dairy: '#E8EAF6',
  grains: '#FFF9C4',
  herbs: '#F1F8E9',
};

interface Props {
  product: MarketProduct | null;
  visible: boolean;
  onClose: () => void;
}

/* ─── Snackbar Component ─── */

function AddedToCartSnackbar({ visible }: { visible: boolean }) {
  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        snackStyles.container,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
      pointerEvents="none"
    >
      <View style={snackStyles.inner}>
        <View style={snackStyles.iconWrap}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        </View>
        <Text style={snackStyles.text}>Added to Cart!</Text>
        <Ionicons name="cart" size={16} color="rgba(255,255,255,0.8)" />
      </View>
    </Animated.View>
  );
}

const snackStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1B6B45',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

/* ─── Image Gallery Dots ─── */

function GalleryDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  if (count <= 1) return null;
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[dotStyles.dot, i === activeIndex && dotStyles.dotActive]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },
});

/* ─── Main Component ─── */

export function ProductDetailModal({ product, visible, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const btnScaleAnim = useRef(new Animated.Value(1)).current;
  const heartScaleAnim = useRef(new Animated.Value(1)).current;

  const [quantity, setQuantity] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [snackVisible, setSnackVisible] = useState(false);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ratingSummary, setRatingSummary] = useState<ReviewSummary | null>(null);

  const { addItem, isInCart, items } = useCart();
  const { addProduct, removeProduct, isProductFavorited } = useFavorites();

  const inCart = product ? isInCart(product.id) : false;
  const cartItem = product ? items.find((i) => i.product_id === product.id) : null;
  const isFav = product ? isProductFavorited(product.id) : false;
  const isWeightProduct = product ? product.unit.toLowerCase() === 'kg' : false;
  const step = isWeightProduct ? 0.5 : 1;
  const minQty = isWeightProduct ? 0.5 : 1;

  function formatQty(q: number): string {
    return Number.isInteger(q) ? String(q) : q.toFixed(1).replace(/\.0$/, '');
  }

  /* Load the product's public rating summary when opened */
  useEffect(() => {
    if (!visible || !product) return;
    getProductReviews(product.id)
      .then(setRatingSummary)
      .catch(() => setRatingSummary(null));
  }, [visible, product]);

  /* Open / close animation */
  useEffect(() => {
    if (visible) {
      setQuantity(1);
      setGalleryIndex(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 290,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  /* Cleanup snack timer on unmount */
  useEffect(() => {
    return () => {
      if (snackTimer.current) clearTimeout(snackTimer.current);
    };
  }, []);

  function handleAddToCart() {
    if (!product) return;

    /* Button bounce */
    Animated.sequence([
      Animated.spring(btnScaleAnim, { toValue: 0.91, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScaleAnim, { toValue: 1.04, useNativeDriver: true, speed: 40 }),
      Animated.spring(btnScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();

    addItem({
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      unit: product.unit,
      category: product.category,
    }, quantity);

    /* Show snackbar */
    setSnackVisible(true);
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnackVisible(false), 2200);
  }

  function handleToggleFavorite() {
    if (!product) return;
    Animated.sequence([
      Animated.spring(heartScaleAnim, { toValue: 1.45, useNativeDriver: true, speed: 60 }),
      Animated.spring(heartScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    if (isFav) {
      removeProduct(product.id);
    } else {
      addProduct(product);
    }
  }

  function handleGalleryScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setGalleryIndex(idx);
  }

  if (!product) return null;

  const imageUrl = product.image
    ? `${API_BASE_URL.replace('/api/v1', '')}/storage/${product.image}`
    : null;

  /* We show the real image + a "zoomed" placeholder as second slide when no extra images exist */
  const galleryImages = imageUrl ? [imageUrl] : [];
  const categoryEmoji = CATEGORY_EMOJIS[product.category.toLowerCase()] ?? '🛒';
  const categoryBg = CATEGORY_COLORS[product.category.toLowerCase()] ?? '#F3F4F6';
  const subtotal = product.price * quantity;
  const categoryLabel = product.category.charAt(0).toUpperCase() + product.category.slice(1);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Drag Handle */}
        <View style={styles.dragHandle} />

        {/* ── Image Gallery ── */}
        <View style={styles.galleryContainer}>
          {galleryImages.length > 0 ? (
            <>
              <FlatList
                data={galleryImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => String(i)}
                onMomentumScrollEnd={handleGalleryScroll}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                )}
              />
              <GalleryDots count={galleryImages.length} activeIndex={galleryIndex} />
            </>
          ) : (
            <View style={[styles.galleryPlaceholder, { backgroundColor: categoryBg }]}>
              <Text style={styles.galleryPlaceholderEmoji}>{categoryEmoji}</Text>
              <Text style={styles.galleryPlaceholderLabel}>No photo available</Text>
            </View>
          )}

          {/* Gradient overlay at bottom for readability */}
          <View style={styles.galleryGradient} />

          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtnOverlay} onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#374151" />
          </TouchableOpacity>

          {/* Heart Button */}
          <TouchableOpacity style={styles.heartBtnOverlay} onPress={handleToggleFavorite} accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}>
            <Animated.View style={{ transform: [{ scale: heartScaleAnim }] }}>
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={20}
                color={isFav ? '#E11D48' : '#374151'}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Availability badge */}
          <View style={[styles.availBadge, !product.is_available && styles.availBadgeUnavail]}>
            <View style={[styles.availDot, !product.is_available && styles.availDotUnavail]} />
            <Text style={[styles.availText, !product.is_available && styles.availTextUnavail]}>
              {product.is_available ? 'Available' : 'Unavailable'}
            </Text>
          </View>
        </View>

        {/* ── Scrollable Content ── */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category chip */}
          <View style={[styles.categoryChip, { backgroundColor: categoryBg }]}>
            <Text style={styles.categoryEmoji}>{categoryEmoji}</Text>
            <Text style={styles.categoryLabel}>{categoryLabel}</Text>
          </View>

          {/* Product Name */}
          <Text style={styles.productName}>{product.name}</Text>

          {/* Vendor / Stall Info */}
          <View style={styles.vendorRow}>
            <Ionicons name="storefront-outline" size={14} color="#9CA3AF" />
            <Text style={styles.vendorText}>
              {product.vendor?.stall_name ?? 'Taguig People\'s Market'}
            </Text>
            {product.vendor?.stall_location ? (
              <>
                <Text style={styles.vendorDot}>·</Text>
                <Ionicons name="location-outline" size={13} color="#9CA3AF" />
                <Text style={styles.vendorText}>{product.vendor.stall_location}</Text>
              </>
            ) : null}
          </View>

          {/* Price + In-cart badge */}
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Price per {product.unit}</Text>
              <Text style={styles.price}>₱{Number(product.price).toFixed(2)}</Text>
            </View>
            {inCart && cartItem ? (
              <View style={styles.inCartBadge}>
                <Ionicons name="cart" size={13} color="#1B6B45" />
                <Text style={styles.inCartText}>{formatQty(cartItem.quantity)} {cartItem.unit} in cart</Text>
              </View>
            ) : null}
          </View>

          {/* Description */}
          {product.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descTitle}>About this product</Text>
              <Text style={styles.descText}>{product.description}</Text>
            </View>
          ) : null}

          {/* Info Grid */}
          <View style={styles.infoGrid}>
            <InfoTile icon="cube-outline" label="Unit" value={product.unit} />
            <InfoTile icon="pricetag-outline" label="Category" value={categoryLabel} />
            <InfoTile
              icon="storefront-outline"
              label="Stall"
              value={product.vendor?.stall_name ?? '—'}
            />
            <InfoTile
              icon="location-outline"
              label="Location"
              value={product.vendor?.stall_location ?? 'Taguig Market'}
            />
          </View>

          {/* Ratings */}
          {ratingSummary && ratingSummary.total > 0 && (
            <View style={styles.ratingBox}>
              <View style={styles.ratingTop}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.ratingTitle}>Ratings</Text>
                <View style={styles.ratingRight}>
                  <StarRatingDisplay value={ratingSummary.average_rating} total={ratingSummary.total} />
                </View>
              </View>
              {ratingSummary.reviews.slice(0, 3).map((review) => (
                <View key={review.id} style={styles.ratingRow}>
                  <View style={styles.ratingRowTop}>
                    <Text style={styles.ratingUserName}>{review.user}</Text>
                    <StarRatingDisplay value={review.rating} size={11} />
                  </View>
                  {review.comment ? (
                    <Text style={styles.ratingComment} numberOfLines={2}>{review.comment}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Quantity Selector */}
          <View style={styles.qtySection}>
            <Text style={styles.qtyLabel}>Quantity{isWeightProduct ? ' (kg)' : ''}</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity <= minQty && styles.qtyBtnDisabled]}
                onPress={() => setQuantity((q) => Math.max(minQty, Math.round((q - step) * 100) / 100))}
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={18} color={quantity <= minQty ? '#D1D5DB' : '#374151'} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{formatQty(quantity)} {isWeightProduct ? 'kg' : product.unit}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.round((q + step) * 100) / 100)}
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={18} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          {isWeightProduct && (
            <View style={styles.weightChipsRow}>
              <TouchableOpacity
                style={[styles.weightChip, quantity === 0.5 && styles.weightChipActive]}
                onPress={() => setQuantity(0.5)}
                activeOpacity={0.8}
              >
                <Text style={[styles.weightChipText, quantity === 0.5 && styles.weightChipTextActive]}>0.5 kg</Text>
                <Text style={styles.weightChipSub}>½ kilo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.weightChip, quantity === 1 && styles.weightChipActive]}
                onPress={() => setQuantity(1)}
                activeOpacity={0.8}
              >
                <Text style={[styles.weightChipText, quantity === 1 && styles.weightChipTextActive]}>1 kg</Text>
                <Text style={styles.weightChipSub}>1 kilo</Text>
              </TouchableOpacity>
              <View style={styles.weightHint}>
                <Ionicons name="information-circle-outline" size={12} color="#6B7280" />
                <Text style={styles.weightHintText}>Tap to select half or whole kilo</Text>
              </View>
            </View>
          )}

          {/* Subtotal */}
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Subtotal ({formatQty(quantity)} × ₱{Number(product.price).toFixed(2)})</Text>
            <Text style={styles.subtotalValue}>₱{subtotal.toFixed(2)}</Text>
          </View>

          {/* Add to Cart Button */}
          <Animated.View style={{ transform: [{ scale: btnScaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.addToCartBtn,
                inCart && styles.addToCartBtnActive,
                !product.is_available && styles.addToCartBtnDisabled,
              ]}
              onPress={handleAddToCart}
              disabled={!product.is_available}
              activeOpacity={0.85}
              accessibilityLabel={inCart ? 'Add more to cart' : 'Add to cart'}
            >
              <Ionicons
                name={inCart ? 'cart' : 'cart-outline'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.addToCartBtnText}>
                {!product.is_available
                  ? 'Currently Unavailable'
                  : inCart
                  ? 'Add More to Cart'
                  : 'Add to Cart'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom spacer */}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Snackbar Toast */}
        <AddedToCartSnackbar visible={snackVisible} />
      </Animated.View>
    </Modal>
  );
}

/* ─── InfoTile ─── */

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={tileStyles.tile}>
      <Ionicons name={icon as any} size={16} color="#1B6B45" />
      <Text style={tileStyles.label}>{label}</Text>
      <Text style={tileStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  label: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '700', color: '#111827' },
});

/* ─── Styles ─── */

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 0,
  },

  /* ── Gallery ── */
  galleryContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  galleryPlaceholder: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  galleryPlaceholderEmoji: { fontSize: 36 },
  galleryPlaceholderLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  galleryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: 'transparent',
  },

  closeBtnOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heartBtnOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  availBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  availBadgeUnavail: { backgroundColor: 'rgba(254,242,242,0.95)' },
  availDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  availDotUnavail: { backgroundColor: '#DC2626' },
  availText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  availTextUnavail: { color: '#DC2626' },

  /* ── Scroll Content ── */
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryEmoji: { fontSize: 14 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },

  productName: {
    fontSize: 23,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 28,
  },

  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  vendorText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  vendorDot: { fontSize: 12, color: '#D1D5DB' },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  priceLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  price: { fontSize: 28, fontWeight: '800', color: '#1B6B45' },
  inCartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inCartText: { fontSize: 12, fontWeight: '700', color: '#1B6B45' },

  descBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  descTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  descText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },

  /* ── Ratings ── */
  ratingBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  ratingTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', flex: 1 },
  ratingRight: { marginLeft: 'auto' },
  ratingRow: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#FEF3C7' },
  ratingRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ratingUserName: { fontSize: 12, fontWeight: '700', color: '#78350F' },
  ratingComment: { fontSize: 12, color: '#92400E', marginTop: 3, lineHeight: 17 },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },

  /* ── Quantity ── */
  qtySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  qtyLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qtyBtnDisabled: { borderColor: '#F9FAFB' },
  qtyValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    minWidth: 80,
    textAlign: 'center',
  },
  weightChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  weightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  weightChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#1B6B45',
  },
  weightChipText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  weightChipTextActive: { color: '#1B6B45' },
  weightChipSub: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  weightHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
  },
  weightHintText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  /* ── Subtotal ── */
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  subtotalLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  subtotalValue: { fontSize: 22, fontWeight: '800', color: '#111827' },

  /* ── Add to Cart ── */
  addToCartBtn: {
    backgroundColor: '#1B6B45',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 7,
  },
  addToCartBtnActive: { backgroundColor: '#15803D' },
  addToCartBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  addToCartBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
