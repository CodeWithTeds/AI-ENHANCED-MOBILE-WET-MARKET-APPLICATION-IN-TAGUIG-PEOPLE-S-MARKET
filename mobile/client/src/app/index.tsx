/**
 * Landing Page — TaguigSuki auth screen with Sign In / Create Account tabs.
 * Matches the client's UI design mockup.
 */

import { useState } from 'react';
import {
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
import { Feather, FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

type Tab = 'sign-in' | 'create-account';

export default function LandingScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('sign-in');

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Green Header */}
          <View style={styles.header}>
            <SafeAreaView edges={['top']}>
              <View style={styles.headerContent}>
                <View style={styles.logoRow}>
                  <View style={styles.logoIcon}>
                    <Ionicons name="checkbox-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View>
                    <View style={styles.freshRow}>
                      <Ionicons name="leaf-outline" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.freshLabel}>FRESH & LOCAL</Text>
                    </View>
                    <Text style={styles.appName}>TaguigSuki</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  Order fresh ingredients from{' '}
                  <Text style={styles.headerHighlight}>Taguig People's Market</Text>
                </Text>
              </View>
            </SafeAreaView>
          </View>

          {/* White Content Area */}
          <View style={styles.contentArea}>
            {/* Tab Switcher */}
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'sign-in' && styles.tabActive]}
                onPress={() => setActiveTab('sign-in')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'sign-in' }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'sign-in' && styles.tabTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'create-account' && styles.tabActive]}
                onPress={() => setActiveTab('create-account')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'create-account' }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'create-account' && styles.tabTextActive,
                  ]}
                >
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            {activeTab === 'sign-in' ? <SignInForm /> : <CreateAccountPrompt />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SignInForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }

  return (
    <View style={styles.formSection}>
      {/* Mobile Number */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Mobile Number</Text>
        <View style={styles.phoneInputWrapper}>
          <View style={styles.phonePrefix}>
            <Text style={styles.phonePrefixFlag}>PH</Text>
            <Text style={styles.phonePrefixText}>+63</Text>
            <View style={styles.phoneDivider} />
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="917 123 4567"
            placeholderTextColor={Colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            accessibilityLabel="Mobile number"
          />
          <Feather name="phone" size={18} color={Colors.textMuted} />
        </View>
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Password</Text>
        <View style={styles.inputWrapper}>
          <Feather name="lock" size={18} color={Colors.textMuted} style={styles.inputIconLeft} />
          <TextInput
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            accessibilityLabel="Password"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.inputIconRight}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Forgot Password */}
      <TouchableOpacity style={styles.forgotButton}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* Sign In Button */}
      <TouchableOpacity
        style={[styles.signInButton, loading && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={loading}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={styles.signInButtonText}>
          {loading ? 'Signing In...' : 'Sign In'}
        </Text>
        {!loading && <Feather name="chevron-right" size={20} color="#FFFFFF" />}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Buttons */}
      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialButton} accessibilityRole="button">
          <FontAwesome name="google" size={16} color="#DB4437" />
          <Text style={styles.socialLabel}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton} accessibilityRole="button">
          <FontAwesome name="facebook" size={16} color="#4267B2" />
          <Text style={styles.socialLabel}>Facebook</Text>
        </TouchableOpacity>
      </View>

      {/* Terms */}
      <Text style={styles.termsText}>
        By continuing, you agree to our{' '}
        <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>
    </View>
  );
}

function CreateAccountPrompt() {
  return (
    <View style={styles.formSection}>
      <View style={styles.createAccountContent}>
        <View style={styles.createIcon}>
          <MaterialCommunityIcons name="store" size={30} color={Colors.primary} />
        </View>
        <Text style={styles.createTitle}>Join TaguigSuki</Text>
        <Text style={styles.createSubtitle}>
          Register as a vendor to list your products and start receiving orders
          from customers at Taguig People's Market.
        </Text>

        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push('/vendor-register')}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.signInButtonText}>Register as Vendor</Text>
          <Feather name="chevron-right" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.customerButton}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Feather name="user" size={18} color={Colors.primary} />
          <Text style={styles.customerButtonText}>Sign Up as Customer</Text>
        </TouchableOpacity>
      </View>

      {/* Terms */}
      <Text style={styles.termsText}>
        By continuing, you agree to our{' '}
        <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freshLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },
  headerHighlight: {
    fontWeight: '700',
    textDecorationLine: 'underline',
    color: '#FFFFFF',
  },

  // Content
  contentArea: {
    paddingHorizontal: 24,
    paddingTop: 24,
    flex: 1,
  },

  // Tabs
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // Form
  formSection: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },

  // Phone input
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 52,
    paddingHorizontal: 14,
  },
  phonePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phonePrefixFlag: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },

  // Password input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 52,
    paddingHorizontal: 14,
  },
  inputIconLeft: {
    marginRight: 10,
  },
  inputIconRight: {
    marginLeft: 10,
    padding: 4,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },

  // Forgot password
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Sign In button
  signInButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginHorizontal: 12,
  },

  // Social buttons
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  socialLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  // Terms
  termsText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingBottom: 24,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Create Account tab
  createAccountContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  createIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  createSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  customerButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  customerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
