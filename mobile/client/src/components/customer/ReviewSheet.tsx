/**
 * ReviewSheet — bottom sheet modal allowing customers to rate vendors and products
 * from a completed order with photo attachments.
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { getCustomerToken } from '@/services/customer-auth';
import {
  submitProductReview,
  submitVendorReview,
  type EligibleOrder,
} from '@/services/reviews';
import { StarRating } from '@/components/customer/StarRating';
import { ApiError } from '@/services/api';
import type { Order } from '@/services/orders';

export interface ReviewSheetProps {
  visible: boolean;
  onClose: () => void;
  order: Order;
  eligible?: EligibleOrder | null;
  onSubmitted?: () => void;
}

export function ReviewSheet({
  visible,
  onClose,
  order,
  eligible,
  onSubmitted,
}: ReviewSheetProps) {
  const { token } = useCustomerAuth();
  const getAuthToken = async () => token ?? await getCustomerToken();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<{ uri: string; name?: string; type?: string }[]>([]);
  const [target, setTarget] = useState<{ type: 'vendor' | 'product'; id: number; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const vendors = useMemo(() => {
    if (eligible?.vendors && eligible.vendors.length > 0) return eligible.vendors;
    const seen = new Set<number>();
    const list: { id: number; stall_name: string; stall_location: string; reviewed: boolean }[] = [];
    for (const item of order.items ?? []) {
      const v = item.vendor;
      const vId = v?.id ?? item.vendor_id;
      if (vId && !seen.has(vId)) {
        seen.add(vId);
        list.push({
          id: vId,
          stall_name: v?.stall_name ?? `Vendor #${vId}`,
          stall_location: v?.stall_location ?? '',
          reviewed: false,
        });
      }
    }
    return list;
  }, [eligible?.vendors, order.items]);

  const products = useMemo(() => {
    if (eligible?.products && eligible.products.length > 0) return eligible.products;
    return (order.items ?? []).map((item) => ({
      id: item.product_id,
      name: item.product_name,
      category: item.category,
      unit: item.unit,
      price: Number(item.unit_price),
      reviewed: false,
    }));
  }, [eligible?.products, order.items]);

  function openTarget(type: 'vendor' | 'product', id: number, name: string) {
    setTarget({ type, id, name });
    setRating(0);
    setComment('');
    setImages([]);
    setError(null);
  }

  async function pickImageFromLibrary() {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload up to 5 photos.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow photo access to upload visual evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - images.length,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || 'evidence.jpg',
        type: asset.mimeType || 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, 5));
    }
  }

  async function takePhotoWithCamera() {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload up to 5 photos.');
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow camera access to photograph the item.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImages((prev) => [
        ...prev,
        {
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'evidence_cam.jpg',
          type: asset.mimeType || 'image/jpeg',
        },
      ].slice(0, 5));
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!target || rating === 0) return;
    const authToken = await getAuthToken();
    if (!authToken) return;

    setSubmitting(true);
    setError(null);
    try {
      if (target.type === 'vendor') {
        await submitVendorReview(target.id, { rating, comment: comment || undefined, order_id: order.id, images }, authToken);
      } else {
        await submitProductReview(target.id, { rating, comment: comment || undefined, order_id: order.id, images }, authToken);
      }
      setDone((prev) => new Set(prev).add(`${target.type}:${target.id}`));
      setTarget(null);
      setImages([]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not submit review. Try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const pendingVendors = vendors.filter((v) => !v.reviewed && !done.has(`vendor:${v.id}`));
  const pendingProducts = products.filter((p) => !p.reviewed && !done.has(`product:${p.id}`));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={sheetStyles.sheet}>
        <View style={sheetStyles.handle} />
        <View style={sheetStyles.header}>
          <Text style={sheetStyles.title}>Rate Your Purchase</Text>
          <Text style={sheetStyles.subtitle}>Order {order.order_number}</Text>
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={sheetStyles.content} showsVerticalScrollIndicator={false}>
          {pendingVendors.length === 0 && pendingProducts.length === 0 ? (
            <View style={sheetStyles.allDone}>
              <Ionicons name="checkmark-done-circle" size={44} color="#16A34A" />
              <Text style={sheetStyles.allDoneTitle}>All rated! Salamat!</Text>
              <Text style={sheetStyles.allDoneSub}>
                You've reviewed everything from this order.
              </Text>
              <TouchableOpacity style={sheetStyles.doneBtn} onPress={onSubmitted ?? onClose}>
                <Text style={sheetStyles.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Vendors */}
              {pendingVendors.length > 0 && (
                <>
                  <Text style={sheetStyles.sectionLabel}>Vendors</Text>
                  {pendingVendors.map((vendor) => (
                    <ReviewRow
                      key={`v-${vendor.id}`}
                      icon="storefront-outline"
                      name={vendor.stall_name}
                      meta={vendor.stall_location}
                      onPress={() => openTarget('vendor', vendor.id, vendor.stall_name)}
                    />
                  ))}
                </>
              )}

              {/* Products */}
              {pendingProducts.length > 0 && (
                <>
                  <Text style={[sheetStyles.sectionLabel, { marginTop: 18 }]}>Products</Text>
                  {pendingProducts.map((product) => (
                    <ReviewRow
                      key={`p-${product.id}`}
                      icon="cube-outline"
                      name={product.name}
                      meta={`${product.category} · per ${product.unit} · ₱${Number(product.price).toFixed(2)}`}
                      onPress={() => openTarget('product', product.id, product.name)}
                    />
                  ))}
                </>
              )}

              {/* Rating editor */}
              {target && (
                <View style={sheetStyles.editor}>
                  <Text style={sheetStyles.editorTitle}>Rate {target.name}</Text>
                  <StarRating value={rating} onChange={setRating} size={34} />
                  <TextInput
                    style={sheetStyles.commentInput}
                    placeholder="Share your experience (optional)..."
                    placeholderTextColor="#9CA3AF"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    maxLength={1000}
                  />

                  {/* Photo Evidence Section */}
                  <View style={sheetStyles.photoSection}>
                    <View style={sheetStyles.photoHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="camera-outline" size={16} color="#0E8F5B" />
                        <Text style={sheetStyles.photoTitle}>Attach Photo Evidence</Text>
                      </View>
                      <Text style={sheetStyles.photoCount}>{images.length}/5 photos</Text>
                    </View>
                    <Text style={sheetStyles.photoSubtitle}>
                      Upload photos of items that are damaged, rotten, defective, or in poor condition to help vendors investigate.
                    </Text>

                    {images.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheetStyles.previewScroll}>
                        {images.map((img, idx) => (
                          <View key={idx} style={sheetStyles.previewCard}>
                            <Image source={{ uri: img.uri }} style={sheetStyles.previewImage} />
                            <TouchableOpacity
                              style={sheetStyles.removePhotoBtn}
                              onPress={() => removeImage(idx)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="close" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    )}

                    {images.length < 5 && (
                      <View style={sheetStyles.photoActionRow}>
                        <TouchableOpacity style={sheetStyles.photoBtn} onPress={pickImageFromLibrary}>
                          <Ionicons name="images-outline" size={15} color="#0E8F5B" />
                          <Text style={sheetStyles.photoBtnText}>Gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={sheetStyles.photoBtn} onPress={takePhotoWithCamera}>
                          <Ionicons name="camera-outline" size={15} color="#0E8F5B" />
                          <Text style={sheetStyles.photoBtnText}>Camera</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {error && <Text style={sheetStyles.errorText}>{error}</Text>}
                  <TouchableOpacity
                    style={[sheetStyles.submitBtn, (rating === 0 || submitting) && sheetStyles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={rating === 0 || submitting}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="star" size={16} color="#FFFFFF" />
                        <Text style={sheetStyles.submitBtnText}>Submit Review</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ReviewRow({
  icon,
  name,
  meta,
  onPress,
}: {
  icon: any;
  name: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <View style={sheetStyles.row}>
      <View style={sheetStyles.rowIcon}>
        <Ionicons name={icon} size={18} color="#15803D" />
      </View>
      <View style={sheetStyles.rowInfo}>
        <Text style={sheetStyles.rowName} numberOfLines={1}>{name}</Text>
        {meta ? <Text style={sheetStyles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <TouchableOpacity style={sheetStyles.rowCta} onPress={onPress} activeOpacity={0.8}>
        <Text style={sheetStyles.rowCtaText}>Rate</Text>
        <Ionicons name="chevron-forward" size={13} color="#B45309" />
      </TouchableOpacity>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  closeBtn: { position: 'absolute', top: 4, right: 16 },
  content: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 10 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  rowCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  rowCtaText: { fontSize: 12, fontWeight: '700', color: '#B45309' },

  editor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    alignItems: 'center',
  },
  editorTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  commentInput: {
    width: '100%',
    minHeight: 70,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
    marginTop: 12,
  },
  photoSection: {
    width: '100%',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  photoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  photoCount: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  photoSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
    marginBottom: 10,
  },
  previewScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  previewCard: {
    position: 'relative',
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1B6B45',
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B6B45',
  },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1B6B45',
    borderRadius: 12,
    paddingVertical: 13,
    width: '100%',
    marginTop: 12,
  },
  submitBtnDisabled: { backgroundColor: '#A7D4BE' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  allDone: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  allDoneTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 4 },
  allDoneSub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  doneBtn: {
    backgroundColor: '#1B6B45',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 10,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
