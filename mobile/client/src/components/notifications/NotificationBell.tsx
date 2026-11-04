/**
 * NotificationBell — header bell with unread badge and notification sheet.
 * Polls the unread count and refreshes whenever the screen regains focus.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getUnreadNotificationCount } from '@/services/notifications';
import { NotificationSheet } from './NotificationSheet';

interface NotificationBellProps {
  token: string | null;
  role: 'customer' | 'vendor';
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  iconSize?: number;
}

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell({
  token,
  role,
  style,
  iconColor = '#FFFFFF',
  iconSize = 20,
}: NotificationBellProps) {
  const [visible, setVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const result = await getUnreadNotificationCount(token);
      setUnreadCount(result.unread_count);
    } catch {
      // Badge updates are best-effort; the sheet still shows an error state.
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount]),
  );

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, refreshUnreadCount]);

  return (
    <>
      <TouchableOpacity
        style={style}
        onPress={() => setVisible(true)}
        accessibilityLabel={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        activeOpacity={0.75}
      >
        <Ionicons name="notifications-outline" size={iconSize} color={iconColor} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <NotificationSheet
        visible={visible}
        token={token}
        role={role}
        onClose={() => {
          setVisible(false);
          refreshUnreadCount();
        }}
        onUnreadChange={setUnreadCount}
      />
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
