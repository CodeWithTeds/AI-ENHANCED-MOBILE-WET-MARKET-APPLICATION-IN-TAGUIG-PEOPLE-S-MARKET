/**
 * NotificationSheet — in-app notification list for customers and vendors.
 * Tapping a notification opens the related order.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
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
 * Determine the exact destination route when a user taps a notification.
 * Ensures customers and vendors are taken directly to relevant details
 * (order tracking/items, payment verification, reviews) instead of Home.
 */
export function getNotificationTargetRoute(
  item: AppNotification,
  role: 'customer' | 'vendor',
): string {
  const orderId = getNotificationOrderId(item);
  const category = item.category || (item.data as any)?.category;

  if (role === 'vendor') {
    // 1. Review / Feedback notifications -> Vendor Reviews screen
    if (category === 'new_review') {
      const target = (item.data as any)?.target;
      return target === 'product'
        ? '/(vendor)/reviews?tab=products'
        : '/(vendor)/reviews?tab=stall';
    }

    // 2. Order & Payment notifications -> Vendor Orders screen with targeted order focused
    if (orderId) {
      return `/(vendor)/orders?focus=${orderId}`;
    }

    // 3. Fallback for vendor
    return '/(vendor)/orders';
  }

  // Role: Customer
  // 1. Order tracking & details / Payment status screen
  if (orderId) {
    return `/(customer)/track/${orderId}`;
  }

  // 2. Fallback for customer: My Orders tab
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

    // Dismiss sheet first
    onClose();

    // Resolve target route
    const targetRoute = getNotificationTargetRoute(item, role);

    // Yield window focus away from the native Modal before triggering navigation.
    // This prevents React Native Modal dismiss from aborting or reverting navigation back to Home.
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
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />

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
                        : 'New customer orders and payment proofs will appear here.'}
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
  const visual = CATEGORY_VISUALS[item.category] ?? DEFAULT_VISUAL;

  return (
    <TouchableOpacity
      style={[styles.row, !item.is_read && styles.rowUnread]}
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
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.rowMessage} numberOfLines={3}>
          {item.message}
        </Text>
        <Text style={styles.rowTime}>{formatRelativeTime(item.created_at)}</Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#C4CBC7" />
    </TouchableOpacity>
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
    backgroundColor: 'rgba(14, 31, 23, 0.4)',
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
    maxHeight: '82%',
    paddingTop: 8,
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
  rowTime: {
    fontSize: 10,
    color: '#98A69D',
    fontWeight: '600',
    marginTop: 2,
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
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
});
