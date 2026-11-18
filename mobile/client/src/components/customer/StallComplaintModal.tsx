import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import {
  fetchAllStalls,
  StallComplaintType,
  StallInfo,
  submitStallComplaint,
} from '@/services/stalls';

export interface TargetStall {
  stallId?: number;
  vendorId?: number;
  stallName: string;
  stallNumber?: string;
  sectionName?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  targetStall?: TargetStall | null;
  authToken?: string | null;
  onSubmitted?: () => void;
}

const COMPLAINT_TYPES: {
  value: StallComplaintType;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  {
    value: 'bad_smell',
    label: 'Bad Smell / Foul Odor',
    sublabel: 'Mabahong amoy mula sa puwesto, kanal, o drainage',
    icon: 'warning-outline',
    color: '#D97706',
  },
  {
    value: 'cleanliness',
    label: 'Cleanliness & Sanitation',
    sublabel: 'Marumi, may mga kalat, o hindi malinis ang kagamitan',
    icon: 'sparkles-outline',
    color: '#DC2626',
  },
  {
    value: 'improper_handling',
    label: 'Improper Food Handling',
    sublabel: 'Walang hairnet/guwantes, maruming paghiwa, sirang karne/isda',
    icon: 'hand-left-outline',
    color: '#E11D48',
  },
  {
    value: 'obstruction',
    label: 'Pathway Obstruction',
    sublabel: 'Nakaharang sa daanan o pasilyo ng mga mamimili',
    icon: 'ban-outline',
    color: '#EA580C',
  },
  {
    value: 'noise',
    label: 'Excessive Noise',
    sublabel: 'Masyadong malakas na sound system, megaphone, o sigawan',
    icon: 'volume-high-outline',
    color: '#7C3AED',
  },
  {
    value: 'other',
    label: 'Other Concern',
    sublabel: 'Iba pang alalahanin ukol sa puwesto o panuntunan ng palengke',
    icon: 'information-circle-outline',
    color: '#4B5563',
  },
];

export function StallComplaintModal({
  visible,
  onClose,
  targetStall,
  authToken,
  onSubmitted,
}: Props) {
  const [selectedType, setSelectedType] = useState<StallComplaintType>('cleanliness');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // General stall selector state (when targetStall is not specified)
  const [allStalls, setAllStalls] = useState<StallInfo[]>([]);
  const [loadingStalls, setLoadingStalls] = useState(false);
  const [selectedStallId, setSelectedStallId] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (visible && !targetStall) {
      setLoadingStalls(true);
      fetchAllStalls()
        .then((list) => {
          setAllStalls(list);
          if (list.length > 0 && !selectedStallId) {
            setSelectedStallId(list[0].id);
          }
        })
        .finally(() => setLoadingStalls(false));
    }
  }, [visible, targetStall]);

  useEffect(() => {
    if (targetStall?.stallId) {
      setSelectedStallId(targetStall.stallId);
    }
  }, [targetStall]);

  const filteredStalls = allStalls.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.store_name.toLowerCase().includes(q) ||
      s.stall_number.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  });

  async function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Required Field', 'Please provide details or a description of your concern.');
      return;
    }

    const stallId = targetStall?.stallId ?? selectedStallId ?? undefined;
    const vendorId = targetStall?.vendorId ?? undefined;

    if (!stallId && !vendorId) {
      Alert.alert('Select Stall', 'Please select which market stall this report pertains to.');
      return;
    }

    setSubmitting(true);
    try {
      await submitStallComplaint(
        {
          stall_id: stallId,
          vendor_id: vendorId,
          complaint_type: selectedType,
          description: description.trim(),
        },
        authToken
      );

      Alert.alert(
        'Report Submitted',
        'Your report has been logged and forwarded to Taguig People\'s Market Administration for inspection and compliance tracking.',
        [
          {
            text: 'OK',
            onPress: () => {
              setDescription('');
              onClose();
              onSubmitted?.();
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Submission Failed',
        err.message || 'Unable to submit your report right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="shield-half-outline" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Report Stall Concern</Text>
                <Text style={styles.headerSubtitle}>
                  Taguig People's Market Sanitation &amp; Compliance
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Target Stall Display or Stall Selector */}
            {targetStall ? (
              <View style={styles.targetStallCard}>
                <Ionicons name="storefront" size={24} color="#488562" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.targetStallName}>{targetStall.stallName}</Text>
                  <Text style={styles.targetStallMeta}>
                    {targetStall.stallNumber ? `${targetStall.stallNumber} · ` : ''}
                    {targetStall.sectionName ?? 'Taguig People\'s Market'}
                  </Text>
                </View>
                <View style={styles.tpmBadge}>
                  <Text style={styles.tpmBadgeText}>Official Stall</Text>
                </View>
              </View>
            ) : (
              <View style={styles.selectorCard}>
                <Text style={styles.sectionLabel}>Select Market Stall</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search stall name or number..."
                  value={searchFilter}
                  onChangeText={setSearchFilter}
                  placeholderTextColor="#9CA3AF"
                />
                {loadingStalls ? (
                  <ActivityIndicator size="small" color="#488562" style={{ marginVertical: 10 }} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stallPillScroll}>
                    {filteredStalls.map((s) => {
                      const isSel = selectedStallId === s.id;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.stallPill, isSel && styles.stallPillActive]}
                          onPress={() => setSelectedStallId(s.id)}
                        >
                          <Text style={[styles.stallPillText, isSel && styles.stallPillTextActive]} numberOfLines={1}>
                            {s.stall_number} · {s.store_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Complaint Categories */}
            <Text style={styles.sectionLabel}>Category of Concern</Text>
            <View style={styles.categoriesContainer}>
              {COMPLAINT_TYPES.map((type) => {
                const isSelected = selectedType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                    onPress={() => setSelectedType(type.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.categoryIconWrap, { backgroundColor: type.color + '15' }]}>
                      <Ionicons name={type.icon} size={20} color={type.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.categoryTitle, isSelected && styles.categoryTitleSelected]}>
                        {type.label}
                      </Text>
                      <Text style={styles.categorySublabel} numberOfLines={2}>
                        {type.sublabel}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? '#488562' : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description Textarea */}
            <Text style={styles.sectionLabel}>Detailed Description / Observation</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Please describe what you observed (e.g., strong foul odor coming from drainage, dirty cutting boards, unattended trash, blocked pathway)..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              maxLength={1000}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length} / 1000 characters</Text>

            {/* Confidentiality Notice */}
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#059669" />
              <Text style={styles.noticeText}>
                Reports are treated with strict confidentiality and sent directly to Taguig City market inspectors to enforce public market sanitation and stall guidelines.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginLeft: 8,
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  targetStallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  targetStallName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  targetStallMeta: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
  },
  tpmBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tpmBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  selectorCard: {
    marginBottom: 16,
  },
  searchInput: {
    height: 38,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#111827',
    marginTop: 4,
    marginBottom: 8,
  },
  stallPillScroll: {
    flexDirection: 'row',
  },
  stallPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stallPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  stallPillText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  stallPillTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#4B5563',
    marginBottom: 8,
  },
  categoriesContainer: {
    gap: 8,
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  categoryCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#488562',
  },
  categoryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryTitleSelected: {
    color: '#15803D',
  },
  categorySublabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  textArea: {
    height: 90,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  charCount: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#065F46',
    lineHeight: 15,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  submitBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#488562',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
