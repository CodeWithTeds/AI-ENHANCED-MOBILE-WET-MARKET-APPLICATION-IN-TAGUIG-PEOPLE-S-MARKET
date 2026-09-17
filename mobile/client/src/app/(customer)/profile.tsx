/**
 * Customer Profile — manages account preferences, password, and notifications.
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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import {
  changeCustomerPassword,
  getCustomerProfile,
  updateCustomerNotificationPreferences,
  updateCustomerProfile,
  type ChangePasswordData,
  type CustomerNotificationPreferences,
  type CustomerProfile,
} from '@/services/customer-profile';
import {
  deleteCustomerVerification,
  getCustomerVerification,
  ID_TYPES,
  uploadCustomerVerification,
  type CustomerVerification,
  type IdType,
  statusColor,
  statusLabel,
} from '@/services/customer-verification';

export default function CustomerProfileScreen() {
  const { user, token, logout } = useCustomerAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'main' | 'editProfile' | 'changePassword' | 'notifications' | 'idVerification'>('main');
  const [verification, setVerification] = useState<CustomerVerification | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await getCustomerProfile(token);
      setProfile(data);
    } catch (err) {
      console.error('[Profile] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchVerification = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getCustomerVerification(token);
      setVerification(data);
    } catch (err) {
      console.error('[Verification] fetch failed:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
    fetchVerification();
  }, [fetchProfile, fetchVerification]);

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

  if (activeSection === 'editProfile') {
    return <EditProfileSection profile={profile} token={token!} onBack={() => { setActiveSection('main'); fetchProfile(); }} />;
  }

  if (activeSection === 'changePassword') {
    return <ChangePasswordSection token={token!} onBack={() => setActiveSection('main')} />;
  }

  if (activeSection === 'notifications') {
    return <NotificationsSection profile={profile} token={token!} onBack={() => { setActiveSection('main'); fetchProfile(); }} />;
  }

  if (activeSection === 'idVerification') {
    return <IdVerificationSection token={token!} onBack={() => { setActiveSection('main'); fetchVerification(); }} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.user.name ?? user?.name ?? 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.user.name ?? user?.name ?? 'Customer'}</Text>
          <Text style={styles.email}>{profile?.user.email ?? user?.email ?? 'No email'}</Text>
        </View>

        {/* Reports Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Insights</Text>
          <MenuItem
            icon="bar-chart-outline"
            label="Reports"
            onPress={() => router.push('/(customer)/reports' as any)}
          />
          <View style={styles.reportHintBox}>
            <Ionicons name="document-text-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.reportHintText}>View purchases, items, and total spending by date range. Share or generate reports.</Text>
          </View>
        </View>

        {/* Verification Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Verification</Text>
          <MenuItem
            icon="card-outline"
            label="ID Verification"
            onPress={() => setActiveSection('idVerification')}
            badge={verification ? statusLabel(verification.status) : undefined}
            badgeColor={verification ? statusColor(verification.status) : undefined}
          />
          <View style={styles.verificationHintBox}>
            <Ionicons name="shield-checkmark-outline" size={14} color={verification?.status === 'verified' ? '#10B981' : Colors.textSecondary} />
            <Text style={styles.verificationHintText}>
              {verification?.status === 'verified'
                ? 'Your ID is verified. You have full access.'
                : verification?.status === 'pending'
                  ? 'Your ID is under review. Please wait 1-2 days.'
                  : verification?.status === 'rejected'
                    ? 'Verification rejected. Please re-upload a clear ID.'
                    : 'Upload a valid ID to verify your account and build trust with vendors.'}
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <MenuItem icon="person-outline" label="Edit Profile" onPress={() => setActiveSection('editProfile')} />
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

/* ─── Edit Profile Sub-screen ─── */

function EditProfileSection({ profile, token, onBack }: {
  profile: CustomerProfile | null; token: string; onBack: () => void;
}) {
  const [name, setName] = useState(profile?.user.name ?? '');
  const [email, setEmail] = useState(profile?.user.email ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateCustomerProfile(token, { name, email });
      Alert.alert('Success', 'Profile updated.');
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
        <Text style={styles.subTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.formContent}>
        <Text style={styles.inputLabel}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" />

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
      await changeCustomerPassword(token, form);
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
  profile: CustomerProfile | null; token: string; onBack: () => void;
}) {
  const [prefs, setPrefs] = useState<CustomerNotificationPreferences>({
    order_alerts: profile?.notification_preferences?.order_alerts ?? true,
    promotion_updates: profile?.notification_preferences?.promotion_updates ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateCustomerNotificationPreferences(token, prefs);
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
        <NotifToggle label="Order Alerts" subtitle="Get notified on order status updates" value={prefs.order_alerts} onToggle={(v) => setPrefs({ ...prefs, order_alerts: v })} />
        <NotifToggle label="Promotion Updates" subtitle="Market announcements & promos" value={prefs.promotion_updates} onToggle={(v) => setPrefs({ ...prefs, promotion_updates: v })} />

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>Save Preferences</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── ID Verification Sub-screen ─── */

function IdVerificationSection({ token, onBack }: { token: string; onBack: () => void }) {
  const [verification, setVerification] = useState<CustomerVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<IdType>('national_id');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const fetchVerification = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomerVerification(token);
      setVerification(data);
      if (data.id_type) setSelectedType(data.id_type as IdType);
    } catch (e) {
      console.error('[ID Verification] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload ID.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take ID photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  function showPickerOptions() {
    Alert.alert('Select ID Photo', 'Choose source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleUpload() {
    if (!imageUri) {
      Alert.alert('Missing Photo', 'Please select an ID image first.');
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadCustomerVerification(token, {
        id_type: selectedType,
        id_image_uri: imageUri,
      });
      setVerification(updated);
      setImageUri(null);
      Alert.alert('Success', 'ID submitted for verification. Status: Pending Review.');
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload ID.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    Alert.alert('Remove ID?', 'This will delete your current verification and reset status.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await deleteCustomerVerification(token);
            setVerification(updated);
            setImageUri(null);
            Alert.alert('Removed', 'ID verification removed.');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to remove.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.subTitle}>ID Verification</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const status = verification?.status ?? 'unverified';
  const typeLabel = ID_TYPES.find((t) => t.value === verification?.id_type)?.label ?? verification?.id_type ?? '—';
  const selectedLabel = ID_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.subTitle}>ID Verification</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.formContent, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={[styles.verificationCard, status === 'verified' ? styles.verificationCardVerified : status === 'pending' ? styles.verificationCardPending : status === 'rejected' ? styles.verificationCardRejected : null]}>
          <View style={styles.verificationCardRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(status as any) }]} />
            <Text style={styles.verificationStatus}>{statusLabel(status as any)}</Text>
            {verification?.id_type ? <Text style={styles.verificationType}> • {typeLabel}</Text> : null}
          </View>
          <Text style={styles.verificationStatusHint}>
            {status === 'verified' && 'Your identity has been verified. You can now enjoy full app features.'}
            {status === 'pending' && 'Under review by admin. This usually takes 1-2 business days.'}
            {status === 'rejected' && (verification?.rejection_reason || 'Your ID was rejected. Please upload a clearer photo and ensure all details are visible.')}
            {status === 'unverified' && 'Please upload a clear photo of your valid government ID to verify your account.'}
          </Text>
          {verification?.submitted_at ? <Text style={styles.verificationMeta}>Submitted: {new Date(verification.submitted_at).toLocaleString()}</Text> : null}
          {verification?.verified_at ? <Text style={styles.verificationMeta}>Verified: {new Date(verification.verified_at).toLocaleString()}</Text> : null}
        </View>

        {/* Current ID Image */}
        {verification?.id_image_url && !imageUri ? (
          <View style={styles.idImageWrap}>
            <Text style={styles.inputLabel}>Current ID Image</Text>
            <Image source={{ uri: verification.id_image_url }} style={styles.idImage} resizeMode="cover" />
            <View style={styles.idImageActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={showPickerOptions}>
                <Ionicons name="camera-outline" size={16} color={Colors.text} />
                <Text style={styles.secondaryButtonText}>Replace Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerGhostButton} onPress={handleRemove}>
                <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                <Text style={styles.dangerGhostText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Picker / Preview */}
        <Text style={styles.inputLabel}>ID Type</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTypePicker(!showTypePicker)}>
          <Text style={styles.pickerText}>{selectedLabel}</Text>
          <Ionicons name={showTypePicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {showTypePicker ? (
          <View style={styles.pickerDropdown}>
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              {ID_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.pickerOption, selectedType === t.value && styles.pickerOptionSelected]}
                  onPress={() => {
                    setSelectedType(t.value as IdType);
                    setShowTypePicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, selectedType === t.value && styles.pickerOptionTextSelected]}>{t.label}</Text>
                  {selectedType === t.value ? <Ionicons name="checkmark" size={16} color={Colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.inputLabel}>ID Photo</Text>
        {imageUri ? (
          <View style={styles.selectedImageWrap}>
            <Image source={{ uri: imageUri }} style={styles.idImage} resizeMode="cover" />
            <TouchableOpacity style={styles.changePhotoLink} onPress={showPickerOptions}>
              <Text style={styles.changePhotoText}>Change photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadBox} onPress={showPickerOptions} activeOpacity={0.7}>
            <View style={styles.uploadIconWrap}>
              <Ionicons name="cloud-upload-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.uploadTitle}>Tap to upload ID picture</Text>
            <Text style={styles.uploadSubtitle}>Camera or Gallery • JPG/PNG/WEBP • max 5MB</Text>
            <Text style={styles.uploadHint}>Make sure all corners are visible and text is readable</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (!imageUri || uploading) && styles.saveButtonDisabled]}
          onPress={handleUpload}
          disabled={!imageUri || uploading}
        >
          {uploading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveButtonText}>{verification?.id_image_url ? 'Update Verification' : 'Submit for Verification'}</Text>}
        </TouchableOpacity>

        <View style={styles.verificationInfoBox}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.verificationInfoText}>Your ID is stored securely and only visible to admins for verification. We never share it with vendors.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Reusable Components ─── */

function MenuItem({ icon, label, onPress, badge, badgeColor }: {
  icon: string; label: string; onPress?: () => void; badge?: string; badgeColor?: string;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} accessibilityRole="button">
      <View style={styles.menuIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.textSecondary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, badgeColor ? { backgroundColor: badgeColor } : null]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
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
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },

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

  reportHintBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginTop: 4,
    alignItems: 'flex-start',
  },
  reportHintText: { flex: 1, fontSize: 11, color: '#475569', lineHeight: 15 },

  // Badge
  badge: {
    backgroundColor: Colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', textTransform: 'uppercase' },

  // Verification
  verificationHintBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
    alignItems: 'flex-start',
  },
  verificationHintText: { flex: 1, fontSize: 11, color: '#14532D', lineHeight: 15 },
  verificationCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  verificationCardVerified: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  verificationCardPending: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  verificationCardRejected: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  verificationCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  verificationStatus: { fontSize: 14, fontWeight: '800', color: Colors.text },
  verificationType: { fontSize: 13, color: Colors.textSecondary, marginLeft: 4 },
  verificationStatusHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  verificationMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  idImageWrap: { marginTop: 4 },
  idImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: Colors.inputBackground },
  idImageActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  dangerGhostButton: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.destructive + '08',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.destructive + '20',
  },
  dangerGhostText: { fontSize: 13, fontWeight: '700', color: Colors.destructive },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  pickerDropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerOptionSelected: { backgroundColor: Colors.primary + '0D' },
  pickerOptionText: { fontSize: 14, color: Colors.text },
  pickerOptionTextSelected: { fontWeight: '700', color: Colors.primary },
  selectedImageWrap: { marginTop: 4 },
  changePhotoLink: { alignItems: 'center', paddingVertical: 8 },
  changePhotoText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  uploadBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  uploadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  uploadSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  uploadHint: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  verificationInfoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
    alignItems: 'flex-start',
  },
  verificationInfoText: { flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 14 },
});
