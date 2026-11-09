/**
 * Customer Layout — bottom tab navigation for customer app.
 */

import { Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import { CartProvider, useCart } from '@/context/CartContext';
import { FavoritesProvider } from '@/context/FavoritesContext';

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  outlineName: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  badge?: number;
}

function TabBarIcon({ name, outlineName, focused, color, badge }: TabBarIconProps) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.iconPill, focused && styles.iconPillActive]}>
        <Ionicons
          name={focused ? name : outlineName}
          size={21}
          color={focused ? '#166534' : color}
        />
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

function CustomerTabs() {
  const insets = useSafeAreaInsets();
  const { totalItems } = useCart();
  const isIos = Platform.OS === 'ios';

  // Ensure safe area padding on notched iOS and gesture-bar Android
  const bottomPadding = insets.bottom > 0 ? insets.bottom : (isIos ? 20 : 8);
  const tabHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#166534',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          height: tabHeight,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          // Subtle elevated shadow
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="home"
              outlineName="home-outline"
              focused={focused}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="heart"
              outlineName="heart-outline"
              focused={focused}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="cart"
              outlineName="cart-outline"
              focused={focused}
              color={color as string}
              badge={totalItems}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="receipt"
              outlineName="receipt-outline"
              focused={focused}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="person"
              outlineName="person-outline"
              focused={focused}
              color={color as string}
            />
          ),
        }}
      />
      {/* Order tracking screen — opened from the Orders tab, hidden from tab bar.
          `href: null` would make it unreachable in Expo Router SDK 58. */}
      <Tabs.Screen
        name="track/[id]"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
      {/* Reports screen — navigated from Profile/Orders, hidden from tab bar */}
      <Tabs.Screen
        name="reports"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}

export default function CustomerLayout() {
  return (
    <CustomerAuthProvider>
      <FavoritesProvider>
        <CartProvider>
          <CustomerTabs />
        </CartProvider>
      </FavoritesProvider>
    </CustomerAuthProvider>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 46,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPill: {
    width: 42,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: '#DCFCE7', // Tailwind emerald-100 / soft green accent
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 11,
  },
});
