/**
 * Step 2: Business Information — collects stall name, location, categories.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormInput } from '@/components/registration/FormInput';
import { CategoryPicker } from '@/components/registration/CategoryPicker';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';
import { STALL_LOCATIONS, type BusinessInfo } from '@/types/vendor';

interface StepBusinessInfoProps {
  data: BusinessInfo;
  onNext: (data: BusinessInfo) => void;
  onBack: () => void;
}

export function StepBusinessInfo({ data, onNext, onBack }: StepBusinessInfoProps) {
  const [form, setForm] = useState<BusinessInfo>(data);
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessInfo, string>>>({});

  function updateField(field: keyof BusinessInfo, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function toggleCategory(category: string) {
    const updated = form.productCategories.includes(category)
      ? form.productCategories.filter((c) => c !== category)
      : [...form.productCategories, category];
    updateField('productCategories', updated);
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof BusinessInfo, string>> = {};

    if (!form.stallName.trim()) {
      newErrors.stallName = 'Stall/Business name is required';
    }

    if (!form.stallLocation.trim()) {
      newErrors.stallLocation = 'Stall location is required';
    }

    if (form.productCategories.length === 0) {
      newErrors.productCategories = 'Select at least one category';
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
          <Text style={styles.stepLabel}>Step 2 of 4</Text>
          <Text style={styles.title}>Business Information</Text>
          <Text style={styles.subtitle}>
            Tell us about your stall at Taguig People's Market
          </Text>
        </View>

        <View style={styles.form}>
          <FormInput
            label="Stall Name / Business Name"
            required
            placeholder="e.g. Aling Rosa's Fresh Fish"
            value={form.stallName}
            onChangeText={(v) => updateField('stallName', v)}
            error={errors.stallName}
          />

          <FormInput
            label="Stall Location"
            required
            placeholder="e.g. Stall 12, Meat Section"
            value={form.stallLocation}
            onChangeText={(v) => updateField('stallLocation', v)}
            error={errors.stallLocation}
          />

          <View style={styles.locationHints}>
            <Text style={styles.hintTitle}>Common locations:</Text>
            <View style={styles.hintChips}>
              {STALL_LOCATIONS.map((loc) => (
                <Text
                  key={loc}
                  style={styles.hintChip}
                  onPress={() => updateField('stallLocation', loc)}
                >
                  {loc}
                </Text>
              ))}
            </View>
          </View>

          <CategoryPicker
            selected={form.productCategories}
            onToggle={toggleCategory}
            error={errors.productCategories}
          />
        </View>

        <View style={styles.buttons}>
          <PrimaryButton
            title="Back"
            onPress={onBack}
            variant="outline"
            style={styles.backButton}
          />
          <PrimaryButton
            title="Continue"
            onPress={handleNext}
            style={styles.nextButton}
          />
        </View>
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
  locationHints: {
    marginBottom: 20,
  },
  hintTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  hintChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hintChip: {
    fontSize: 11,
    color: Colors.primary,
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});
