/**
 * Products — vendor product management (add, edit, remove).
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function ProductsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Products</Text>
          <TouchableOpacity style={styles.addButton} accessibilityRole="button">
            <Feather name="plus" size={18} color={Colors.primaryForeground} />
            <Text style={styles.addText}>Add Product</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyState}>
          <Feather name="package" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyDesc}>
            Add your first product to start selling at the market
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addText: { fontSize: 13, fontWeight: '700', color: Colors.primaryForeground },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },
});
