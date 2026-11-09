/**
 * Vendor Layout — bottom tab navigation matching the reference UI.
 */

import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VendorLayout() {
  const insets = useSafeAreaInsets();
  const isIos = Platform.OS === 'ios';

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
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Feather name="home" size={20} color={focused ? '#166534' : color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Feather name="shopping-bag" size={20} color={focused ? '#166534' : color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Feather name="package" size={20} color={focused ? '#166534' : color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={21}
                color={focused ? '#166534' : color as string}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Feather name="user" size={20} color={focused ? '#166534' : color as string} />
            </View>
          ),
        }}
      />
      {/* Opened from the dashboard/profile. Do not use `href: null` here:
          Expo Router SDK 58 treats hidden tabs as unreachable and redirects
          them back to the initial tab. Hiding the button keeps them routable. */}
      <Tabs.Screen
        name="sales"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 42,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: '#DCFCE7',
  },
});
