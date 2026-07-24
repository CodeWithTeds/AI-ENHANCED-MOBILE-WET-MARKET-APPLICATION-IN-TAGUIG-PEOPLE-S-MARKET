/**
 * Vendor Dashboard — fullscreen single-view layout.
 * Everything fits on one screen, no scrolling needed.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

export default function VendorDashboard() {
  const { vendor } = useAuth();
  const greeting = getGreeting();

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerBg}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.headerContent}>
            <View style={styles.headerTopRow}>
              <View>
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={11} color="#F97316" />
                  <Text style={styles.locationLabel}>Your Stall</Text>
                </View>
                <Text style={styles.marketName}>{vendor?.stall_name ?? 'My Store'}</Text>
              </View>
              <TouchableOpacity style={styles.notifButton} accessibilityLabel="Notifications">
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                <View style={styles.notifDot} />
              </TouchableOpacity>
            </View>
            <Text style={styles.greetingText}>{greeting}! 🇵🇭</Text>
            <Text style={styles.headline}>How's business today?</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Body — fills remaining space */}
      <View style={styles.body}>
        {/* Today's Overview */}
        <Text style={styles.sectionTitle}>Today's Overview</Text>

        {/* Stats 2x2 Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard icon="trending-up-outline" label="Sales" value="₱0" color="#1B6B45" bgColor="#DCFCE7" />
            <StatCard icon="time-outline" label="Pending" value="0" color="#F97316" bgColor="#FFF7ED" />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="cube-outline" label="Products" value="0" color="#2563EB" bgColor="#DBEAFE" />
            <StatCard icon="warning-outline" label="Low Stock" value="0" color="#DC2626" bgColor="#FEE2E2" />
          </View>
        </View>

        {/* Sales — compressed inline */}
        <View style={styles.salesSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.emoji}>💰</Text>
              <Text style={styles.subTitle}>Sales</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.salesRow}>
            <SalesItem icon="cash-outline" value="₱0.00" label="Revenue" bgColor="#DCFCE7" color="#1B6B45" />
            <SalesItem icon="bag-check-outline" value="0" label="Completed" bgColor="#DBEAFE" color="#2563EB" />
            <SalesItem icon="people-outline" value="0" label="Customers" bgColor="#FFF7ED" color="#F97316" />
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.ordersSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.emoji}>📋</Text>
              <Text style={styles.subTitle}>Recent Orders</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.seeAll}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyRow}>
            <Ionicons name="receipt-outline" size={18} color="#D1D5DB" />
            <Text style={styles.emptyText}>No orders yet — they'll show up here</Text>
          </View>
        </View>

        {/* Spacer pushes market hours to bottom */}
        <View style={styles.spacer} />

        {/* Market Hours Bar */}
        <View style={styles.marketBar}>
          <View style={styles.marketIcon}>
            <MaterialCommunityIcons name="store" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.marketInfo}>
            <Text style={styles.marketTime}>4:00 AM – 2:00 PM</Text>
            <Text style={styles.marketLocation}>{vendor?.stall_location ?? 'Taguig People\'s Market'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Open</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─── Sub-components ─── */

function StatCard({ icon, label, value, color, bgColor }: {
  icon: string; label: string; value: string; color: string; bgColor: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function SalesItem({ icon, value, label, bgColor, color }: {
  icon: string; value: string; label: string; bgColor: string; color: string;
}) {
  return (
    <View style={styles.salesCard}>
      <View style={[styles.salesIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={styles.salesValue}>{value}</Text>
      <Text style={styles.salesLabel}>{label}</Text>
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header
  headerBg: {
    backgroundColor: '#1B6B45',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  safeHeader: {},
  headerContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationLabel: {
    fontSize: 11,
    color: '#86EFAC',
    fontWeight: '500',
  },
  marketName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  notifButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
    borderWidth: 1.5,
    borderColor: '#1B6B45',
  },
  greetingText: {
    fontSize: 13,
    color: '#86EFAC',
    fontWeight: '500',
    marginTop: 12,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },

  // Body
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  // Stats 2x2
  statsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  // Sales compressed
  salesSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  emoji: {
    fontSize: 14,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B6B45',
  },
  salesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  salesCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  salesIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  salesValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  salesLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 1,
  },

  // Orders
  ordersSection: {
    marginBottom: 8,
  },
  emptyRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    flex: 1,
  },

  // Spacer
  spacer: {
    flex: 1,
  },

  // Market bar
  marketBar: {
    flexDirection: 'row',
    backgroundColor: '#1B6B45',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
  },
  marketIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketInfo: {
    flex: 1,
  },
  marketTime: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  marketLocation: {
    fontSize: 10,
    color: '#86EFAC',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#86EFAC',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
