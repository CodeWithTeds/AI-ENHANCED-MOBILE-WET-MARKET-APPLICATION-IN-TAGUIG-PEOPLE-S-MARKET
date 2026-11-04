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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { API_BASE_URL } from '@/config/api';
import { getVendorStore, type MarketProduct, type VendorStoreData } from '@/services/marketplace';
import { useCart } from '@/context/CartContext';
import { MarketLocationModal } from './MarketLocationModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  vendorId: number | null;
  visible: boolean;
  onClose: () => void;
  onSelectProduct?: (product: MarketProduct) => void;
}

export function VendorStoreModal({ vendorId, visible, onClose, onSelectProduct }: Props) {
  const [data, setData] = useState<VendorStoreData | null>(null);
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
    router.push('/(customer)/cart' as any);
  }

  useEffect(() => {
    if (!visible || !vendorId) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    getVendorStore(vendorId)
      .then(setData)
      .catch((err) => {
        console.error('[VendorStoreModal] failed to load:', err);
        setError('Failed to load store details.');
      })
      .finally(() => setLoading(false));
  }, [visible, vendorId]);

  if (!visible) return null;

  const vendor = data?.vendor;
  const products = data?.products ?? [];

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
            data={products}
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

                {/* Section title */}
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Available Products</Text>
                  <Text style={styles.productCount}>{products.length} items</Text>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <StoreProductRow
                product={item}
                isOpen={isOpen}
                onSelect={() => onSelectProduct?.(item)}
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
                onBuyNow={() => handleBuyNow(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No products listed</Text>
                <Text style={styles.emptySubtitle}>This store has no active products at the moment.</Text>
              </View>
            }
          />
        )}

        <MarketLocationModal
          visible={showLocationModal}
          onClose={() => setShowLocationModal(false)}
        />
      </SafeAreaView>
    </Modal>
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
  const imageUrl = product.image
    ? product.image.startsWith('http')
      ? product.image
      : `${API_BASE_URL.replace('/api/v1', '')}/storage/${product.image.replace(/^\/?(storage\/)?/, '')}`
    : null;

  return (
    <TouchableOpacity style={styles.productRow} onPress={onSelect} activeOpacity={0.8}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.productImg} resizeMode="cover" />
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
});
