/**
 * Vendor Profile — displays business info and manages account settings.
 * Fetches real data from API, follows separation of concerns.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import {
  changePassword,
  getBusinessProfile,
  updateBusinessInfo,
  updateNotificationPreferences,
  type ChangePasswordData,
  type NotificationPreferences,
  type VendorBusinessProfile,
} from '@/services/vendor-profile';

export default function ProfileScreen() {
  const { user, vendor, token, logout } = useAuth();
  const [profile, setProfile] = useState<VendorBusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'main' | 'editBusiness' | 'changePassword' | 'notifications'>('main');

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getBusinessProfile(token);
      setProfile(data);
    } catch (err) {
      console.error('[Profile] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (activeSection === 'editBusiness') {
    return <EditBusinessSection profile={profile} token={token!} onBack={() => { setActiveSection('main'); fetchProfile(); }} />;
  }

  if (activeSection === 'changePassword') {
    return <ChangePasswordSection token={token!} onBack={() => setActiveSection('main')} />;
  }

  if (activeSection === 'notifications') {
    return <NotificationsSection profile={profile} token={token!} onBack={() => { setActiveSection('main'); fetchProfile(); }} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.user.name ?? user?.name ?? 'V').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.user.name ?? user?.name}</Text>
          <Text style={styles.email}>{profile?.user.email ?? user?.email ?? 'No email'}</Text>
          {profile?.vendor && (
            <View style={styles.stallBadge}>
              <Ionicons name="location-outline" size={12} color={Colors.primary} />
              <Text style={styles.stallText}>{profile.vendor.stall_name}</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        {profile?.stats && (
          <View style={styles.statsRow}>
            <StatItem label="Products" value={String(profile.stats.total_products)} icon="cube-outline" />
            <StatItem label="Orders" value={String(profile.stats.total_orders)} icon="receipt-outline" />
            <StatItem label="Member Since" value={profile.stats.member_since ?? '—'} icon="calendar-outline" />
          </View>
        )}

        {/* Business Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Business & Finance</Text>
          <MenuItem icon="trending-up-outline" label="Sales History & Revenue" subtitle="Analytics, revenue reports & transactions" onPress={() => router.push('/(vendor)/sales' as any)} />
          <MenuItem icon="star-outline" label="Customer Reviews & Feedback" subtitle="Ratings and comments from customers" onPress={() => router.push('/(vendor)/reviews' as any)} />
          <MenuItem icon="storefront-outline" label="Business Info" subtitle={profile?.vendor?.stall_name} onPress={() => setActiveSection('editBusiness')} />
          <MenuItem icon="pricetags-outline" label="Product Categories" subtitle={profile?.vendor?.product_categories?.join(', ') || 'None set'} />
          <MenuItem icon="location-outline" label="Stall Location" subtitle={profile?.vendor?.stall_location ?? 'Not set'} />
        </View>

        {/* Account Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <MenuItem icon="person-outline" label="Edit Profile" onPress={() => setActiveSection('editBusiness')} />
          <MenuItem icon="lock-closed-outline" label="Change Password" onPress={() => setActiveSection('changePassword')} />
          <MenuItem icon="notifications-outline" label="Notifications" onPress={() => setActiveSection('notifications')} />
        </View>

        {/* Logout */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.destructive} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Edit Business Sub-screen ─── */

function EditBusinessSection({ profile, token, onBack }: {
  profile: VendorBusinessProfile | null; token: string; onBack: () => void;
}) {
  const [name, setName] = useState(profile?.user.name ?? '');
  const [stallName, setStallName] = useState(profile?.vendor?.stall_name ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessInfo(token, { name, stall_name: stallName });
      Alert.alert('Success', 'Business info updated.');
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.subTitle}>Edit Business Info</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.formContent}>
        <Text style={styles.inputLabel}>Your Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />

        <Text style={styles.inputLabel}>Stall Name</Text>
        <TextInput style={styles.input} value={stallName} onChangeText={setStallName} placeholder="Stall name" />

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Change Password Sub-screen ─── */

function ChangePasswordSection({ token, onBack }: { token: string; onBack: () => void }) {
  const [form, setForm] = useState<ChangePasswordData>({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (form.new_password !== form.new_password_confirmation) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(token, form);
      Alert.alert('Success', 'Password changed successfully.');
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.subTitle}>Change Password</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.formContent}>
        <Text style={styles.inputLabel}>Current Password</Text>
        <TextInput style={styles.input} value={form.current_password} onChangeText={(v) => setForm({ ...form, current_password: v })} secureTextEntry placeholder="Enter current password" />

        <Text style={styles.inputLabel}>New Password</Text>
        <TextInput style={styles.input} value={form.new_password} onChangeText={(v) => setForm({ ...form, new_password: v })} secureTextEntry placeholder="Enter new password" />

        <Text style={styles.inputLabel}>Confirm New Password</Text>
        <TextInput style={styles.input} value={form.new_password_confirmation} onChangeText={(v) => setForm({ ...form, new_password_confirmation: v })} secureTextEntry placeholder="Confirm new password" />

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>Change Password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Notifications Sub-screen ─── */

function NotificationsSection({ profile, token, onBack }: {
  profile: VendorBusinessProfile | null; token: string; onBack: () => void;
}) {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    order_alerts: profile?.vendor?.notification_preferences?.order_alerts ?? true,
    low_stock_alerts: profile?.vendor?.notification_preferences?.low_stock_alerts ?? true,
    promotion_updates: profile?.vendor?.notification_preferences?.promotion_updates ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateNotificationPreferences(token, prefs);
      Alert.alert('Success', 'Notification preferences saved.');
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.subTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.formContent}>
        <NotifToggle label="Order Alerts" subtitle="Get notified for new orders" value={prefs.order_alerts} onToggle={(v) => setPrefs({ ...prefs, order_alerts: v })} />
        <NotifToggle label="Low Stock Alerts" subtitle="When products run low" value={prefs.low_stock_alerts} onToggle={(v) => setPrefs({ ...prefs, low_stock_alerts: v })} />
        <NotifToggle label="Promotion Updates" subtitle="Market announcements & promos" value={prefs.promotion_updates} onToggle={(v) => setPrefs({ ...prefs, promotion_updates: v })} />

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled, { marginTop: 24 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>Save Preferences</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Reusable Components ─── */

function MenuItem({ icon, label, subtitle, onPress }: {
  icon: string; label: string; subtitle?: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} accessibilityRole="button">
      <View style={styles.menuIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.textSecondary} />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle && <Text style={styles.menuSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon as any} size={18} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NotifToggle({ label, subtitle, value, onToggle }: {
  label: string; subtitle: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.notifRow}>
      <View style={styles.notifText}>
        <Text style={styles.notifLabel}>{label}</Text>
        <Text style={styles.notifSubtitle}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} trackColor={{ true: Colors.primary, false: '#E5E7EB' }} thumbColor="#FFFFFF" />
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },

  // Profile Header
  profileHeader: { alignItems: 'center', paddingVertical: 20 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: Colors.primaryForeground },
  name: { fontSize: 19, fontWeight: '800', color: Colors.text },
  email: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  stallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  stallText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 15, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 10, fontWeight: '500', color: Colors.textMuted },

  // Menu
  menuSection: { marginBottom: 18 },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 13,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  menuSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.destructive + '08',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.destructive + '20',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.destructive },

  // Sub-screen header
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  // Form
  formContent: { paddingHorizontal: 20, paddingTop: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Notification toggles
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifText: { flex: 1 },
  notifLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  notifSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
