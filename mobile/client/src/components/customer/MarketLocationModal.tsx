/**
 * MarketLocationModal — displays Taguig People's Market location with interactive map & directions.
 * Responsive across web and mobile devices.
 */

import { useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const MARKET_COORDINATES = {
  latitude: 14.4877766,
  longitude: 121.0605427,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

export const MARKET_DETAILS = {
  name: "Taguig People's Market",
  address: "Dir. A. Bunye, Lower Bicutan, Taguig, Metro Manila",
  plusCode: "F3Q6+467 Taguig, Metro Manila",
  hours: "4:00 AM – 8:00 PM",
  googleMapsUrl:
    "https://www.google.com/maps/place/Taguig+People's+Market/@14.4877766,121.0605427,17z",
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=14.4877766,121.0605427",
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function MarketLocationModal({ visible, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  async function openGoogleMaps() {
    try {
      const supported = await Linking.canOpenURL(MARKET_DETAILS.googleMapsUrl);
      if (supported || Platform.OS === 'web') {
        await Linking.openURL(MARKET_DETAILS.googleMapsUrl);
      } else {
        // Fallback to directions
        await Linking.openURL(MARKET_DETAILS.directionsUrl);
      }
    } catch {
      await Linking.openURL(MARKET_DETAILS.googleMapsUrl);
    }
  }

  async function openDirections() {
    const url =
      Platform.OS === 'ios'
        ? `maps://?daddr=${MARKET_COORDINATES.latitude},${MARKET_COORDINATES.longitude}&q=${encodeURIComponent(MARKET_DETAILS.name)}`
        : MARKET_DETAILS.directionsUrl;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(MARKET_DETAILS.directionsUrl);
      }
    } catch {
      await Linking.openURL(MARKET_DETAILS.directionsUrl);
    }
  }

  function handleCopyAddress() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${MARKET_DETAILS.name}, ${MARKET_DETAILS.address}`);
    } else {
      Alert.alert('Address Copied', MARKET_DETAILS.address);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Market Location
          </Text>
          <TouchableOpacity onPress={openGoogleMaps} style={styles.externalBtn} accessibilityLabel="Open in Google Maps">
            <Ionicons name="open-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Interactive Map Section */}
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              // @ts-ignore iframe for web platform
              <iframe
                title="Taguig People's Market Location"
                src={`https://maps.google.com/maps?q=${MARKET_COORDINATES.latitude},${MARKET_COORDINATES.longitude}&hl=en&z=17&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0, borderRadius: 16 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              // Mobile Native Interactive Preview Card
              <TouchableOpacity
                style={styles.nativeMapCard}
                onPress={openGoogleMaps}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Tap to view interactive map in Google Maps"
              >
                <View style={styles.nativeMapBackground}>
                  <View style={styles.gridOverlay} />
                  {/* Pin Marker */}
                  <View style={styles.markerContainer}>
                    <View style={styles.markerPulse} />
                    <View style={styles.markerPin}>
                      <Ionicons name="location" size={28} color="#EA4335" />
                    </View>
                    <View style={styles.markerCallout}>
                      <Text style={styles.markerTitle}>Taguig People&apos;s Market</Text>
                      <Text style={styles.markerCoords}>14.4878° N, 121.0605° E</Text>
                    </View>
                  </View>
                  <View style={styles.tapMapHint}>
                    <Ionicons name="map-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.tapMapHintText}>Tap to open Google Maps</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Market Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="storefront" size={24} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.marketTitle}>{MARKET_DETAILS.name}</Text>
                <View style={styles.statusRow}>
                  <View style={styles.dotOpen} />
                  <Text style={styles.statusOpen}>Open Daily · {MARKET_DETAILS.hours}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Address Row */}
            <View style={styles.infoRow}>
              <Ionicons name="location-sharp" size={18} color={Colors.primary} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{MARKET_DETAILS.address}</Text>
                <Text style={styles.plusCode}>Plus Code: {MARKET_DETAILS.plusCode}</Text>
              </View>
              <TouchableOpacity onPress={handleCopyAddress} style={styles.copyBtn} accessibilityRole="button">
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copied ? '#16A34A' : Colors.primary}
                />
                <Text style={[styles.copyBtnText, copied && { color: '#16A34A' }]}>
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hours Row */}
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Operating Hours</Text>
                <Text style={styles.infoValue}>{MARKET_DETAILS.hours}</Text>
                <Text style={styles.infoHint}>Fresh goods and vendor stalls available daily</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openDirections}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Get Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openGoogleMaps}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name="map" size={18} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  externalBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  mapContainer: {
    height: Math.min(SCREEN_WIDTH * 0.75, 300),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  nativeMapCard: {
    flex: 1,
  },
  nativeMapBackground: {
    flex: 1,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.1,
    backgroundColor: '#1E40AF',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerPulse: {
    position: 'absolute',
    top: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(234, 67, 53, 0.25)',
  },
  markerPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCallout: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    alignItems: 'center',
  },
  markerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  markerCoords: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  tapMapHint: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tapMapHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotOpen: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  statusOpen: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },
  plusCode: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  infoHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButtons: {
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    height: 50,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
