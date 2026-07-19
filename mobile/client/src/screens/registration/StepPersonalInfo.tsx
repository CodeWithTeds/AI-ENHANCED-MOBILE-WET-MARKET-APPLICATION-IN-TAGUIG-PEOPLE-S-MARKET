/**
 * Step 1: Personal Information — collects name, email, phone, password.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormInput } from '@/components/registration/FormInput';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';
import type { PersonalInfo } from '@/types/vendor';

interface StepPersonalInfoProps {
  data: PersonalInfo;
  onNext: (data: PersonalInfo) => void;
}

export function StepPersonalInfo({ data, onNext }: StepPersonalInfoProps) {
  const [form, setForm] = useState<PersonalInfo>(data);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalInfo, string>>>({});

  function updateField(field: keyof PersonalInfo, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof PersonalInfo, string>> = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (validate()) {
      onNext(form);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Step 1 of 4</Text>
          <Text style={styles.title}>Personal Information</Text>
          <Text style={styles.subtitle}>
            Let's start with your basic details
          </Text>
        </View>

        <View style={styles.form}>
          <FormInput
            label="Full Name"
            required
            placeholder="e.g. Juan Dela Cruz"
            value={form.fullName}
            onChangeText={(v) => updateField('fullName', v)}
            error={errors.fullName}
            autoCapitalize="words"
          />

          <FormInput
            label="Phone Number"
            required
            placeholder="09XX XXX XXXX"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            error={errors.phone}
            keyboardType="phone-pad"
          />

          <FormInput
            label="Email"
            placeholder="your@email.com (optional)"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormInput
            label="Password"
            required
            placeholder="Minimum 8 characters"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            error={errors.password}
            isPassword
          />

          <FormInput
            label="Confirm Password"
            required
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChangeText={(v) => updateField('confirmPassword', v)}
            error={errors.confirmPassword}
            isPassword
          />
        </View>

        <PrimaryButton title="Continue" onPress={handleNext} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
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
});
