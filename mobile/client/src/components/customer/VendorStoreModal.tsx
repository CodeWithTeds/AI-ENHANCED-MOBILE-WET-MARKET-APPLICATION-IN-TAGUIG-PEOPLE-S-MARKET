/**
 * VendorStoreModal — customer view of a vendor's store page.
 * Displays stall info, operating hours, real-time availability status, and all store products.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getProductImageUrl } from '@/utils/image';
import { getVendorStore, type MarketProduct, type VendorStoreData } from '@/services/marketplace';
import { getVendorReviews, resolveReviewImageUrl, type Review, type ReviewSummary } from '@/services/reviews';
import { useCart } from '@/context/CartContext';
import { MarketLocationModal } from './MarketLocationModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatReviewDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface Props {
  vendorId: number | null;
  visible: boolean;
  onClose: () => void;
  onSelectProduct?: (product: MarketProduct) => void;
}

export function VendorStoreModal({ vendorId, visible, onClose, onSelectProduct }: Props) {
  const [data, setData] = useState<VendorStoreData | null>(null);
  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const { addItem, startBuyNow } = useCart();

  function handleBuyNow(item: MarketProduct) {
    startBuyNow({
      product_id: item.id,
      product_name: item.name,
      price: item.price,
      unit: item.unit,
      category: item.category,
      image: item.image,
    }, 1);
    onClose();
    router.navigate('/(customer)/cart' as any);
  }

  useEffect(() => {
    if (!visible || !vendorId) {
      setData(null);
      setReviewsSummary(null);
      setActiveTab('products');
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Load store data and reviews in parallel
    Promise.allSettled([
      getVendorStore(vendorId).then(setData),
      getVendorReviews(vendorId).then(setReviewsSummary),
    ]).catch((err) => {
      console.error('[VendorStoreModal] failed to load:', err);
      setError('Failed to load store details.');
    }).finally(() => setLoading(false));
  }, [visible, vendorId]);

  if (!visible) return null;

  const vendor = data?.vendor;
  const products = data?.products ?? [];
  const reviews = reviewsSummary?.reviews ?? [];

  // Determine open/closed status (default 4:00 AM - 8:00 PM)
  const operatingHours = vendor?.operating_hours ?? '4:00 AM - 8:00 PM';
  const isOpen = vendor?.is_open ?? computeIsOpen(vendor?.opening_time, vendor?.closing_time);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {vendor?.stall_name ?? 'Store Details'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading store details...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={44} color={Colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={onClose} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'products' ? (products as any[]) : (reviews as any[])}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.storeHeader}>
                {/* Stall Avatar / Icon */}
                <View style={styles.storeHero}>
                  <View style={styles.stallAvatar}>
                    <Ionicons name="storefront" size={32} color={Colors.primary} />
                  </View>
                  <View style={styles.storeHeroInfo}>
                    <Text style={styles.stallName}>{vendor?.stall_name}</Text>
                    
                    {/* Rating row in hero */}
                    <View style={styles.storeRatingRow}>
                      <Ionicons name="star" size={13} color="#F59E0B" />
                      <Text style={styles.storeRatingScore}>
                        {reviewsSummary && reviewsSummary.total > 0
                          ? reviewsSummary.average_rating.toFixed(1)
                          : 'New'}
                      </Text>
                      <Text style={styles.storeRatingCount}>
                        {reviewsSummary && reviewsSummary.total > 0
                          ? `(${reviewsSummary.total} ${reviewsSummary.total === 1 ? 'review' : 'reviews'})`
                          : '• No ratings yet'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.locationRow}
                      onPress={() => setShowLocationModal(true)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="View Taguig People's Market location on Google Maps"
                    >
                      <Ionicons name="location-outline" size={14} color={Colors.primary} />
                      <Text style={[styles.stallLocation, { color: Colors.primary, fontWeight: '600' }]}>
                        {vendor?.stall_location ?? "Taguig People's Market"}
                      </Text>
                      <Ionicons name="open-outline" size={12} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Operating Hours Card & Availability Status */}
                <View style={[styles.hoursCard, isOpen ? styles.hoursCardOpen : styles.hoursCardClosed]}>
                  <View style={styles.hoursHeaderRow}>
                    <View style={styles.hoursLeft}>
                      <Ionicons name="time" size={18} color={isOpen ? Colors.primary : '#DC2626'} />
                      <Text style={styles.hoursLabel}>Store Operating Hours</Text>
                    </View>
                    <View style={[styles.statusBadge, isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
                      <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
                      <Text style={[styles.statusText, isOpen ? styles.textOpen : styles.textClosed]}>
                        {isOpen ? 'Open Now' : 'Closed'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.hoursSchedule}>{operatingHours}</Text>
                  <Text style={styles.hoursSubtext}>
                    {isOpen
                      ? 'Available to receive and process orders.'
                      : 'Outside operating hours. Orders will be processed once the store opens.'}
                  </Text>
                </View>

                {/* Tab Switcher: Products vs Feedback & Reviews */}
                <View style={styles.tabSwitcher}>
                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'products' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('products')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="cube-outline"
                      size={15}
                      color={activeTab === 'products' ? Colors.primary : '#6B7280'}
                    />
                    <Text style={[styles.tabBtnText, activeTab === 'products' && styles.tabBtnTextActive]}>
                      Products ({products.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'reviews' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('reviews')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={14}
                      color={activeTab === 'reviews' ? Colors.primary : '#6B7280'}
                    />
                    <Text style={[styles.tabBtnText, activeTab === 'reviews' && styles.tabBtnTextActive]}>
                      Reviews ({reviewsSummary?.total ?? 0})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab-specific header content */}
                {activeTab === 'products' ? (
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Available Products</Text>
                    <Text style={styles.productCount}>{products.length} items</Text>
                  </View>
                ) : (
                  <>
                    {/* Overall Rating Breakdown Hero */}
                    <View style={styles.reviewsHeroCard}>
                      <View style={styles.reviewsHeroLeft}>
                        <Text style={styles.reviewsBigScore}>
                          {reviewsSummary && reviewsSummary.total > 0
                            ? reviewsSummary.average_rating.toFixed(1)
                            : '—'}
                        </Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= Math.round(reviewsSummary?.average_rating ?? 0) ? 'star' : 'star-outline'}
                              size={14}
                              color={star <= Math.round(reviewsSummary?.average_rating ?? 0) ? '#F59E0B' : '#D1D5DB'}
                            />
                          ))}
                        </View>
                        <Text style={styles.reviewsTotalText}>
                          {reviewsSummary && reviewsSummary.total > 0
                            ? `Based on ${reviewsSummary.total} ${reviewsSummary.total === 1 ? 'review' : 'reviews'}`
                            : 'No reviews yet'}
                        </Text>
                      </View>

                      <View style={styles.reviewsHeroRight}>
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = reviewsSummary?.rating_counts?.[star] ?? 0;
                          const total = reviewsSummary?.total ?? 0;
                          const pct = total > 0 ? (count / total) * 100 : 0;
                          return (
                            <View key={star} style={styles.ratingBarRow}>
                              <Text style={styles.ratingBarStar}>{star}</Text>
                              <Ionicons name="star" size={10} color="#F59E0B" />
                              <View style={styles.ratingBarTrack}>
                                <View style={[styles.ratingBarFill, { width: `${pct}%` }]} />
                              </View>
                              <Text style={styles.ratingBarCount}>{count}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionTitle}>Customer Feedback</Text>
                      <Text style={styles.productCount}>{reviews.length} feedback</Text>
                    </View>
                  </>
                )}
              </View>
            }
            renderItem={({ item }) =>
              activeTab === 'products' ? (
                <StoreProductRow
                  product={item as MarketProduct}
                  isOpen={isOpen}
                  onSelect={() => onSelectProduct?.(item as MarketProduct)}
                  onAddToCart={() =>
                    addItem(
                      {
                        product_id: item.id,
                        product_name: item.name,
                        price: item.price,
                        unit: item.unit,
                        category: item.category,
                        image: item.image,
                      },
                      1
                    )
                  }
                  onBuyNow={() => handleBuyNow(item as MarketProduct)}
                />
              ) : (
                <StoreReviewItem review={item as Review} onPreviewImage={setPreviewImage} />
              )
            }
            ListEmptyComponent={
              activeTab === 'products' ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No products listed</Text>
                  <Text style={styles.emptySubtitle}>This store has no active products at the moment.</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="star-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No feedback yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Completed orders from this store can be reviewed by customers.
                  </Text>
                </View>
              )
            }
          />
        )}

        <MarketLocationModal
          visible={showLocationModal}
          onClose={() => setShowLocationModal(false)}
        />

        {/* Photo Lightbox Modal */}
        <Modal
          visible={!!previewImage}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImage(null)}
        >
          <View style={styles.lightboxBackdrop}>
            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setPreviewImage(null)}>
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
            {previewImage && (
              <Image source={{ uri: previewImage }} style={styles.lightboxImage} resizeMode="contain" />
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

function StoreReviewItem({
  review,
  onPreviewImage,
}: {
  review: Review;
  onPreviewImage: (uri: string) => void;
}) {
  return (
    <View style={styles.reviewItemCard}>
      <View style={styles.reviewItemTop}>
        <View style={styles.reviewerAvatar}>
          <Text style={styles.reviewerInitial}>{(review.user || 'C').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.reviewerNameRow}>
            <Text style={styles.reviewerName}>{review.user || 'Customer'}</Text>
            <Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text>
          </View>
          <View style={styles.reviewStarRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= review.rating ? 'star' : 'star-outline'}
                size={12}
                color={star <= review.rating ? '#F59E0B' : '#D1D5DB'}
              />
            ))}
          </View>
        </View>
      </View>

      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}

      {review.images && review.images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotoScroll}>
          {review.images.map((img) => {
            const uri = resolveReviewImageUrl(img.url, img.path);
            return (
              <TouchableOpacity key={img.id} onPress={() => onPreviewImage(uri)} activeOpacity={0.8}>
                <Image source={{ uri }} style={styles.reviewPhotoThumb} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function StoreProductRow({
  product,
  isOpen,
  onSelect,
  onAddToCart,
  onBuyNow,
}: {
  product: MarketProduct;
  isOpen: boolean;
  onSelect: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getProductImageUrl(product.image);

  return (
    <TouchableOpacity style={styles.productRow} onPress={onSelect} activeOpacity={0.8}>
      {imageUrl && !imgError ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.productImg}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.productImgPlaceholder}>
          <Ionicons name="image-outline" size={22} color={Colors.textMuted} />
        </View>
      )}

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.productCategory}>{product.category}</Text>
        <Text style={styles.productPrice}>
          ₱{Number(product.price).toFixed(2)} <Text style={styles.productUnit}>/ {product.unit}</Text>
        </Text>
      </View>

      <View style={styles.productActions}>
        <TouchableOpacity
          style={[styles.addBtn, !product.is_available && styles.btnDisabled]}
          onPress={onAddToCart}
          disabled={!product.is_available}
          accessibilityLabel="Add to cart"
        >
          <Ionicons name="cart-outline" size={13} color="#1B6B45" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buyBtn, !product.is_available && styles.btnDisabled]}
          onPress={onBuyNow}
          disabled={!product.is_available}
          accessibilityLabel="Buy now directly"
        >
          <Ionicons name="flash" size={12} color="#FFFFFF" />
          <Text style={styles.buyBtnText}>Buy</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Fallback client-side time check for Asia/Manila (UTC+8).
 */
function computeIsOpen(openingTime = '04:00', closingTime = '20:00'): boolean {
  try {
    const now = new Date();
    // Convert to UTC+8
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const manilaTime = new Date(utc + 8 * 3600000);
    const currentMins = manilaTime.getHours() * 60 + manilaTime.getMinutes();

    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);
    const openMins = openH * 60 + (openM || 0);
    const closeMins = closeH * 60 + (closeM || 0);

    return currentMins >= openMins && currentMins <= closeMins;
  } catch {
    return true;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: Colors.destructive,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  listContent: {
    paddingBottom: 40,
  },
  storeHeader: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 8,
  },
  storeHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  stallAvatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeHeroInfo: {
    flex: 1,
  },
  stallName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stallLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Operating Hours Card
  hoursCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  hoursCardOpen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  hoursCardClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  hoursHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  hoursLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hoursLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  statusBadgeOpen: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeClosed: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOpen: {
    backgroundColor: '#16A34A',
  },
  dotClosed: {
    backgroundColor: '#DC2626',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textOpen: {
    color: '#16A34A',
  },
  textClosed: {
    color: '#DC2626',
  },
  hoursSchedule: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  hoursSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  productCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  productImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  productImgPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  productUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B6B45',
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EA580C',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  storeRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  storeRatingScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  storeRatingCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  reviewsHeroCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 14,
    gap: 16,
  },
  reviewsHeroLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 14,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    minWidth: 100,
  },
  reviewsBigScore: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 4,
  },
  reviewsTotalText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  reviewsHeroRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingBarStar: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    width: 8,
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  ratingBarCount: {
    fontSize: 10,
    color: Colors.textSecondary,
    minWidth: 14,
    textAlign: 'right',
  },
  reviewItemCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  reviewItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  reviewStarRow: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewComment: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    marginTop: 4,
  },
  reviewPhotoScroll: {
    marginTop: 10,
  },
  reviewPhotoThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
});
