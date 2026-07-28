/**
 * Orders — customer order history.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function OrdersScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>Your order history will appear here</Text>
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
