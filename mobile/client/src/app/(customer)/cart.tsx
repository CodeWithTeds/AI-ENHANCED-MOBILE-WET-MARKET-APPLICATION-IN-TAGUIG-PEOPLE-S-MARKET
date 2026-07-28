/**
 * Cart — customer shopping cart.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function CartScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Ionicons name="cart-outline" size={48} color="#D1D5DB" />
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.subtitle}>Add items from the marketplace to get started</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#374151' },
  subtitle: { fontSize: 13, color: '#9CA3AF' },
});
