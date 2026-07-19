/**
 * Sign In page — login for existing users (customers & vendors).
 */

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { FormInput } from '@/components/registration/FormInput';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';
import { api, ApiError } from '@/services/api';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = 'Email or phone is required';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignIn() {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await api.request('/login', {
        method: 'POST',
        body: { email, password },
      });
      // TODO: Store token and navigate to dashboard
      Alert.alert('Success', 'Logged in successfully!');
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert('Login Failed', error.message);
      } else {
        Alert.alert('Error', 'Unable to connect. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Feather name="arrow-left" size={20} color={Colors.primary} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <View style={styles.logoCircle}>
                <Text style={styles.logoEmoji}>🛒</Text>
              </View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to your TaguigSuki account</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <FormInput
                label="Email or Phone"
                required
                placeholder="your@email.com or 09XX XXX XXXX"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                }}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <FormInput
                label="Password"
                required
                placeholder="Enter your password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                }}
                error={errors.password}
                isPassword
              />

              <TouchableOpacity style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <PrimaryButton
                title="Sign In"
                onPress={handleSignIn}
                loading={loading}
              />

              <Text style={styles.dividerText}>or</Text>

              <PrimaryButton
                title="Create Vendor Account"
                onPress={() => router.push('/vendor-register')}
                variant="outline"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 20,
  },
  backText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  actions: {
    gap: 14,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
