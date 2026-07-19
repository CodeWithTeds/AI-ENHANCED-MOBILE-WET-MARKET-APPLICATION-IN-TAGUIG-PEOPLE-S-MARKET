/**
 * Success Screen — shown after successful vendor registration submission.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';

interface SuccessScreenProps {
  onGoHome: () => void;
}

export function SuccessScreen({ onGoHome }: SuccessScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Feather name="check-circle" size={44} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Registration Submitted!</Text>
      <Text style={styles.subtitle}>
        Your vendor account is now pending approval
      </Text>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Pending Admin Review</Text>
        </View>
        <Text style={styles.statusDescription}>
          The Taguig People's Market admin will review your documents and
          business information. You'll receive a notification once your account
          is approved.
        </Text>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>What happens next?</Text>
        <TimelineItem
          step="1"
          title="Admin Reviews"
          description="Your documents and business info will be verified"
        />
        <TimelineItem
          step="2"
          title="Approval Notification"
          description="You'll be notified once approved"
        />
        <TimelineItem
          step="3"
          title="Start Selling"
          description="List your products and start receiving orders"
          isLast
        />
      </View>

      <PrimaryButton
        title="Go to Home"
        onPress={onGoHome}
        style={styles.button}
      />
    </View>
  );
}

function TimelineItem({
  step,
  title,
  description,
  isLast = false,
}: {
  step: string;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineStep}>
          <Text style={styles.timelineStepText}>{step}</Text>
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineItemTitle}>{title}</Text>
        <Text style={styles.timelineItemDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  statusCard: {
    width: '100%',
    backgroundColor: Colors.warning + '10',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.warning,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  statusDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  timelineCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 32,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 14,
  },
  timelineStep: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineStepText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryForeground,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.primary + '30',
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 18,
  },
  timelineItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  timelineItemDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  button: {
    width: '100%',
  },
});
