/**
 * Vendor Profile — displays business info and manages account settings.
 * Fetches real data from API, follows separation of concerns.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import * as ImagePicker from 'expo-image-picker';
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
import {
  getPaymentSettings,
  updatePaymentSettings,
  type VendorPaymentSettings,
} from '@/services/vendor-payment';
import { PRODUCT_CATEGORIES } from '@/types/vendor';
import {
  getVendorContractDetails,
  submitVendorContractRequest,
  type VendorContractDetails,
} from '@/services/vendor-contract';

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const [profile, setProfile] = useState<VendorBusinessProfile | null>(null);
  const [contract, setContract] = useState<VendorContractDetails | null>(null);
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'main' | 'editBusiness' | 'changePassword' | 'notifications' | 'paymentSettings' | 'categories'>('main');

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const [data, contractData] = await Promise.all([
        getBusinessProfile(token),
        getVendorContractDetails(token).catch(() => null),
      ]);
      setProfile(data);
      if (contractData) setContract(contractData);
    } catch (err) {
      console.error('[Profile] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    if (token) {
      Promise.all([
        getBusinessProfile(token),
        getVendorContractDetails(token).catch(() => null),
      ])
        .then(([data, contractData]) => {
          if (active) {
            setProfile(data);
            if (contractData) setContract(contractData);
          }
        })
        .catch((err) => {
          console.error('[Profile] fetch failed:', err);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [token]);

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

  if (activeSection === 'paymentSettings') {
    return <PaymentSettingsSection token={token!} onBack={() => setActiveSection('main')} />;
  }

  if (activeSection === 'categories') {
    return <CategoriesSection profile={profile} token={token!} onBack={() => { setActiveSection('main'); fetchProfile(); }} />;
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
          <MenuItem icon="trending-up-outline" label="Sales History & Revenue" subtitle="Analytics, revenue reports & transactions" onPress={() => router.navigate('/(vendor)/sales' as any)} />
          <MenuItem icon="star-outline" label="Customer Reviews & Feedback" subtitle="Ratings and comments from customers" onPress={() => router.navigate('/(vendor)/reviews' as any)} />
          <MenuItem icon="storefront-outline" label="Business Info" subtitle={profile?.vendor?.stall_name} onPress={() => setActiveSection('editBusiness')} />
          <MenuItem icon="time-outline" label="Operating Hours" subtitle={profile?.vendor?.operating_hours ?? '4:00 AM - 8:00 PM'} onPress={() => setActiveSection('editBusiness')} />
          <MenuItem
            icon="pricetags-outline"
            label="Product Categories"
            subtitle={profile?.vendor?.product_categories?.join(', ') || 'None set'}
            onPress={() => setActiveSection('categories')}
          />
          <MenuItem
            icon="location-outline"
            label="Stall Location"
            subtitle={profile?.vendor?.stall_location ?? 'Not set'}
            onPress={() => {
              Alert.alert(
                'Stall Location',
                `Assigned Stall: ${profile?.vendor?.stall_location ?? 'Not set'}\n\nStall allocations are managed by the Taguig Market Administration.`
              );
            }}
          />
        </View>

        {/* Payments Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Payments</Text>
          <MenuItem
            icon="wallet-outline"
            label="GCash & Maya Settings"
            subtitle="Manage account numbers & QR codes"
            onPress={() => setActiveSection('paymentSettings')}
          />
          <View style={styles.paymentHintBox}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.paymentHintText}>
              Set up your GCash/Maya so customers can pay you directly. QR code is optional but recommended.
            </Text>
          </View>
        </View>

        {/* Stall Lease & Contract Section (Item 20) */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Stall Lease & Contract</Text>
          <ContractSummaryCard
            contract={contract}
            onManage={() => setContractModalVisible(true)}
          />
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

      {/* Contract Renewal & Cancellation Modal (Item 20) */}
      <ContractModal
        visible={contractModalVisible}
        contract={contract}
        token={token!}
        onClose={() => setContractModalVisible(false)}
        onSuccess={() => {
          fetchProfile();
          setContractModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

/* ─── Edit Business Sub-screen ─── */

function EditBusinessSection({ profile, token, onBack }: {
  profile: VendorBusinessProfile | null; token: string; onBack: () => void;
}) {
  const [name, setName] = useState(profile?.user.name ?? '');
  const [stallName, setStallName] = useState(profile?.vendor?.stall_name ?? '');
  const [openingTime, setOpeningTime] = useState(profile?.vendor?.opening_time ?? '04:00');
  const [closingTime, setClosingTime] = useState(profile?.vendor?.closing_time ?? '20:00');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateBusinessInfo(token, {
        name,
        stall_name: stallName,
        opening_time: openingTime.trim(),
        closing_time: closingTime.trim(),
      });
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

        <Text style={styles.inputLabel}>Store Operating Hours</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: Colors.textSecondary, marginBottom: 4 }}>Opening (e.g. 04:00)</Text>
            <TextInput
              style={styles.input}
              value={openingTime}
              onChangeText={setOpeningTime}
              placeholder="04:00"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: Colors.textSecondary, marginBottom: 4 }}>Closing (e.g. 20:00)</Text>
            <TextInput
              style={styles.input}
              value={closingTime}
              onChangeText={setClosingTime}
              placeholder="20:00"
            />
          </View>
        </View>
        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 16 }}>
          Default store operating hours are 4:00 AM to 8:00 PM (04:00 - 20:00). Customers will see your store availability status update automatically based on this schedule.
        </Text>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Product Categories Sub-screen ─── */

const CATEGORY_ICONS: Record<string, string> = {
  Meat: 'restaurant-outline',
  Fish: 'fish-outline',
  Vegetables: 'nutrition-outline',
  Fruits: 'nutrition-outline',
  Spices: 'flame-outline',
  Poultry: 'egg-outline',
  Seafood: 'water-outline',
  Dairy: 'cafe-outline',
  'Grains & Rice': 'leaf-outline',
  Condiments: 'color-fill-outline',
};

function CategoriesSection({
  profile,
  token,
  onBack,
}: {
  profile: VendorBusinessProfile | null;
  token: string;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    profile?.vendor?.product_categories ?? []
  );
  const [saving, setSaving] = useState(false);

  // Combine standard PRODUCT_CATEGORIES with any existing vendor categories
  const allCategories = Array.from(
    new Set([...PRODUCT_CATEGORIES, ...(profile?.vendor?.product_categories ?? [])])
  );

  const toggleCategory = (cat: string) => {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAll = () => {
    setSelected([...allCategories]);
  };

  const handleClearAll = () => {
    setSelected([]);
  };

  async function handleSave() {
    if (selected.length === 0) {
      Alert.alert('Required', 'Please select at least one product category so customers can discover your stall.');
      return;
    }

    setSaving(true);
    try {
      await updateBusinessInfo(token, {
        product_categories: selected,
      });
      Alert.alert('Success', 'Product categories updated successfully.');
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update categories.');
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
        <Text style={styles.subTitle}>Product Categories</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.categoryContent} showsVerticalScrollIndicator={false}>
        <View style={styles.categoryIntroBox}>
          <Ionicons name="pricetags-outline" size={20} color={Colors.primary} />
          <Text style={styles.categoryIntroText}>
            Select the categories of products your stall sells. This helps customers discover your stall when browsing categories in the Taguig Suki Market.
          </Text>
        </View>

        <View style={styles.categoryActionRow}>
          <Text style={styles.categoryCountBadgeText}>
            {selected.length} of {allCategories.length} selected
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleSelectAll}>
              <Text style={styles.categoryActionBtnText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={[styles.categoryActionBtnText, { color: Colors.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categoryList}>
          {allCategories.map((category) => {
            const isSelected = selected.includes(category);
            const iconName = CATEGORY_ICONS[category] || 'pricetag-outline';

            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => toggleCategory(category)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={[styles.categoryCardIconBox, isSelected && styles.categoryCardIconBoxSelected]}>
                  <Ionicons
                    name={iconName as any}
                    size={20}
                    color={isSelected ? Colors.primary : Colors.textSecondary}
                  />
                </View>
                <Text style={[styles.categoryCardLabel, isSelected && styles.categoryCardLabelSelected]}>
                  {category}
                </Text>
                <View style={[styles.categoryCheckCircle, isSelected && styles.categoryCheckCircleSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Categories</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 24 }} />
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
    review_alerts: profile?.vendor?.notification_preferences?.review_alerts ?? true,
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
        <NotifToggle label="Review Alerts" subtitle="When customers rate your stall or products" value={prefs.review_alerts} onToggle={(v) => setPrefs({ ...prefs, review_alerts: v })} />
        <NotifToggle label="Low Stock Alerts" subtitle="When products run low" value={prefs.low_stock_alerts} onToggle={(v) => setPrefs({ ...prefs, low_stock_alerts: v })} />
        <NotifToggle label="Promotion Updates" subtitle="Market announcements & promos" value={prefs.promotion_updates} onToggle={(v) => setPrefs({ ...prefs, promotion_updates: v })} />

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled, { marginTop: 24 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>Save Preferences</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Payment Settings Sub-screen ─── */

function PaymentSettingsSection({ token, onBack }: { token: string; onBack: () => void }) {
  const [settings, setSettings] = useState<VendorPaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gcashNumber, setGcashNumber] = useState('');
  const [mayaNumber, setMayaNumber] = useState('');
  const [gcashQrUri, setGcashQrUri] = useState<string | null>(null);
  const [mayaQrUri, setMayaQrUri] = useState<string | null>(null);
  const [removeGcashQr, setRemoveGcashQr] = useState(false);
  const [removeMayaQr, setRemoveMayaQr] = useState(false);

  useEffect(() => {
    let active = true;
    getPaymentSettings(token)
      .then((data) => {
        if (active) {
          setSettings(data);
          setGcashNumber(data.gcash_number ?? '');
          setMayaNumber(data.maya_number ?? '');
        }
      })
      .catch((err) => {
        console.error('[PaymentSettings] fetch failed:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function pickImage(target: 'gcash' | 'maya') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (target === 'gcash') {
        setGcashQrUri(uri);
        setRemoveGcashQr(false);
      } else {
        setMayaQrUri(uri);
        setRemoveMayaQr(false);
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updatePaymentSettings(token, {
        gcash_number: gcashNumber.trim() || null,
        maya_number: mayaNumber.trim() || null,
        gcash_qr_uri: gcashQrUri,
        maya_qr_uri: mayaQrUri,
        remove_gcash_qr: removeGcashQr,
        remove_maya_qr: removeMayaQr,
      });
      setSettings(updated);
      setGcashQrUri(null);
      setMayaQrUri(null);
      setRemoveGcashQr(false);
      setRemoveMayaQr(false);
      Alert.alert('Success', 'Payment settings updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update payment settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.subTitle}>Payment Settings</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.subTitle}>Payment Settings</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.paymentContent} showsVerticalScrollIndicator={false}>
        <View style={styles.paymentIntroBox}>
          <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
          <Text style={styles.paymentIntroText}>
            Add your GCash or Maya account numbers and optional QR codes. Customers choosing GCash/Maya will see these details at checkout.
          </Text>
        </View>

        {/* GCash Card */}
        <View style={[styles.paymentCard, { borderColor: '#2563EB20' }]}>
          <View style={styles.paymentCardHeader}>
            <View style={[styles.paymentCardIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="phone-portrait-outline" size={18} color="#2563EB" />
            </View>
            <Text style={styles.paymentCardTitle}>GCash</Text>
            {settings?.has_gcash && (
              <View style={[styles.configBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.configBadgeText, { color: '#16A34A' }]}>Configured</Text>
              </View>
            )}
          </View>

          <Text style={styles.inputLabel}>GCash Number</Text>
          <TextInput
            style={styles.input}
            value={gcashNumber}
            onChangeText={setGcashNumber}
            placeholder="09XX XXX XXXX"
            keyboardType="phone-pad"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.inputLabel}>GCash QR Code (optional)</Text>
          <View style={styles.qrPreviewRow}>
            <View style={styles.qrPreviewBox}>
              {gcashQrUri ? (
                <Image source={{ uri: gcashQrUri }} style={styles.qrImage} />
              ) : !removeGcashQr && settings?.gcash_qr_url ? (
                <Image source={{ uri: settings.gcash_qr_url }} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="qr-code-outline" size={28} color={Colors.textMuted} />
                  <Text style={styles.qrPlaceholderText}>No QR uploaded</Text>
                </View>
              )}
            </View>
            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.qrBtn} onPress={() => pickImage('gcash')}>
                <Ionicons name="image-outline" size={16} color={Colors.primary} />
                <Text style={styles.qrBtnText}>{gcashQrUri || settings?.gcash_qr_url ? 'Change' : 'Upload'} QR</Text>
              </TouchableOpacity>
              {(gcashQrUri || settings?.gcash_qr_url) && !removeGcashQr ? (
                <TouchableOpacity
                  style={[styles.qrBtn, styles.qrBtnRemove]}
                  onPress={() => {
                    if (gcashQrUri) setGcashQrUri(null);
                    else setRemoveGcashQr(true);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                  <Text style={[styles.qrBtnText, { color: Colors.destructive }]}>Remove</Text>
                </TouchableOpacity>
              ) : removeGcashQr ? (
                <TouchableOpacity style={styles.qrBtn} onPress={() => setRemoveGcashQr(false)}>
                  <Ionicons name="refresh-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.qrBtnText}>Undo Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* Maya Card */}
        <View style={[styles.paymentCard, { borderColor: '#7C3AED20' }]}>
          <View style={styles.paymentCardHeader}>
            <View style={[styles.paymentCardIcon, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="card-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.paymentCardTitle}>Maya</Text>
            {settings?.has_maya && (
              <View style={[styles.configBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.configBadgeText, { color: '#16A34A' }]}>Configured</Text>
              </View>
            )}
          </View>

          <Text style={styles.inputLabel}>Maya Number</Text>
          <TextInput
            style={styles.input}
            value={mayaNumber}
            onChangeText={setMayaNumber}
            placeholder="09XX XXX XXXX"
            keyboardType="phone-pad"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.inputLabel}>Maya QR Code (optional)</Text>
          <View style={styles.qrPreviewRow}>
            <View style={styles.qrPreviewBox}>
              {mayaQrUri ? (
                <Image source={{ uri: mayaQrUri }} style={styles.qrImage} />
              ) : !removeMayaQr && settings?.maya_qr_url ? (
                <Image source={{ uri: settings.maya_qr_url }} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="qr-code-outline" size={28} color={Colors.textMuted} />
                  <Text style={styles.qrPlaceholderText}>No QR uploaded</Text>
                </View>
              )}
            </View>
            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.qrBtn} onPress={() => pickImage('maya')}>
                <Ionicons name="image-outline" size={16} color={Colors.primary} />
                <Text style={styles.qrBtnText}>{mayaQrUri || settings?.maya_qr_url ? 'Change' : 'Upload'} QR</Text>
              </TouchableOpacity>
              {(mayaQrUri || settings?.maya_qr_url) && !removeMayaQr ? (
                <TouchableOpacity
                  style={[styles.qrBtn, styles.qrBtnRemove]}
                  onPress={() => {
                    if (mayaQrUri) setMayaQrUri(null);
                    else setRemoveMayaQr(true);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                  <Text style={[styles.qrBtnText, { color: Colors.destructive }]}>Remove</Text>
                </TouchableOpacity>
              ) : removeMayaQr ? (
                <TouchableOpacity style={styles.qrBtn} onPress={() => setRemoveMayaQr(false)}>
                  <Ionicons name="refresh-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.qrBtnText}>Undo Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {(removeGcashQr || removeMayaQr) && (
          <View style={styles.removeNotice}>
            <Ionicons name="warning-outline" size={14} color="#D97706" />
            <Text style={styles.removeNoticeText}>QR marked for removal. Save to confirm.</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>Save Payment Settings</Text>}
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
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

/* ─── Contract Summary Card (Item 20) ─── */

function ContractSummaryCard({
  contract,
  onManage,
}: {
  contract: VendorContractDetails | null;
  onManage: () => void;
}) {
  if (!contract) {
    return (
      <View style={styles.contractCard}>
        <View style={styles.contractHeader}>
          <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.contractStallName}>Stall Lease Contract</Text>
        </View>
        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>Loading lease details…</Text>
      </View>
    );
  }

  const isRenewalReq = contract.contract_status === 'renewal_requested';
  const isCancellationReq = contract.contract_status === 'cancellation_requested';
  const isExpiring = contract.is_expiring_soon;
  const isExpired = contract.is_expired;

  let badgeColor = '#059669';
  let badgeBg = '#E7F7EF';
  let badgeText = 'Active Lease';

  if (isRenewalReq) {
    badgeColor = '#7E22CE';
    badgeBg = '#F3E8FF';
    badgeText = 'Renewal Requested';
  } else if (isCancellationReq) {
    badgeColor = '#DC2626';
    badgeBg = '#FEE2E2';
    badgeText = 'Cancellation Requested';
  } else if (isExpired) {
    badgeColor = '#DC2626';
    badgeBg = '#FEE2E2';
    badgeText = 'Contract Expired';
  } else if (isExpiring) {
    badgeColor = '#D97706';
    badgeBg = '#FEF3C7';
    badgeText = `Expiring in ${contract.days_until_expiration}d`;
  }

  const startDateFormatted = contract.contract_start_date
    ? new Date(contract.contract_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const endDateFormatted = contract.contract_end_date
    ? new Date(contract.contract_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <View style={styles.contractCard}>
      <View style={styles.contractHeader}>
        <View style={styles.contractHeaderLeft}>
          <View style={[styles.contractIconBox, { backgroundColor: badgeBg }]}>
            <Ionicons name="calendar-outline" size={18} color={badgeColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contractStallName} numberOfLines={1}>
              {contract.stall_name}
            </Text>
            <Text style={styles.contractStallLocation} numberOfLines={1}>
              {(contract.stall_location || 'Taguig People\'s Market').replace(/^Stall\s+Stall\s+/i, 'Stall ')}
            </Text>
          </View>
        </View>
        <View style={[styles.contractBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.contractBadgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
      </View>

      <View style={styles.contractDatesRow}>
        <View style={styles.contractDateCol}>
          <Text style={styles.contractDateLabel}>LEASE START</Text>
          <Text style={styles.contractDateValue}>{startDateFormatted}</Text>
        </View>
        <View style={styles.contractDateCol}>
          <Text style={styles.contractDateLabel}>EXPIRATION DATE</Text>
          <Text style={[styles.contractDateValue, (isExpiring || isExpired) && { color: '#DC2626', fontWeight: '700' }]}>
            {endDateFormatted}
          </Text>
        </View>
      </View>

      {Boolean(contract.latest_request && contract.latest_request.status === 'pending') && (
        <View style={styles.contractPendingBox}>
          <Ionicons name="time-outline" size={14} color="#7E22CE" />
          <Text style={styles.contractPendingText}>
            {contract.latest_request?.type === 'renewal'
              ? `Renewal request (${contract.latest_request.requested_duration_months} Mos) is awaiting Market Admin review.`
              : 'Cancellation request is awaiting Market Admin review.'}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.contractActionBtn} onPress={onManage} activeOpacity={0.7}>
        <Text style={styles.contractActionBtnText}>
          {isRenewalReq || isCancellationReq ? 'Manage Contract Request' : 'Renew or Cancel Contract'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

/* ─── Contract Renewal & Cancellation Modal (Item 20) ─── */

function ContractModal({
  visible,
  contract,
  token,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  contract: VendorContractDetails | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [requestType, setRequestType] = useState<'renewal' | 'cancellation'>('renewal');
  const [durationMonths, setDurationMonths] = useState<1 | 3 | 6 | 12>(12);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pendingRequest = contract?.latest_request?.status === 'pending' ? contract.latest_request : null;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitVendorContractRequest(token, {
        type: requestType,
        duration_months: requestType === 'renewal' ? durationMonths : undefined,
        reason: reason.trim() || undefined,
      });

      const typeLabel = requestType === 'renewal' ? 'Contract Renewal' : 'Contract Cancellation';
      Alert.alert(
        'Request Submitted',
        `${typeLabel} request submitted successfully. It will undergo market administration review and approval before taking effect. You will receive an in-app notification once processed.`,
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (err: any) {
      Alert.alert('Submission Error', err?.message || 'Could not submit contract request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={styles.modalTitle}>Stall Lease Contract</Text>
              <Text style={styles.modalSubtitle}>Renewal &amp; Cancellation Requests</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            <View style={styles.modalLeaseSummary}>
              <View style={styles.modalLeaseRow}>
                <Text style={styles.modalLeaseLabel}>Stall Name:</Text>
                <Text style={styles.modalLeaseValue}>{contract?.stall_name || 'Vendor Stall'}</Text>
              </View>
              <View style={styles.modalLeaseRow}>
                <Text style={styles.modalLeaseLabel}>Lease Start Date:</Text>
                <Text style={styles.modalLeaseValue}>
                  {contract?.contract_start_date ? new Date(contract.contract_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </Text>
              </View>
              <View style={styles.modalLeaseRow}>
                <Text style={styles.modalLeaseLabel}>Expiration Date:</Text>
                <Text style={[styles.modalLeaseValue, { color: contract?.is_expiring_soon ? '#D97706' : Colors.text }]}>
                  {contract?.contract_end_date ? new Date(contract.contract_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </Text>
              </View>
              <View style={styles.modalLeaseRow}>
                <Text style={styles.modalLeaseLabel}>Current Status:</Text>
                <Text style={[styles.modalLeaseValue, { textTransform: 'capitalize' }]}>
                  {contract?.contract_status?.replace('_', ' ') || 'Active'}
                </Text>
              </View>
            </View>

            {Boolean(pendingRequest) && (
              <View style={styles.modalPendingNotice}>
                <Ionicons name="information-circle" size={16} color="#7E22CE" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalPendingTitle}>Request Pending Review</Text>
                  <Text style={styles.modalPendingText}>
                    You have a pending {pendingRequest?.type === 'renewal' ? `Renewal (${pendingRequest.requested_duration_months} Mos)` : 'Cancellation'} request. Submitting below will update your request.
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.modalSectionLabel}>CHOOSE ACTION</Text>
            <View style={styles.modalTypeRow}>
              <TouchableOpacity
                style={[
                  styles.modalTypeBtn,
                  requestType === 'renewal' && styles.modalTypeBtnActiveRenewal,
                ]}
                onPress={() => setRequestType('renewal')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="refresh-circle-outline"
                  size={20}
                  color={requestType === 'renewal' ? '#059669' : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modalTypeBtnText,
                    requestType === 'renewal' && styles.modalTypeBtnTextActiveRenewal,
                  ]}
                >
                  Contract Renewal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalTypeBtn,
                  requestType === 'cancellation' && styles.modalTypeBtnActiveCancel,
                ]}
                onPress={() => setRequestType('cancellation')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color={requestType === 'cancellation' ? '#DC2626' : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modalTypeBtnText,
                    requestType === 'cancellation' && styles.modalTypeBtnTextActiveCancel,
                  ]}
                >
                  Contract Cancellation
                </Text>
              </TouchableOpacity>
            </View>

            {requestType === 'renewal' ? (
              <View style={styles.modalDurationSection}>
                <Text style={styles.modalSectionLabel}>SELECT RENEWAL DURATION</Text>
                <View style={styles.modalDurationGrid}>
                  {([1, 3, 6, 12] as const).map((m) => {
                    const isSelected = durationMonths === m;
                    const label = m === 12 ? '1 Year (12 Mos)' : `${m} Month${m > 1 ? 's' : ''}`;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.modalDurationCard,
                          isSelected && styles.modalDurationCardSelected,
                        ]}
                        onPress={() => setDurationMonths(m)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.modalDurationText,
                            isSelected && styles.modalDurationTextSelected,
                          ]}
                        >
                          {label}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color="#059669" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.modalSectionLabel, { marginTop: 12 }]}>OPTIONAL REMARKS / NOTES</Text>
                <TextInput
                  style={styles.modalTextArea}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Add remarks or notes for market admin..."
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            ) : (
              <View style={styles.modalCancellationSection}>
                <View style={styles.cancellationWarningBox}>
                  <Ionicons name="warning-outline" size={16} color="#DC2626" />
                  <Text style={styles.cancellationWarningText}>
                    Submitting a cancellation request signifies your intent to terminate your stall lease. Market administrators will review your request before final clearance.
                  </Text>
                </View>

                <Text style={[styles.modalSectionLabel, { marginTop: 12 }]}>REASON FOR CANCELLATION</Text>
                <TextInput
                  style={styles.modalTextArea}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="State your reason for vacating or terminating the lease..."
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            )}

            <View style={styles.policyNoticeBox}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#475569" />
              <Text style={styles.policyNoticeText}>
                Contracts must not be automatically renewed or cancelled upon submission. All requests must first undergo market administration review and approval. You will receive an in-app notification once processed.
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={onClose}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  requestType === 'cancellation' && { backgroundColor: '#DC2626' },
                  submitting && { opacity: 0.6 },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.7}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    {requestType === 'renewal' ? 'Submit Renewal Request' : 'Submit Cancellation'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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

  // Payments
  paymentHintBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'flex-start',
  },
  paymentHintText: { flex: 1, fontSize: 11, color: '#475569', lineHeight: 16 },

  paymentContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  paymentIntroBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  paymentIntroText: { flex: 1, fontSize: 12, color: '#374151', lineHeight: 18 },
  paymentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  paymentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  paymentCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  paymentCardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, flex: 1 },
  configBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  configBadgeText: { fontSize: 10, fontWeight: '800' },
  qrPreviewRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  qrPreviewBox: {
    width: 110, height: 110, borderRadius: 12, overflow: 'hidden',
    backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qrImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  qrPlaceholder: { alignItems: 'center', gap: 6, padding: 10 },
  qrPlaceholderText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  qrActions: { flex: 1, gap: 8, justifyContent: 'center' },
  qrBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  qrBtnRemove: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  qrBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  removeNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FDE68A', marginBottom: 12,
  },
  removeNoticeText: { fontSize: 11, color: '#92400E', fontWeight: '600' },

  // Categories section
  categoryContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  categoryIntroBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  categoryIntroText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  categoryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  categoryCountBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  categoryActionBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  categoryList: { gap: 10, marginBottom: 8 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  categoryCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0A',
  },
  categoryCardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryCardIconBoxSelected: {
    backgroundColor: Colors.primary + '18',
  },
  categoryCardLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryCardLabelSelected: {
    fontWeight: '700',
    color: Colors.primary,
  },
  categoryCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  categoryCheckCircleSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  // Contract styles (Item 20)
  contractCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  contractHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contractHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  contractIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractStallName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  contractStallLocation: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  contractBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  contractBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  contractDatesRow: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-between',
  },
  contractDateCol: {
    alignItems: 'center',
  },
  contractDateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  contractDateValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  contractPendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  contractPendingText: {
    fontSize: 11,
    color: '#7E22CE',
    fontWeight: '600',
    flex: 1,
  },
  contractActionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contractActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Contract Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalLeaseSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 4,
  },
  modalLeaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalLeaseLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  modalLeaseValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  modalPendingNotice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 14,
  },
  modalPendingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E22CE',
  },
  modalPendingText: {
    fontSize: 11,
    color: '#6B21A8',
    marginTop: 2,
    lineHeight: 15,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  modalTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modalTypeBtnActiveRenewal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  modalTypeBtnActiveCancel: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  modalTypeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  modalTypeBtnTextActiveRenewal: {
    color: '#059669',
  },
  modalTypeBtnTextActiveCancel: {
    color: '#DC2626',
  },
  modalDurationSection: {
    marginBottom: 14,
  },
  modalDurationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalDurationCard: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  modalDurationCardSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  modalDurationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  modalDurationTextSelected: {
    fontWeight: '800',
    color: '#059669',
  },
  modalTextArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    fontSize: 13,
    color: Colors.text,
    textAlignVertical: 'top',
    minHeight: 65,
  },
  modalCancellationSection: {
    marginBottom: 14,
  },
  cancellationWarningBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancellationWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 16,
  },
  policyNoticeBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 16,
  },
  policyNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
});
