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
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
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
  fullAddress: "Taguig People's Market, Dir. A. Bunye, Lower Bicutan, Taguig, Metro Manila",
  plusCode: "F3Q6+467 Taguig, Metro Manila",
  hours: "4:00 AM – 8:00 PM",
  googleMapsUrl: "https://maps.app.goo.gl/PbsVj5UYSiaskFj68?g_st=ic",
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=Taguig+People%27s+Market,+Dir.+A.+Bunye,+Lower+Bicutan,+Taguig,+Metro+Manila",
};

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
    html, body, #map { height: 100%; width: 100%; background: #e5e7eb; overflow: hidden; }
    .custom-popup .leaflet-popup-content-wrapper {
      background: #111827;
      color: #ffffff;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .custom-popup .leaflet-popup-content { margin: 6px 8px; line-height: 1.35; color: #ffffff; }
    .custom-popup .leaflet-popup-tip { background: #111827; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${MARKET_COORDINATES.latitude};
    var lng = ${MARKET_COORDINATES.longitude};
    var map = L.map('map', {
      center: [lat, lng],
      zoom: 17,
      zoomControl: true,
      attributionControl: false
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);
    var marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup("<b>Taguig People's Market</b><br>Dir. A. Bunye, Lower Bicutan", { className: 'custom-popup' }).openPopup();
  </script>
</body>
</html>
`;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function MarketLocationModal({ visible, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!visible) return null;

  async function openGoogleMaps() {
    try {
      const supported = await Linking.canOpenURL(MARKET_DETAILS.googleMapsUrl);
      if (supported || Platform.OS === 'web') {
        await Linking.openURL(MARKET_DETAILS.googleMapsUrl);
      } else {
        await Linking.openURL(MARKET_DETAILS.directionsUrl);
      }
    } catch {
      await Linking.openURL(MARKET_DETAILS.googleMapsUrl);
    }
  }

  async function openDirections() {
    const destination = encodeURIComponent(MARKET_DETAILS.fullAddress);
    const url =
      Platform.OS === 'ios'
        ? `maps://?daddr=${MARKET_COORDINATES.latitude},${MARKET_COORDINATES.longitude}&q=${destination}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(MARKET_DETAILS.googleMapsUrl);
      }
    } catch {
      await Linking.openURL(MARKET_DETAILS.googleMapsUrl);
    }
  }

  async function handleCopyAddress() {
    const textToCopy = MARKET_DETAILS.fullAddress;
    try {
      await Clipboard.setStringAsync(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          return;
        } catch {
          // ignore
        }
      }
      Alert.alert('Address Copied', textToCopy);
    }
  }

  async function handleCopyLink() {
    const linkToCopy = MARKET_DETAILS.googleMapsUrl;
    try {
      await Clipboard.setStringAsync(linkToCopy);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(linkToCopy);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
          return;
        } catch {
          // ignore
        }
      }
      Alert.alert('Link Copied', linkToCopy);
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
              <View style={StyleSheet.absoluteFill}>
                {/* @ts-ignore iframe for web platform */}
                <iframe
                  title="Taguig People's Market Location"
                  srcDoc={MAP_HTML}
                  width="100%"
                  height="100%"
                  style={{ border: 0, borderRadius: 16 }}
                />
                <TouchableOpacity
                  onPress={openGoogleMaps}
                  style={styles.openMapOverlayBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Open in Google Maps"
                >
                  <Ionicons name="open-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.openMapOverlayText}>Google Maps</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Mobile Native Interactive Leaflet Map (Zero API Key Required)
              <View style={styles.nativeMapCard}>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: MAP_HTML }}
                  style={styles.webView}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  scalesPageToFit={false}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                />
                <TouchableOpacity
                  onPress={openGoogleMaps}
                  style={styles.openMapOverlayBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Open in Google Maps"
                >
                  <Ionicons name="open-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.openMapOverlayText}>Google Maps</Text>
                </TouchableOpacity>
              </View>
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
              <TouchableOpacity
                onPress={handleCopyAddress}
                style={{ flex: 1 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Copy market address to clipboard"
              >
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{MARKET_DETAILS.address}</Text>
                <Text style={styles.plusCode}>Plus Code: {MARKET_DETAILS.plusCode}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopyAddress}
                style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
                accessibilityRole="button"
                accessibilityLabel="Copy address"
              >
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

            {/* Google Maps Link Row */}
            <View style={styles.infoRow}>
              <Ionicons name="link-outline" size={18} color={Colors.primary} style={styles.infoIcon} />
              <TouchableOpacity
                onPress={openGoogleMaps}
                style={{ flex: 1 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open Google Maps link"
              >
                <Text style={styles.infoLabel}>Google Maps Link</Text>
                <Text style={[styles.infoValue, { color: Colors.primary }]} numberOfLines={1}>
                  {MARKET_DETAILS.googleMapsUrl}
                </Text>
                <Text style={styles.infoHint}>Tap to open in Google Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopyLink}
                style={[styles.copyBtn, copiedLink && styles.copyBtnSuccess]}
                accessibilityRole="button"
                accessibilityLabel="Copy Google Maps link"
              >
                <Ionicons
                  name={copiedLink ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copiedLink ? '#16A34A' : Colors.primary}
                />
                <Text style={[styles.copyBtnText, copiedLink && { color: '#16A34A' }]}>
                  {copiedLink ? 'Copied' : 'Copy'}
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
    position: 'relative',
  },
  openMapOverlayBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 10,
  },
  openMapOverlayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nativeMapCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
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
  copyBtnSuccess: {
    backgroundColor: '#DCFCE7',
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
