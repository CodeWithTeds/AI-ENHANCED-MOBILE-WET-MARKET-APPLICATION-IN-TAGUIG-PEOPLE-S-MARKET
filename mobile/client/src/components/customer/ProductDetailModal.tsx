/**
 * ProductDetailModal — production-ready product detail bottom sheet.
 *
 * Features:
 *  - Swipeable image gallery (placeholder emoji fallback)
 *  - Full product info: name, category, price, unit, description, vendor stall & location
 *  - Availability badge
 *  - Prominent Stall Reporting:
 *      1. Top-right action button overlay with amber flag icon
 *      2. Vendor stall card inline "Report" badge button
 *      3. Dedicated "Report Stall or Product Concern" banner row
 *  - Quantity selector with animated Add to Cart button
 *  - "Added to Cart" snackbar toast with slide-up animation
 *  - Heart / favorite toggle with pulse animation
 *  - Subtotal live calculation
 *  - Vendor comparison & AI recommendations dropdown
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
import { router } from 'expo-router';
import { API_BASE_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { getProductDetail, type MarketProduct, type VendorComparisonItem } from '@/services/marketplace';
import { getProductReviews, type ReviewSummary } from '@/services/reviews';
import { StarRatingDisplay } from '@/components/customer/StarRating';
import { getCategoryConfig, getCategoryImage } from '@/constants/categories';
import { getProductImageUrl } from '@/utils/image';
import { StallComplaintModal } from '@/components/customer/StallComplaintModal';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.32;

interface Props {
  product: MarketProduct | null;
  visible: boolean;
  onClose: () => void;
  onOpenVendorStore?: (vendorId: number) => void;
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

export function ProductDetailModal({ product, visible, onClose, onOpenVendorStore }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const btnScaleAnim = useRef(new Animated.Value(1)).current;
  const heartScaleAnim = useRef(new Animated.Value(1)).current;

  const [quantity, setQuantity] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [snackVisible, setSnackVisible] = useState(false);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ratingSummary, setRatingSummary] = useState<ReviewSummary | null>(null);

  const [activeProduct, setActiveProduct] = useState<MarketProduct | null>(product);
  const [comparisonVendors, setComparisonVendors] = useState<VendorComparisonItem[]>([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  useEffect(() => {
    setActiveProduct(product);
    setShowVendorDropdown(false);
    if (!product || !visible) return;
    getProductDetail(product.id)
      .then((detail) => {
        if (detail.comparison_vendors) {
          setComparisonVendors(detail.comparison_vendors);
          if (detail.comparison_vendors.length > 1) {
            setShowVendorDropdown(true);
          }
        }
      })
      .catch(() => {});
  }, [product, visible]);

  const displayProduct = activeProduct ?? product;

  const { addItem, isInCart, items, startBuyNow } = useCart();
  const { addProduct, removeProduct, isProductFavorited } = useFavorites();

  const inCart = displayProduct ? isInCart(displayProduct.id) : false;
  const cartItem = displayProduct ? items.find((i) => i.product_id === displayProduct.id) : null;
  const isFav = displayProduct ? isProductFavorited(displayProduct.id) : false;
  const isWeightProduct = displayProduct ? displayProduct.unit.toLowerCase() === 'kg' : false;
  const step = isWeightProduct ? 0.5 : 1;
  const minQty = isWeightProduct ? 0.5 : 1;

  const vendorHours = displayProduct?.vendor?.operating_hours ?? '4:00 AM - 8:00 PM';
  const isStoreOpen = displayProduct?.vendor?.is_open ?? computeIsOpen(displayProduct?.vendor?.opening_time, displayProduct?.vendor?.closing_time);

  function formatQty(q: number): string {
    return Number.isInteger(q) ? String(q) : q.toFixed(1).replace(/\.0$/, '');
  }

  /* Load the product's public rating summary when opened */
  useEffect(() => {
    if (!visible || !displayProduct) return;
    getProductReviews(displayProduct.id)
      .then(setRatingSummary)
      .catch(() => setRatingSummary(null));
  }, [visible, displayProduct]);

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
    if (!displayProduct) return;

    /* Button bounce */
    Animated.sequence([
      Animated.spring(btnScaleAnim, { toValue: 0.91, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScaleAnim, { toValue: 1.04, useNativeDriver: true, speed: 40 }),
      Animated.spring(btnScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();

    addItem({
      product_id: displayProduct.id,
      product_name: displayProduct.name,
      price: displayProduct.price,
      unit: displayProduct.unit,
      category: displayProduct.category,
      image: displayProduct.image,
    }, quantity);

    /* Show snackbar */
    setSnackVisible(true);
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnackVisible(false), 2200);
  }

  function handleBuyNow() {
    if (!displayProduct || !displayProduct.is_available) return;

    startBuyNow({
      product_id: displayProduct.id,
      product_name: displayProduct.name,
      price: displayProduct.price,
      unit: displayProduct.unit,
      category: displayProduct.category,
      image: displayProduct.image,
    }, quantity);

    onClose();
    router.navigate('/(customer)/cart' as any);
  }

  function handleToggleFavorite() {
    if (!displayProduct) return;
    Animated.sequence([
      Animated.spring(heartScaleAnim, { toValue: 1.45, useNativeDriver: true, speed: 60 }),
      Animated.spring(heartScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    if (isFav) {
      removeProduct(displayProduct.id);
    } else {
      addProduct(displayProduct);
    }
  }

  function handleGalleryScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setGalleryIndex(idx);
  }

  const [failedImgProductId, setFailedImgProductId] = useState<number | null>(null);

  if (!displayProduct) return null;

  const galleryImgError = failedImgProductId === displayProduct.id;
  const imageUrl = getProductImageUrl(displayProduct.image);

  /* We show the real image + a "zoomed" placeholder as second slide when no extra images exist */
  const galleryImages = imageUrl && !galleryImgError ? [imageUrl] : [];
  const categoryConfig = getCategoryConfig(displayProduct.category);
  const categoryEmoji = categoryConfig.emoji;
  const categoryBg = categoryConfig.bg;
  const subtotal = displayProduct.price * quantity;
  const categoryLabel = categoryConfig.label;

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
                    onError={() => setFailedImgProductId(displayProduct.id)}
                  />
                )}
              />
              <GalleryDots count={galleryImages.length} activeIndex={galleryIndex} />
            </>
          ) : (
            <Image
              source={getCategoryImage(displayProduct.category)}
              style={styles.galleryImage}
              resizeMode="cover"
            />
          )}

          {/* Gradient overlay at bottom for readability */}
          <View style={styles.galleryGradient} />

          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtnOverlay} onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#374151" />
          </TouchableOpacity>

          {/* Top Right Action Buttons (Report + Heart) */}
          <View style={styles.topRightActions}>
            {/* Report Stall / Product Button */}
            <TouchableOpacity
              style={styles.iconBtnOverlay}
              onPress={() => setComplaintOpen(true)}
              accessibilityLabel="Report Stall"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="flag" size={17} color="#D97706" />
            </TouchableOpacity>

            {/* Heart Button */}
            <TouchableOpacity
              style={styles.iconBtnOverlay}
              onPress={handleToggleFavorite}
              accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View style={{ transform: [{ scale: heartScaleAnim }] }}>
                <Ionicons
                  name={isFav ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFav ? '#E11D48' : '#374151'}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Availability badge */}
          <View style={[styles.availBadge, !displayProduct.is_available && styles.availBadgeUnavail]}>
            <View style={[styles.availDot, !displayProduct.is_available && styles.availDotUnavail]} />
            <Text style={[styles.availText, !displayProduct.is_available && styles.availTextUnavail]}>
              {displayProduct.is_available ? 'Available' : 'Unavailable'}
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
          <Text style={styles.productName}>{displayProduct.name}</Text>

          {/* Vendor / Stall Info & Operating Hours */}
          <TouchableOpacity
            style={styles.vendorStoreCard}
            onPress={() => displayProduct.vendor?.id && onOpenVendorStore?.(displayProduct.vendor.id)}
            disabled={!displayProduct.vendor?.id || !onOpenVendorStore}
            activeOpacity={0.8}
          >
            <View style={styles.vendorStoreTop}>
              <View style={styles.vendorStoreLeft}>
                <View style={styles.vendorStoreIcon}>
                  <Ionicons name="storefront" size={15} color="#1B6B45" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vendorStoreName}>
                    {displayProduct.vendor?.stall_name ?? 'Taguig People\'s Market'}
                  </Text>
                  {displayProduct.vendor?.stall_location ? (
                    <Text style={styles.vendorStoreLoc}>{displayProduct.vendor.stall_location}</Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setComplaintOpen(true)}
                  style={styles.reportBadgeBtn}
                  activeOpacity={0.8}
                  accessibilityLabel="Report Stall"
                >
                  <Ionicons name="flag" size={11} color="#D97706" />
                  <Text style={styles.reportBadgeText}>Report</Text>
                </TouchableOpacity>

                <View style={[styles.storeBadge, isStoreOpen ? styles.storeBadgeOpen : styles.storeBadgeClosed]}>
                  <View style={[styles.storeBadgeDot, isStoreOpen ? styles.storeDotOpen : styles.storeDotClosed]} />
                  <Text style={[styles.storeBadgeText, isStoreOpen ? styles.storeTextOpen : styles.storeTextClosed]}>
                    {isStoreOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.vendorHoursRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                <Ionicons name="time-outline" size={12} color="#6B7280" />
                <Text style={styles.vendorHoursText}>Hours: {vendorHours}</Text>
              </View>
              {onOpenVendorStore && displayProduct.vendor?.id ? (
                <Text style={styles.viewStoreLink}>View Store →</Text>
              ) : null}
            </View>
          </TouchableOpacity>

          {/* AI Stall & Vendor Comparison Dropdown */}
          {comparisonVendors.length > 0 && (
            <View style={styles.comparisonBox}>
              <TouchableOpacity
                style={styles.comparisonHeader}
                onPress={() => setShowVendorDropdown(!showVendorDropdown)}
                activeOpacity={0.8}
              >
                <View style={styles.comparisonHeaderLeft}>
                  <View style={styles.sparkleIconWrap}>
                    <Ionicons name="sparkles" size={14} color="#B45309" />
                  </View>
                  <View>
                    <Text style={styles.comparisonTitle}>
                      {comparisonVendors.length} {comparisonVendors.length === 1 ? 'Stall' : 'Stalls'} Selling This Item
                    </Text>
                    <Text style={styles.comparisonSub}>
                      Sorted by AI Vendor Rating • Tap to compare &amp; choose
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={showVendorDropdown ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#4B5563"
                />
              </TouchableOpacity>

              {showVendorDropdown && (
                <View style={styles.comparisonList}>
                  {comparisonVendors.map((item) => {
                    const isSelected = item.product_id === displayProduct?.id;
                    return (
                      <TouchableOpacity
                        key={item.product_id}
                        style={[
                          styles.comparisonRow,
                          isSelected && styles.comparisonRowSelected,
                        ]}
                        onPress={() => {
                          setActiveProduct({
                            ...displayProduct,
                            id: item.product_id,
                            vendor_id: item.vendor_id,
                            name: item.name,
                            price: item.price,
                            unit: item.unit,
                            image: item.image ?? displayProduct.image,
                            vendor: {
                              id: item.vendor_id,
                              stall_name: item.stall_name,
                              stall_location: item.stall_location,
                              operating_hours: displayProduct?.vendor?.operating_hours,
                              is_open: displayProduct?.vendor?.is_open,
                            },
                          });
                          setShowVendorDropdown(false);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[styles.vendorRowStall, isSelected && { color: '#1B6B45', fontWeight: '800' }]}>
                              {item.stall_name}
                            </Text>
                            {item.is_ai_recommended && (
                              <View style={styles.aiBadge}>
                                <Ionicons name="sparkles" size={10} color="#B45309" />
                                <Text style={styles.aiBadgeText}>AI Recommended</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.vendorRowLoc}>{item.stall_location}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Ionicons name="star" size={12} color="#F59E0B" />
                              <Text style={styles.vendorRowRating}>{item.rating.toFixed(1)}</Text>
                              <Text style={styles.vendorRowReviewCount}>({item.reviews_count} reviews)</Text>
                            </View>
                            <Text style={styles.vendorRowStock}>• Stock: {item.stock_quantity} {item.unit}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                          <Text style={styles.vendorRowPrice}>₱{Number(item.price).toFixed(2)}</Text>
                          <Text style={styles.vendorRowUnit}>per {item.unit}</Text>
                          {isSelected && (
                            <View style={styles.selectedCheck}>
                              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {!isStoreOpen && (
            <View style={styles.closedNoticeBox}>
              <Ionicons name="information-circle-outline" size={15} color="#B45309" />
              <Text style={styles.closedNoticeText}>
                Store is currently closed ({vendorHours}). Orders placed will be received when the store opens.
              </Text>
            </View>
          )}

          {/* Price + In-cart badge */}
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Price per {displayProduct.unit}</Text>
              <Text style={styles.price}>₱{Number(displayProduct.price).toFixed(2)}</Text>
            </View>
            {inCart && cartItem ? (
              <View style={styles.inCartBadge}>
                <Ionicons name="cart" size={13} color="#1B6B45" />
                <Text style={styles.inCartText}>{formatQty(cartItem.quantity)} {cartItem.unit} in cart</Text>
              </View>
            ) : null}
          </View>

          {/* Description */}
          {displayProduct.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descTitle}>About this product</Text>
              <Text style={styles.descText}>{displayProduct.description}</Text>
            </View>
          ) : null}

          {/* Info Grid */}
          <View style={styles.infoGrid}>
            <InfoTile icon="cube-outline" label="Unit" value={displayProduct.unit} />
            <InfoTile icon="pricetag-outline" label="Category" value={categoryLabel} />
            <InfoTile
              icon="storefront-outline"
              label="Stall"
              value={displayProduct.vendor?.stall_name ?? '—'}
            />
            <InfoTile
              icon="location-outline"
              label="Location"
              value={displayProduct.vendor?.stall_location ?? "Taguig People's Market"}
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

          {/* Report Stall Action Row */}
          <TouchableOpacity
            style={styles.reportSectionRow}
            onPress={() => setComplaintOpen(true)}
            activeOpacity={0.7}
            accessibilityLabel="Report Stall or Product Concern"
          >
            <View style={styles.reportIconBox}>
              <Ionicons name="flag" size={15} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportSectionTitle}>Report Stall or Product Concern</Text>
              <Text style={styles.reportSectionSub}>
                Submit an issue to Taguig People&apos;s Market Administration
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

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
              <Text style={styles.qtyValue}>{formatQty(quantity)} {isWeightProduct ? 'kg' : displayProduct.unit}</Text>
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
            <Text style={styles.subtotalLabel}>Subtotal ({formatQty(quantity)} × ₱{Number(displayProduct.price).toFixed(2)})</Text>
            <Text style={styles.subtotalValue}>₱{subtotal.toFixed(2)}</Text>
          </View>

          {/* Action Buttons: Add to Cart and Buy Now side-by-side */}
          <View style={styles.actionButtonsRow}>
            {/* Add to Cart Button */}
            <Animated.View style={[{ flex: 1 }, { transform: [{ scale: btnScaleAnim }] }]}>
              <TouchableOpacity
                style={[
                  styles.addToCartBtn,
                  inCart && styles.addToCartBtnActive,
                  !displayProduct.is_available && styles.addToCartBtnDisabled,
                ]}
                onPress={handleAddToCart}
                disabled={!displayProduct.is_available}
                activeOpacity={0.85}
                accessibilityLabel={inCart ? 'Add more to cart' : 'Add to cart'}
              >
                <Ionicons
                  name={inCart ? 'cart' : 'cart-outline'}
                  size={19}
                  color={inCart ? '#FFFFFF' : '#1B6B45'}
                />
                <Text
                  style={[
                    styles.addToCartBtnText,
                    !inCart && displayProduct.is_available && styles.addToCartBtnTextOutline,
                  ]}
                  numberOfLines={1}
                >
                  {!displayProduct.is_available
                    ? 'Unavailable'
                    : inCart
                    ? 'Add More'
                    : 'Add to Cart'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Buy Now Button */}
            <TouchableOpacity
              style={[
                styles.buyNowBtn,
                !displayProduct.is_available && styles.buyNowBtnDisabled,
              ]}
              onPress={handleBuyNow}
              disabled={!displayProduct.is_available}
              activeOpacity={0.85}
              accessibilityLabel="Buy now and checkout directly"
            >
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text style={styles.buyNowBtnText} numberOfLines={1}>Buy Now</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom spacer */}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Snackbar Toast */}
        <AddedToCartSnackbar visible={snackVisible} />

        {/* Stall Complaint Modal */}
        {displayProduct && (
          <StallComplaintModal
            visible={complaintOpen}
            onClose={() => setComplaintOpen(false)}
            targetStall={{
              vendorId: displayProduct.vendor?.id ?? displayProduct.vendor_id ?? 0,
              stallName: displayProduct.vendor?.stall_name ?? 'Taguig Market Stall',
              stallNumber: displayProduct.vendor?.stall_location ?? 'Taguig People\'s Market',
              sectionName: displayProduct.vendor?.stall_location ?? 'Taguig People\'s Market',
            }}
          />
        )}
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
  topRightActions: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtnOverlay: {
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

  vendorStoreCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vendorStoreTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vendorStoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  vendorStoreIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorStoreName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  vendorStoreLoc: {
    fontSize: 11,
    color: '#6B7280',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  storeBadgeOpen: {
    backgroundColor: '#DCFCE7',
  },
  storeBadgeClosed: {
    backgroundColor: '#FEE2E2',
  },
  storeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  storeDotOpen: {
    backgroundColor: '#16A34A',
  },
  storeDotClosed: {
    backgroundColor: '#DC2626',
  },
  storeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  storeTextOpen: {
    color: '#16A34A',
  },
  storeTextClosed: {
    color: '#DC2626',
  },
  vendorHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 4,
  },
  vendorHoursText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
  },
  viewStoreLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B6B45',
  },
  reportBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reportBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  reportSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  reportIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  reportSectionSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 15,
  },
  closedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  closedNoticeText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },

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

  /* ── Action Buttons ── */
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  addToCartBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#1B6B45',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  addToCartBtnActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  addToCartBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  addToCartBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addToCartBtnTextOutline: {
    color: '#1B6B45',
  },

  buyNowBtn: {
    flex: 1,
    backgroundColor: '#EA580C',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
  buyNowBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  buyNowBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  comparisonBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  comparisonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sparkleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  comparisonSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  comparisonList: {
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    backgroundColor: '#FFFFFF',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  comparisonRowSelected: {
    backgroundColor: '#F0FDF4',
  },
  vendorRowStall: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  vendorRowLoc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  vendorRowRating: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  vendorRowReviewCount: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  vendorRowStock: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  vendorRowPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  vendorRowUnit: {
    fontSize: 10,
    color: '#6B7280',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  selectedCheck: {
    marginTop: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1B6B45',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function computeIsOpen(openingTime = '04:00', closingTime = '20:00'): boolean {
  try {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const manilaTime = new Date(utc + 8 * 3600000);
    const currentMins = manilaTime.getHours() * 60 + manilaTime.getMinutes();
    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);
    return currentMins >= openH * 60 + (openM || 0) && currentMins <= closeH * 60 + (closeM || 0);
  } catch {
    return true;
  }
}
