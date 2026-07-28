/**
 * Customer Profile — account info and logout.
 */

import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerAuth } from '@/context/CustomerAuthContext';

export default function CustomerProfileScreen() {
  const { user, logout } = useCustomerAuth();

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name ?? 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name ?? 'Customer'}</Text>
          <Text style={styles.email}>{user?.email ?? 'No email'}</Text>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          <MenuItem icon="person-outline" label="Edit Profile" />
          <MenuItem icon="location-outline" label="Delivery Address" />
          <MenuItem icon="card-outline" label="Payment Methods" />
          <MenuItem icon="notifications-outline" label="Notifications" />
          <MenuItem icon="help-circle-outline" label="Help & Support" />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon as any} size={18} color="#6B7280" />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, paddingHorizontal: 20 },

  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#1B6B45', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  name: { fontSize: 19, fontWeight: '800', color: '#111827' },
  email: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  menu: { marginTop: 10, gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 15 },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
