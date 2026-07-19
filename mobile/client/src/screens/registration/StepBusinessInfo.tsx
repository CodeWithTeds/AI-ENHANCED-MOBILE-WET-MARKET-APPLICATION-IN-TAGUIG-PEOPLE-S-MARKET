/**
 * Step 2: Business Information — collects stall name, selects section/stall from DB, picks categories.
 * Sections and stalls are fetched dynamically from the backend (only vacant stalls shown).
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FormInput } from '@/components/registration/FormInput';
import { CategoryPicker } from '@/components/registration/CategoryPicker';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';
import { fetchSections, fetchVacantStalls } from '@/services/vendor-registration';
import type { BusinessInfo, Section, StallOption } from '@/types/vendor';

interface StepBusinessInfoProps {
  data: BusinessInfo;
  onNext: (data: BusinessInfo) => void;
  onBack: () => void;
}

export function StepBusinessInfo({ data, onNext, onBack }: StepBusinessInfoProps) {
  const [form, setForm] = useState<BusinessInfo>(data);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // Dynamic data from API
  const [sections, setSections] = useState<Section[]>([]);
  const [stalls, setStalls] = useState<StallOption[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingStalls, setLoadingStalls] = useState(false);

  // Load sections on mount
  useEffect(() => {
    loadSections();
  }, []);

  // Load stalls when section changes
  useEffect(() => {
    if (form.sectionId) {
      loadStalls(form.sectionId);
    } else {
      setStalls([]);
    }
  }, [form.sectionId]);

  async function loadSections() {
    try {
      setLoadingSections(true);
      const data = await fetchSections();
      setSections(data);
    } catch {
      // Silently handle — user can retry
    } finally {
      setLoadingSections(false);
    }
  }

  async function loadStalls(sectionId: number) {
    try {
      setLoadingStalls(true);
      const data = await fetchVacantStalls(sectionId);
      setStalls(data);
    } catch {
      setStalls([]);
    } finally {
      setLoadingStalls(false);
    }
  }

  function selectSection(section: Section) {
    setForm((prev) => ({
      ...prev,
      sectionId: section.id,
      stallId: null, // reset stall when section changes
    }));
    if (errors.sectionId) {
      setErrors((prev) => ({ ...prev, sectionId: undefined }));
    }
  }

  function selectStall(stall: StallOption) {
    setForm((prev) => ({ ...prev, stallId: stall.id }));
    if (errors.stallId) {
      setErrors((prev) => ({ ...prev, stallId: undefined }));
    }
  }

  function toggleCategory(category: string) {
    const updated = form.productCategories.includes(category)
      ? form.productCategories.filter((c) => c !== category)
      : [...form.productCategories, category];
    setForm((prev) => ({ ...prev, productCategories: updated }));
    if (errors.productCategories) {
      setErrors((prev) => ({ ...prev, productCategories: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!form.stallName.trim()) {
      newErrors.stallName = 'Stall/Business name is required';
    }
    if (!form.sectionId) {
      newErrors.sectionId = 'Please select a section';
    }
    if (!form.stallId) {
      newErrors.stallId = 'Please select a stall';
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

  const selectedStall = stalls.find((s) => s.id === form.stallId);

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
          {/* Stall Name */}
          <FormInput
            label="Stall Name / Business Name"
            required
            placeholder="e.g. Aling Rosa's Fresh Fish"
            value={form.stallName}
            onChangeText={(v) => {
              setForm((prev) => ({ ...prev, stallName: v }));
              if (errors.stallName) setErrors((prev) => ({ ...prev, stallName: undefined }));
            }}
            error={errors.stallName}
          />

          {/* Section Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Market Section <Text style={styles.required}>*</Text>
            </Text>
            {loadingSections ? (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
            ) : (
              <View style={styles.optionGrid}>
                {sections.map((section) => {
                  const isSelected = form.sectionId === section.id;
                  return (
                    <TouchableOpacity
                      key={section.id}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => selectSection(section)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Feather
                        name="map-pin"
                        size={14}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {section.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {errors.sectionId && <Text style={styles.errorText}>{errors.sectionId}</Text>}
          </View>

          {/* Stall Picker */}
          {form.sectionId && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Available Stalls (Vacant) <Text style={styles.required}>*</Text>
              </Text>
              {loadingStalls ? (
                <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
              ) : stalls.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="alert-circle" size={20} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No vacant stalls in this section</Text>
                </View>
              ) : (
                <View style={styles.stallList}>
                  {stalls.map((stall) => {
                    const isSelected = form.stallId === stall.id;
                    return (
                      <TouchableOpacity
                        key={stall.id}
                        style={[styles.stallCard, isSelected && styles.stallCardSelected]}
                        onPress={() => selectStall(stall)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View style={styles.stallHeader}>
                          <View style={styles.stallInfo}>
                            <Feather
                              name={isSelected ? 'check-circle' : 'circle'}
                              size={18}
                              color={isSelected ? Colors.primary : Colors.textMuted}
                            />
                            <Text style={[styles.stallNumber, isSelected && styles.stallNumberSelected]}>
                              Stall #{stall.stall_number}
                            </Text>
                          </View>
                          <View style={styles.sizeBadge}>
                            <Text style={styles.sizeText}>{stall.size}</Text>
                          </View>
                        </View>
                        <View style={styles.stallMeta}>
                          <Text style={styles.stallRent}>
                            ₱{Number(stall.monthly_rent).toLocaleString()}/mo
                          </Text>
                          {stall.description && (
                            <Text style={styles.stallDesc} numberOfLines={1}>
                              {stall.description}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {errors.stallId && <Text style={styles.errorText}>{errors.stallId}</Text>}
            </View>
          )}

          {/* Selected stall summary */}
          {selectedStall && (
            <View style={styles.selectedSummary}>
              <Feather name="check-square" size={16} color={Colors.primary} />
              <Text style={styles.selectedText}>
                Selected: Stall #{selectedStall.stall_number} — {selectedStall.section} ({selectedStall.size})
              </Text>
            </View>
          )}

          {/* Product Categories */}
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
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  required: {
    color: Colors.destructive,
  },
  loader: {
    paddingVertical: 20,
  },

  // Section grid
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionCardSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Stall list
  stallList: {
    gap: 10,
  },
  stallCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBackground,
    padding: 14,
  },
  stallCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stallInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stallNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  stallNumberSelected: {
    color: Colors.primary,
  },
  sizeBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sizeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  stallMeta: {
    paddingLeft: 26,
  },
  stallRent: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  stallDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Selected summary
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary + '10',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  selectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },

  errorText: {
    fontSize: 12,
    color: Colors.destructive,
    marginTop: 6,
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
