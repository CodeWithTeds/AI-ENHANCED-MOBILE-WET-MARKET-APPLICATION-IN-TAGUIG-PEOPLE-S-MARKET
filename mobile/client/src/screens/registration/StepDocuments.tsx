/**
 * Step 3: Document Uploads — business permit, stall lease, valid ID.
 */

import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { DocumentUploader } from '@/components/registration/DocumentUploader';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';
import type { DocumentsInfo, DocumentUpload } from '@/types/vendor';

interface StepDocumentsProps {
  data: DocumentsInfo;
  onNext: (data: DocumentsInfo) => void;
  onBack: () => void;
}

export function StepDocuments({ data, onNext, onBack }: StepDocumentsProps) {
  const [form, setForm] = useState<DocumentsInfo>(data);
  const [errors, setErrors] = useState<Partial<Record<keyof DocumentsInfo, string>>>({});

  async function pickDocument(field: keyof DocumentsInfo) {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to upload documents.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `${field}_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      const doc: DocumentUpload = {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      };

      setForm((prev) => ({ ...prev, [field]: doc }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    }
  }

  function removeDocument(field: keyof DocumentsInfo) {
    setForm((prev) => ({ ...prev, [field]: null }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof DocumentsInfo, string>> = {};

    if (!form.businessPermit) {
      newErrors.businessPermit = 'Business permit is required';
    }
    if (!form.stallLease) {
      newErrors.stallLease = 'Stall lease/contract is required';
    }
    if (!form.validId) {
      newErrors.validId = 'Valid ID is required';
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
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.stepLabel}>Step 3 of 4</Text>
        <Text style={styles.title}>Proof of Business</Text>
        <Text style={styles.subtitle}>
          Upload documents to verify your business at the market
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Feather name="info" size={16} color={Colors.primary} />
        <Text style={styles.infoText}>
          These documents will be reviewed by the admin for approval. Please
          ensure they are clear and readable.
        </Text>
      </View>

      <View style={styles.form}>
        <DocumentUploader
          label="Business / Mayor's Permit"
          description="Your valid business or mayor's permit"
          document={form.businessPermit}
          onPick={() => pickDocument('businessPermit')}
          onRemove={() => removeDocument('businessPermit')}
          error={errors.businessPermit}
        />

        <DocumentUploader
          label="Market Stall Lease / Contract"
          description="Proof of stall rental at Taguig People's Market"
          document={form.stallLease}
          onPick={() => pickDocument('stallLease')}
          onRemove={() => removeDocument('stallLease')}
          error={errors.stallLease}
        />

        <DocumentUploader
          label="Valid Government ID"
          description="Government-issued ID for identity verification"
          document={form.validId}
          onPick={() => pickDocument('validId')}
          onRemove={() => removeDocument('validId')}
          error={errors.validId}
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
          title="Review & Submit"
          onPress={handleNext}
          style={styles.nextButton}
        />
      </View>
    </ScrollView>
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
    marginBottom: 16,
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '08',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  form: {
    marginBottom: 24,
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
