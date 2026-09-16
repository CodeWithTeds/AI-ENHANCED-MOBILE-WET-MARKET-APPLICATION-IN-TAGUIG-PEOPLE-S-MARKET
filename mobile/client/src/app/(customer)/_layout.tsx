/**
 * Customer Layout — bottom tab navigation for customer app.
 */

import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import { CartProvider, useCart } from '@/context/CartContext';
import { FavoritesProvider } from '@/context/FavoritesContext';

function CartTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { totalItems } = useCart();
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={focused ? 'cart' : 'cart-outline'} size={22} color={color} />
      {totalItems > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{totalItems > 99 ? '99+' : totalItems}</Text>
        </View>
      )}
    </View>
  );
}

export default function CustomerLayout() {
  return (
    <CustomerAuthProvider>
      <FavoritesProvider>
        <CartProvider>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#1B6B45',
              tabBarInactiveTintColor: '#9CA3AF',
              tabBarStyle: {
                backgroundColor: '#FFFFFF',
                borderTopColor: '#F3F4F6',
                borderTopWidth: 1,
                height: 64,
                paddingBottom: 10,
                paddingTop: 6,
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
              },
            }}
          >
            <Tabs.Screen
              name="home"
              options={{
                title: 'Home',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="explore"
              options={{
                title: 'Favorites',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="cart"
              options={{
                title: 'Cart',
                tabBarIcon: ({ color, focused }) => (
                  <CartTabIcon color={color} focused={focused} />
                ),
              }}
            />
            <Tabs.Screen
              name="orders"
              options={{
                title: 'Orders',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Profile',
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
                ),
              }}
            />
            {/* Order tracking screen — opened from the Orders tab, not a tab itself */}
            <Tabs.Screen name="track/[id]" options={{ href: null }} />
            {/* Reports screen — navigated from Profile/Orders, not a tab */}
            <Tabs.Screen name="reports" options={{ href: null }} />
          </Tabs>
        </CartProvider>
      </FavoritesProvider>
    </CustomerAuthProvider>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#F97316',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
});
