/**
 * Orders — displays incoming customer orders for processing.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function OrdersScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Orders</Text>

        <View style={styles.emptyState}>
          <Feather name="clipboard" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyDesc}>
            Customer orders will appear here for processing
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, paddingVertical: 16 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },
});
