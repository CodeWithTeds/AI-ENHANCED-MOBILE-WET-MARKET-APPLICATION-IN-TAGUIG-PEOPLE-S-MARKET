/**
 * Landing Page — TaguigSuki welcome screen.
 * Entry point for users: Sign In or Create Account (Vendor registration).
 */

import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PrimaryButton } from '@/components/registration/PrimaryButton';
import { Colors } from '@/constants/colors';

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🛒</Text>
            </View>
          </View>

          <Text style={styles.appName}>TaguigSuki</Text>
          <Text style={styles.tagline}>
            Your AI-Enhanced Wet Market{'\n'}Shopping Experience
          </Text>
        </View>

        {/* Features Preview */}
        <View style={styles.featuresSection}>
          <FeatureItem
            icon="🍳"
            title="AI Recipe Suggestions"
            description="Get personalized recipes based on what's fresh"
          />
          <FeatureItem
            icon="📍"
            title="Taguig People's Market"
            description="Browse vendors and ingredients in real-time"
          />
          <FeatureItem
            icon="🛍️"
            title="Easy Ordering"
            description="Order from multiple vendors in one checkout"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <PrimaryButton
            title="Sign In"
            onPress={() => router.push('/sign-in')}
          />

          <PrimaryButton
            title="Create Account"
            onPress={() => router.push('/vendor-register')}
            variant="outline"
            style={styles.createButton}
          />

          <Text style={styles.vendorHint}>
            Are you a vendor?{' '}
            <Text
              style={styles.vendorLink}
              onPress={() => router.push('/vendor-register')}
            >
              Register your stall
            </Text>
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Taguig People's Market • Powered by AI
        </Text>
      </SafeAreaView>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Text style={styles.featureEmoji}>{icon}</Text>
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
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
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'android' ? 24 : 8,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    gap: 14,
    paddingVertical: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: {
    fontSize: 22,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  actionsSection: {
    gap: 12,
    paddingTop: 8,
  },
  createButton: {
    marginTop: 0,
  },
  vendorHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  vendorLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});
