/**
 * Customer Layout — bottom tab navigation for customer app.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import { CartProvider, useCart } from '@/context/CartContext';

function CartTabIcon({ color, focused }: { color: string; focused: boolean }) {
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
              title: 'Explore',
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />
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
        </Tabs>
      </CartProvider>
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
