/**
 * Step 4: Review & Submit — final confirmation before submitting registration.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';
import type { VendorRegistrationData } from '@/types/vendor';

interface StepReviewProps {
  data: VendorRegistrationData;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}

export function StepReview({ data, onSubmit, onBack, loading }: StepReviewProps) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.stepLabel}>Step 4 of 4</Text>
        <Text style={styles.title}>Review & Submit</Text>
        <Text style={styles.subtitle}>
          Please review your information before submitting
        </Text>
      </View>

      {/* Personal Info Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="user" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Personal Information</Text>
        </View>
        <View style={styles.card}>
          <InfoRow label="Full Name" value={data.personal.fullName} />
          <InfoRow label="Phone" value={data.personal.phone} />
          <InfoRow label="Email" value={data.personal.email || 'Not provided'} />
        </View>
      </View>

      {/* Business Info Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="store" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Business Information</Text>
        </View>
        <View style={styles.card}>
          <InfoRow label="Stall Name" value={data.business.stallName} />
          <InfoRow label="Location" value={data.business.stallLocation} />
          <InfoRow
            label="Categories"
            value={data.business.productCategories.join(', ')}
          />
        </View>
      </View>

      {/* Documents Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="file-text" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Documents</Text>
        </View>
        <View style={styles.card}>
          <DocumentRow
            label="Business Permit"
            uploaded={!!data.documents.businessPermit}
            fileName={data.documents.businessPermit?.name}
          />
          <DocumentRow
            label="Stall Lease"
            uploaded={!!data.documents.stallLease}
            fileName={data.documents.stallLease?.name}
          />
          <DocumentRow
            label="Valid ID"
            uploaded={!!data.documents.validId}
            fileName={data.documents.validId?.name}
          />
        </View>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          By submitting, your account will be reviewed by the Taguig People's Market
          admin. You'll be notified once your registration is approved.
        </Text>
      </View>

      <View style={styles.buttons}>
        <PrimaryButton
          title="Back"
          onPress={onBack}
          variant="outline"
          style={styles.backButton}
          disabled={loading}
        />
        <PrimaryButton
          title="Submit Registration"
          onPress={onSubmit}
          loading={loading}
          style={styles.submitButton}
        />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DocumentRow({
  label,
  uploaded,
  fileName,
}: {
  label: string;
  uploaded: boolean;
  fileName?: string;
}) {
  return (
    <View style={styles.docRow}>
      <View style={styles.docLeft}>
        <Feather
          name={uploaded ? 'check-circle' : 'x-circle'}
          size={16}
          color={uploaded ? Colors.success : Colors.destructive}
        />
        <Text style={styles.docLabel}>{label}</Text>
      </View>
      {fileName && (
        <Text style={styles.docName} numberOfLines={1}>
          {fileName}
        </Text>
      )}
    </View>
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
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '60',
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    flex: 2,
    textAlign: 'right',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '60',
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  docName: {
    fontSize: 11,
    color: Colors.textMuted,
    maxWidth: 120,
  },
  disclaimer: {
    backgroundColor: Colors.warning + '10',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
