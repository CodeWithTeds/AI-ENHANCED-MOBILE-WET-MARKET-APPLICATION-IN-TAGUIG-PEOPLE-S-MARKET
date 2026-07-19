/**
 * StepIndicator — visual progress indicator for multi-step registration.
 */

import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/colors';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <View key={stepNumber} style={styles.stepRow}>
            <View
              style={[
                styles.dot,
                isActive && styles.dotActive,
                isCompleted && styles.dotCompleted,
              ]}
            />
            {stepNumber < totalSteps && (
              <View
                style={[
                  styles.connector,
                  isCompleted && styles.connectorCompleted,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.primaryLight + '40',
  },
  dotCompleted: {
    backgroundColor: Colors.primary,
  },
  connector: {
    width: 40,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  connectorCompleted: {
    backgroundColor: Colors.primary,
  },
});
