/**
 * Customer Login / Register — auth screen for customers.
 * Tab-based UI with Sign In and Create Account.
 */

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { CustomerAuthProvider, useCustomerAuth } from '@/context/CustomerAuthContext';
import { ApiError } from '@/services/api';

type Tab = 'sign-in' | 'create-account';

export default function CustomerLoginScreen() {
  return (
    <CustomerAuthProvider>
      <CustomerLoginContent />
    </CustomerAuthProvider>
  );
}

function CustomerLoginContent() {
  const [activeTab, setActiveTab] = useState<Tab>('sign-in');

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <SafeAreaView edges={['top']}>
              <View style={styles.headerContent}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <View style={styles.logoIcon}>
                    <Ionicons name="cart-outline" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.appName}>TaguigSuki</Text>
                  <Text style={styles.headerSubtitle}>
                    Fresh ingredients from Taguig People's Market
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </View>

          {/* Content */}
          <View style={styles.contentArea}>
            {/* Tabs */}
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'sign-in' && styles.tabActive]}
                onPress={() => setActiveTab('sign-in')}
              >
                <Text style={[styles.tabText, activeTab === 'sign-in' && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'create-account' && styles.tabActive]}
                onPress={() => setActiveTab('create-account')}
              >
                <Text style={[styles.tabText, activeTab === 'create-account' && styles.tabTextActive]}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'sign-in' ? <SignInForm /> : <RegisterForm />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ─── Sign In Form ─── */

function SignInForm() {
  const { login } = useCustomerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      router.replace('/(customer)/home');
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Login failed. Try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.formSection}>
      <Text style={styles.fieldLabel}>Email Address</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <Text style={styles.fieldLabel}>Password</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.forgotBtn}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text style={styles.primaryButtonText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
        {!loading && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
      </TouchableOpacity>
    </View>
  );
}

/* ─── Register Form ─── */

function RegisterForm() {
  const { register } = useCustomerAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirmPassword,
      });
      router.replace('/(customer)/home');
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Registration failed.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.formSection}>
      <Text style={styles.fieldLabel}>Full Name</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Juan Dela Cruz" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
      </View>

      <Text style={styles.fieldLabel}>Email Address</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <Text style={styles.fieldLabel}>Password</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Min. 8 characters" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
      </View>

      <Text style={styles.fieldLabel}>Confirm Password</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="Repeat password" placeholderTextColor={Colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.primaryButtonText}>{loading ? 'Creating Account...' : 'Create Account'}</Text>
        {!loading && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
      </TouchableOpacity>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Header
  header: { backgroundColor: '#1B6B45', paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { paddingHorizontal: 20, paddingTop: 4 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  headerCenter: { alignItems: 'center' },
  logoIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  appName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#86EFAC', marginTop: 4, textAlign: 'center' },

  // Content
  contentArea: { paddingHorizontal: 24, paddingTop: 20, flex: 1 },

  // Tabs
  tabSwitcher: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: '#1B6B45' },

  // Form
  formSection: { flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 12 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', height: 50, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.text, height: '100%' },
  eyeBtn: { marginLeft: 8, padding: 4 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 6, marginBottom: 16 },
  forgotText: { fontSize: 13, fontWeight: '600', color: '#1B6B45' },

  primaryButton: { backgroundColor: '#1B6B45', borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, marginBottom: 24 },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
