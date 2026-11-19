/**
 * NotificationSheet — in-app notification list for customers and vendors.
 * Tapping a notification opens detailed view with full message, reasons, and actions.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/services/notifications';

interface NotificationSheetProps {
  visible: boolean;
  token: string | null;
  role: 'customer' | 'vendor';
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

interface CategoryVisual {
  icon: string;
  color: string;
  bg: string;
}

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  order_placed: { icon: 'receipt-outline', color: '#2563EB', bg: '#EAF0FF' },
  payment_submitted: { icon: 'hourglass-outline', color: '#D97706', bg: '#FFF7E0' },
  payment_received: { icon: 'checkmark-circle-outline', color: '#059669', bg: '#E7F7EF' },
  order_status: { icon: 'checkmark-done-circle-outline', color: '#1B6B45', bg: '#E7F7EF' },
  new_review: { icon: 'star', color: '#D97706', bg: '#FFF7E0' },
  product_deleted: { icon: 'trash-outline', color: '#DC2626', bg: '#FEE2E2' },
  rental_bill_generated: { icon: 'receipt-outline', color: '#D97706', bg: '#FFF7E0' },
  rental_payment_updated: { icon: 'checkmark-circle-outline', color: '#059669', bg: '#E7F7EF' },
  contract_expiring: { icon: 'calendar-outline', color: '#D97706', bg: '#FFF7E0' },
  contract_expired: { icon: 'alert-circle-outline', color: '#DC2626', bg: '#FEE2E2' },
  contract_approved: { icon: 'checkmark-circle-outline', color: '#059669', bg: '#E7F7EF' },
  contract_rejected: { icon: 'close-circle-outline', color: '#DC2626', bg: '#FEE2E2' },
};

const DEFAULT_VISUAL: CategoryVisual = {
  icon: 'notifications-outline',
  color: '#6B7280',
  bg: '#F3F4F6',
};

/**
 * Robustly extract order ID from notification payload.
 */
export function getNotificationOrderId(item: AppNotification): number | null {
  const rawId =
    item.order_id ??
    item.data?.order_id ??
    (item.data as any)?.orderId ??
    (item.data as any)?.order?.id;
  const parsed = Number(rawId);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Check if the notification is a product deletion notice.
 */
export function isProductDeletionNotification(item: AppNotification): boolean {
  const cat = String(item.category ?? '').toLowerCase();
  const title = String(item.title ?? '').toLowerCase();
  const rawType = String((item.data as any)?.type ?? '').toLowerCase();
  const hasReason = Boolean(item.reason) || Boolean((item.data as any)?.reason);

  return (
    cat === 'product_deleted' ||
    cat.includes('product_deleted') ||
    cat.includes('deletion') ||
    title.includes('product removed') ||
    title.includes('product deleted') ||
    rawType.includes('productdeleted') ||
    hasReason
  );
}

/**
 * Check if the notification is an order or payment notification.
 */
export function isOrderNotification(item: AppNotification): boolean {
  const cat = String(item.category ?? '').toLowerCase();
  return (
    cat === 'order_placed' ||
    cat === 'order_status' ||
    cat === 'payment_submitted' ||
    cat === 'payment_received' ||
    getNotificationOrderId(item) !== null
  );
}

/**
 * Check if the notification is a review notification.
 */
export function isReviewNotification(item: AppNotification): boolean {
  const cat = String(item.category ?? '').toLowerCase();
  return cat === 'new_review' || Boolean((item.data as any)?.rating);
}

/**
 * Check if the notification is a stall rental payment notification.
 */
export function isRentalNotification(item: AppNotification): boolean {
  const cat = String(item.category ?? '').toLowerCase();
  const title = String(item.title ?? '').toLowerCase();
  const rawType = String((item.data as any)?.type ?? '').toLowerCase();
  return (
    cat === 'rental_bill_generated' ||
    cat === 'rental_payment_updated' ||
    cat === 'rental_due' ||
    cat.includes('rental') ||
    title.includes('rental') ||
    title.includes('stall rent') ||
    rawType.includes('rental') ||
    Boolean(item.rental_id || item.data?.rental_id)
  );
}

/**
 * Check if the notification is a stall lease contract notification (Item 20).
 */
export function isContractNotification(item: AppNotification): boolean {
  const cat = String(item.category ?? '').toLowerCase();
  const title = String(item.title ?? '').toLowerCase();
  const rawType = String((item.data as any)?.type ?? '').toLowerCase();
  return (
    cat.startsWith('contract') ||
    title.includes('contract') ||
    title.includes('lease') ||
    rawType.includes('contract') ||
    Boolean((item.data as any)?.contract_end_date)
  );
}

/**
 * Determine the exact destination route when a user taps a notification.
 */
export function getNotificationTargetRoute(
  item: AppNotification,
  role: 'customer' | 'vendor',
): string {
  const orderId = getNotificationOrderId(item);

  if (role === 'vendor') {
    if (isContractNotification(item)) {
      return '/(vendor)/profile';
    }

    if (isProductDeletionNotification(item)) {
      return '/(vendor)/products';
    }

    if (isReviewNotification(item)) {
      const target = (item.data as any)?.target;
      return target === 'product'
        ? '/(vendor)/reviews?tab=products'
        : '/(vendor)/reviews?tab=stall';
    }

    if (orderId) {
      return `/(vendor)/orders?focus=${orderId}`;
    }

    return '/(vendor)/orders';
  }

  // Role: Customer
  if (orderId) {
    return `/(customer)/track/${orderId}`;
  }

  return '/(customer)/orders';
}

export function NotificationSheet({
  visible,
  token,
  role,
  onClose,
  onUnreadChange,
}: NotificationSheetProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!token) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await getNotifications(token, targetPage);
        setNotifications((prev) =>
          append ? [...prev, ...result.notifications] : result.notifications,
        );
        setUnreadCount(result.unread_count);
        onUnreadChange?.(result.unread_count);
        setPage(result.current_page);
        setLastPage(result.last_page);
        setError(null);
      } catch {
        if (!append) {
          setError('Could not load notifications. Pull down to retry.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [token, onUnreadChange],
  );

  useEffect(() => {
    if (visible && token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load(1, false);
    }
  }, [visible, token, load]);

  function handleRefresh() {
    setRefreshing(true);
    load(1, false);
  }

  function handleEndReached() {
    if (loading || loadingMore || page >= lastPage) return;
    load(page + 1, true);
  }

  async function handleMarkAllRead() {
    if (!token || unreadCount === 0) return;

    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? now })),
    );
    setUnreadCount(0);
    onUnreadChange?.(0);

    try {
      await markAllNotificationsRead(token);
    } catch {
      load(1, false);
    }
  }

  function handleNotificationPress(item: AppNotification) {
    if (!item.is_read && token) {
      const now = new Date().toISOString();
      const nextUnread = Math.max(0, unreadCount - 1);

      setNotifications((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, is_read: true, read_at: now } : entry,
        ),
      );
      setUnreadCount(nextUnread);
      onUnreadChange?.(nextUnread);

      markNotificationRead(item.id, token)
        .then((result) => {
          setUnreadCount(result.unread_count);
          onUnreadChange?.(result.unread_count);
        })
        .catch(() => {});
    }

    // Always show the full notification detail view when tapped!
    setSelectedNotification(item);
  }

  function handleNavigateFromDetail(targetItem: AppNotification) {
    const targetRoute = getNotificationTargetRoute(targetItem, role);
    setSelectedNotification(null);
    onClose();

    setTimeout(() => {
      try {
        router.navigate(targetRoute as any);
      } catch (err) {
        console.warn('[NotificationSheet] Navigation failed:', err);
      }
    }, 120);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (selectedNotification) {
          setSelectedNotification(null);
        } else {
          onClose();
        }
      }}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback
          onPress={() => {
            if (selectedNotification) {
              setSelectedNotification(null);
            } else {
              onClose();
            }
          }}
        >
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />

          {selectedNotification ? (
            /* ─── Detail View (Never blank, fully expanded) ─── */
            <NotificationDetailView
              item={selectedNotification}
              role={role}
              onBack={() => setSelectedNotification(null)}
              onNavigate={() => handleNavigateFromDetail(selectedNotification)}
            />
          ) : (
            /* ─── Notifications List ─── */
            <>
              <View style={styles.headerRow}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.title}>Notifications</Text>
                  <Text style={styles.subtitle}>
                    {unreadCount > 0
                      ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                      : 'You are all caught up'}
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  {unreadCount > 0 && (
                    <TouchableOpacity
                      style={styles.markAllBtn}
                      onPress={handleMarkAllRead}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="checkmark-done" size={14} color="#1B6B45" />
                      <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    accessibilityLabel="Close notifications"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#1B6B45" />
                  <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={[
                    styles.listContent,
                    notifications.length === 0 && styles.listContentEmpty,
                  ]}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={handleRefresh}
                      tintColor="#1B6B45"
                    />
                  }
                  onEndReached={handleEndReached}
                  onEndReachedThreshold={0.3}
                  ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                      <View style={styles.emptyIcon}>
                        <Ionicons
                          name={error ? 'cloud-offline-outline' : 'notifications-off-outline'}
                          size={30}
                          color="#9CA3AF"
                        />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {error ? 'Unable to load notifications' : 'No notifications yet'}
                      </Text>
                      <Text style={styles.emptyText}>
                        {error
                          ? error
                          : role === 'customer'
                            ? 'Payment and order updates will appear here.'
                            : 'New customer orders, payment proofs, and admin product notices will appear here.'}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <NotificationRow item={item} onPress={() => handleNotificationPress(item)} />
                  )}
                  ListFooterComponent={
                    loadingMore ? (
                      <View style={styles.footerLoading}>
                        <ActivityIndicator size="small" color="#1B6B45" />
                      </View>
                    ) : undefined
                  }
                />
              )}
            </>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
}) {
  const isProductDeleted = isProductDeletionNotification(item);
  const visual = isProductDeleted
    ? CATEGORY_VISUALS.product_deleted
    : CATEGORY_VISUALS[item.category] ?? DEFAULT_VISUAL;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        !item.is_read && styles.rowUnread,
        isProductDeleted && styles.rowProductDeleted,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon as never} size={18} color={visual.color} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text
            style={[styles.rowTitle, !item.is_read && styles.rowTitleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {isProductDeleted && (
            <View style={styles.removalBadge}>
              <Text style={styles.removalBadgeText}>Removal Notice</Text>
            </View>
          )}
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.rowMessage} numberOfLines={3}>
          {item.message}
        </Text>
        <View style={styles.rowFooterRow}>
          <Text style={styles.rowTime}>{formatRelativeTime(item.created_at)}</Text>
          <Text style={[styles.viewReasonPrompt, isProductDeleted && styles.viewReasonPromptAlert]}>
            {isProductDeleted ? 'View reason & details →' : 'View details →'}
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={isProductDeleted ? '#DC2626' : '#C4CBC7'}
      />
    </TouchableOpacity>
  );
}

/* ─── Detail View Component (Guaranteed visible with solid layout) ─── */
function NotificationDetailView({
  item,
  role,
  onBack,
  onNavigate,
}: {
  item: AppNotification;
  role: 'customer' | 'vendor';
  onBack: () => void;
  onNavigate: () => void;
}) {
  const isProductDeleted = isProductDeletionNotification(item);
  const isOrder = isOrderNotification(item);
  const isReview = isReviewNotification(item);
  const isRental = isRentalNotification(item);
  const isContract = isContractNotification(item);

  // Extract Contract fields
  const contractEndDate = ((item as any).contract_end_date || (item.data as any)?.contract_end_date as string) || '';
  const contractStatus = (((item as any).contract_status || (item.data as any)?.contract_status || (item.data as any)?.status as string) || '').toLowerCase();
  const contractAdminNotes = (item.data as any)?.admin_notes as string | undefined;

  // Extract Rental fields
  const rentalPeriod = (item.billing_period || (item.data?.billing_period as string)) || '';
  const rentalDueDate = (item.due_date || (item.data?.due_date as string)) || '';
  const rentalStatus = (item.status || (item.data?.status as string) || 'unpaid').toLowerCase();
  const rentalStall = (item.data?.stall_number as string) || '';

  // Extract Product Deletion fields
  const productName =
    item.product_name ||
    (item.data?.product_name as string) ||
    'Product';
  const categoryName =
    (item.data?.product_category as string) ||
    (item.data?.category as string) ||
    'Market Item';
  const reasonText =
    item.reason ||
    (item.data?.reason as string) ||
    item.message;
  const adminName =
    (item.data?.admin_name as string) ||
    'Market Administration';
  const stallName =
    (item.data?.stall_name as string) ||
    'Vendor Stall';

  // Extract Order fields
  const orderId = getNotificationOrderId(item);
  const orderNumber =
    (item.data?.order_number as string) ||
    (orderId ? `#${orderId}` : null);
  const amount = item.amount ?? (item.data?.amount as number);

  // Extract Review fields
  const rating = Number((item.data as any)?.rating ?? 0);
  const reviewerName = String((item.data as any)?.customer_name ?? 'Customer');

  return (
    <View style={styles.detailContainer}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {isProductDeleted
              ? 'Product Removed by Admin'
              : isContract
                ? 'Stall Lease Contract Notice'
                : isRental
                  ? 'Stall Rental Notice'
                  : isOrder
                    ? 'Order Notification'
                    : isReview
                      ? 'Customer Review'
                      : 'Notification Details'}
          </Text>
          <Text style={styles.subtitle}>
            {isProductDeleted
              ? 'Administrative Action Notice'
              : isContract
                ? 'Market Lease Administration'
                : isRental
                  ? rentalPeriod
                    ? `Billing Period: ${rentalPeriod}`
                    : 'Market Administration Billing'
                  : formatRelativeTime(item.created_at)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onBack}
          accessibilityLabel="Back to notifications"
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isProductDeleted ? (
          /* ─── Product Removal Specific View ─── */
          <>
            <View style={styles.detailProductBox}>
              <View style={styles.detailProductHeaderRow}>
                <View style={styles.detailIconBox}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailProductLabel}>AFFECTED PRODUCT</Text>
                  <Text style={styles.detailProductName}>{productName}</Text>
                  <Text style={styles.detailCategoryText}>Category: {categoryName}</Text>
                </View>
              </View>
            </View>

            {/* Prominent Deletion Reason Card */}
            <View style={styles.detailReasonBox}>
              <View style={styles.detailReasonTitleRow}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.detailReasonTitle}>REASON FOR DELETION</Text>
              </View>
              <Text style={styles.detailReasonText}>{reasonText}</Text>
            </View>

            {/* Metadata Card */}
            <View style={styles.detailMetaBox}>
              <View style={styles.detailMetaRow}>
                <Text style={styles.detailMetaLabel}>Admin Officer:</Text>
                <Text style={styles.detailMetaValue}>{adminName}</Text>
              </View>
              <View style={styles.detailMetaRow}>
                <Text style={styles.detailMetaLabel}>Vendor Stall:</Text>
                <Text style={styles.detailMetaValue}>{stallName}</Text>
              </View>
              <View style={styles.detailMetaRow}>
                <Text style={styles.detailMetaLabel}>Date & Time:</Text>
                <Text style={styles.detailMetaValue}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : formatRelativeTime(item.created_at)}
                </Text>
              </View>
            </View>

            {/* Advisory Note */}
            <View style={styles.detailNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color="#4B5563" />
              <Text style={styles.detailNoticeText}>
                Market administrators removed this item in accordance with market policies. If you have questions or wish to list a compliant replacement product, coordinate with the Market Administration Office.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.detailActionsRow}>
              <TouchableOpacity
                style={styles.detailBackBtn}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <Text style={styles.detailBackBtnText}>Back to List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailPrimaryBtn}
                onPress={onNavigate}
                activeOpacity={0.7}
              >
                <Text style={styles.detailPrimaryBtnText}>Go to My Products</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : isRental ? (
          /* ─── Monthly Stall Rental Notification View (Item 18 & 19) ─── */
          <>
            <View style={styles.detailProductBox}>
              <View style={styles.detailProductHeaderRow}>
                <View
                  style={[
                    styles.detailIconBox,
                    { backgroundColor: rentalStatus === 'paid' ? '#DCFCE7' : '#FEF3C7' },
                  ]}
                >
                  <Ionicons
                    name={rentalStatus === 'paid' ? 'checkmark-circle' : 'receipt-outline'}
                    size={20}
                    color={rentalStatus === 'paid' ? '#16A34A' : '#D97706'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailProductLabel}>MONTHLY STALL RENTAL</Text>
                  <Text style={styles.detailProductName}>{stallName || 'Vendor Stall'}</Text>
                  {Boolean(rentalStall) && (
                    <Text style={styles.detailCategoryText}>Stall Number: {rentalStall}</Text>
                  )}
                  {amount !== null && amount !== undefined && (
                    <Text style={[styles.detailCategoryText, { color: '#1B6B45', fontWeight: '800', marginTop: 2 }]}>
                      Amount: ₱{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Rental Status & Due Date Card */}
            <View style={styles.detailMetaBox}>
              <View style={styles.detailMetaRow}>
                <Text style={styles.detailMetaLabel}>Billing Period:</Text>
                <Text style={styles.detailMetaValue}>{rentalPeriod || 'Current Period'}</Text>
              </View>
              {Boolean(rentalDueDate) && (
                <View style={styles.detailMetaRow}>
                  <Text style={styles.detailMetaLabel}>Payment Due Date:</Text>
                  <Text
                    style={[
                      styles.detailMetaValue,
                      { color: rentalStatus === 'overdue' ? '#DC2626' : '#111827', fontWeight: '700' },
                    ]}
                  >
                    {new Date(rentalDueDate).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
              <View style={styles.detailMetaRow}>
                <Text style={styles.detailMetaLabel}>Payment Status:</Text>
                <Text
                  style={[
                    styles.detailMetaValue,
                    {
                      color:
                        rentalStatus === 'paid'
                          ? '#16A34A'
                          : rentalStatus === 'overdue'
                          ? '#DC2626'
                          : '#D97706',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                    },
                  ]}
                >
                  {rentalStatus}
                </Text>
              </View>
            </View>

            {/* Official Message */}
            <View style={[styles.detailReasonBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.detailReasonTitle, { color: '#334155' }]}>OFFICIAL ADVISORY</Text>
              <Text style={[styles.detailReasonText, { color: '#1E293B', fontWeight: '500' }]}>
                {item.message}
              </Text>
            </View>

            {/* Payment Settlement Guidance */}
            <View style={styles.detailNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color="#4B5563" />
              <Text style={styles.detailNoticeText}>
                Stall rentals may be settled directly at the Market Administration Office or via designated payment channels. Please ensure payment is completed on or before the due date.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.detailActionsRow}>
              <TouchableOpacity
                style={[styles.detailPrimaryBtn, { flex: 1 }]}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <Text style={styles.detailPrimaryBtnText}>Back to Notifications</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : isContract ? (
          /* ─── Stall Lease Contract Notification View (Item 20) ─── */
          <>
            <View style={styles.detailProductBox}>
              <View style={styles.detailProductHeaderRow}>
                <View
                  style={[
                    styles.detailIconBox,
                    {
                      backgroundColor:
                        contractStatus === 'active' || contractStatus === 'renewed'
                          ? '#DCFCE7'
                          : contractStatus.includes('requested')
                          ? '#F3E8FF'
                          : '#FEF3C7',
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={
                      contractStatus === 'active' || contractStatus === 'renewed'
                        ? '#16A34A'
                        : contractStatus.includes('requested')
                        ? '#7E22CE'
                        : '#D97706'
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailProductLabel}>STALL LEASE CONTRACT</Text>
                  <Text style={styles.detailProductName}>{item.title}</Text>
                  <Text style={styles.detailCategoryText}>
                    Status: {contractStatus.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Contract Metadata */}
            <View style={styles.detailMetaBox}>
              <View style={styles.detailMetaRow}>
                <Text style={styles.detailMetaLabel}>Stall Name:</Text>
                <Text style={styles.detailMetaValue}>{stallName}</Text>
              </View>
              {Boolean(contractEndDate) && (
                <View style={styles.detailMetaRow}>
                  <Text style={styles.detailMetaLabel}>Contract Expiration:</Text>
                  <Text style={[styles.detailMetaValue, { fontWeight: '700', color: '#111827' }]}>
                    {new Date(contractEndDate).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
              {Boolean(contractAdminNotes) && (
                <View style={styles.detailMetaRow}>
                  <Text style={styles.detailMetaLabel}>Admin Remarks:</Text>
                  <Text style={[styles.detailMetaValue, { color: '#0F1E17', fontWeight: '600' }]}>
                    {contractAdminNotes}
                  </Text>
                </View>
              )}
            </View>

            {/* Official Message */}
            <View style={[styles.detailReasonBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.detailReasonTitle, { color: '#334155' }]}>OFFICIAL ADVISORY</Text>
              <Text style={[styles.detailReasonText, { color: '#1E293B', fontWeight: '500' }]}>
                {item.message}
              </Text>
            </View>

            {/* Guidance Advisory */}
            <View style={styles.detailNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color="#4B5563" />
              <Text style={styles.detailNoticeText}>
                You can choose to renew your lease (for 1 month, 3 months, 6 months, or 1 year) or submit a cancellation request. All requests undergo market administrative review before taking effect.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.detailActionsRow}>
              <TouchableOpacity
                style={styles.detailBackBtn}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <Text style={styles.detailBackBtnText}>Back</Text>
              </TouchableOpacity>
              {role === 'vendor' && (
                <TouchableOpacity
                  style={styles.detailPrimaryBtn}
                  onPress={onNavigate}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailPrimaryBtnText}>Manage Contract</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : isOrder ? (
          /* ─── Order Notification View ─── */
          <>
            <View style={styles.detailProductBox}>
              <View style={styles.detailProductHeaderRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#EAF0FF' }]}>
                  <Ionicons name="receipt-outline" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailProductLabel}>ORDER NOTIFICATION</Text>
                  <Text style={styles.detailProductName}>{orderNumber || 'Order Update'}</Text>
                  {amount !== null && amount !== undefined && (
                    <Text style={[styles.detailCategoryText, { color: '#1B6B45', fontWeight: '700' }]}>
                      Total: ₱{Number(amount).toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={[styles.detailReasonBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.detailReasonTitle, { color: '#334155' }]}>MESSAGE</Text>
              <Text style={[styles.detailReasonText, { color: '#1E293B', fontWeight: '500' }]}>
                {item.message}
              </Text>
            </View>

            <View style={styles.detailActionsRow}>
              <TouchableOpacity
                style={styles.detailBackBtn}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <Text style={styles.detailBackBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailPrimaryBtn}
                onPress={onNavigate}
                activeOpacity={0.7}
              >
                <Text style={styles.detailPrimaryBtnText}>
                  {role === 'customer' ? 'Track Order' : 'View Orders'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : isReview ? (
          /* ─── Review Notification View ─── */
          <>
            <View style={styles.detailProductBox}>
              <View style={styles.detailProductHeaderRow}>
                <View style={[styles.detailIconBox, { backgroundColor: '#FFF7E0' }]}>
                  <Ionicons name="star" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailProductLabel}>CUSTOMER FEEDBACK</Text>
                  <Text style={styles.detailProductName}>{reviewerName}</Text>
                  {rating > 0 && (
                    <Text style={[styles.detailCategoryText, { color: '#D97706', fontWeight: '700' }]}>
                      Rating: {'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))} ({rating}/5)
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={[styles.detailReasonBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.detailReasonTitle, { color: '#334155' }]}>COMMENT</Text>
              <Text style={[styles.detailReasonText, { color: '#1E293B', fontWeight: '500' }]}>
                {item.message}
              </Text>
            </View>

            <View style={styles.detailActionsRow}>
              <TouchableOpacity
                style={styles.detailBackBtn}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <Text style={styles.detailBackBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailPrimaryBtn}
                onPress={onNavigate}
                activeOpacity={0.7}
              >
                <Text style={styles.detailPrimaryBtnText}>View Reviews</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ─── General Notification View ─── */
          <>
            <View style={styles.detailProductBox}>
              <Text style={styles.detailProductLabel}>NOTIFICATION</Text>
              <Text style={styles.detailProductName}>{item.title}</Text>
              <Text style={styles.detailCategoryText}>{formatRelativeTime(item.created_at)}</Text>
            </View>

            <View style={[styles.detailReasonBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.detailReasonTitle, { color: '#334155' }]}>MESSAGE</Text>
              <Text style={[styles.detailReasonText, { color: '#1E293B', fontWeight: '500' }]}>
                {item.message}
              </Text>
            </View>

            <View style={styles.detailActionsRow}>
              <TouchableOpacity
                style={[styles.detailPrimaryBtn, { flex: 1 }]}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <Text style={styles.detailPrimaryBtnText}>Back to Notifications</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function formatRelativeTime(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(14, 31, 23, 0.45)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    maxHeight: '90%',
    paddingTop: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0E1F17',
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E7F7EF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  markAllText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1B6B45',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  rowUnread: {
    backgroundColor: '#F1FAF5',
  },
  rowProductDeleted: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  rowTitleUnread: {
    fontWeight: '800',
    color: '#0E1F17',
  },
  removalBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  removalBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },
  rowMessage: {
    fontSize: 12,
    lineHeight: 17,
    color: '#5F6F66',
  },
  rowFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rowTime: {
    fontSize: 10,
    color: '#98A69D',
    fontWeight: '600',
  },
  viewReasonPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B6B45',
  },
  viewReasonPromptAlert: {
    color: '#DC2626',
  },
  footerLoading: {
    paddingVertical: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#F3F6F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0E1F17',
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  /* ─── Detail View Styles ─── */
  detailContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  detailProductBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailProductHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailProductLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  detailProductName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  detailCategoryText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  detailReasonBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    gap: 8,
  },
  detailReasonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailReasonTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 0.6,
  },
  detailReasonText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: '#7F1D1D',
  },
  detailMetaBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailMetaLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailMetaValue: {
    fontSize: 11,
    color: '#1F2937',
    fontWeight: '700',
  },
  detailNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
  },
  detailNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#4B5563',
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  detailBackBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  detailPrimaryBtn: {
    flex: 1.3,
    backgroundColor: '#1B6B45',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
