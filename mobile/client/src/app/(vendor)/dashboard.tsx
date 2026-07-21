/**
 * Vendor Dashboard — same design language as reference UI (green header, cards, etc.)
 * but with vendor-specific data: sales, orders, inventory, products.
 */

import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

export default function VendorDashboard() {
  const { vendor, user } = useAuth();
  const greeting = getGreeting();

  return (
    <View style={styles.screen}>
      {/* Green Header */}
      <View style={styles.headerBg}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            {/* Top row */}
            <View style={styles.headerTopRow}>
              <View>
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={12} color="#F97316" />
                  <Text style={styles.locationLabel}>Your Stall</Text>
                </View>
                <Text style={styles.marketName}>{vendor?.stall_name ?? 'My Store'}</Text>
              </View>
              <TouchableOpacity style={styles.notifButton} accessibilityLabel="Notifications">
                <Feather name="bell" size={20} color="#FFFFFF" />
                <View style={styles.notifDot} />
              </TouchableOpacity>
            </View>

            {/* Greeting */}
            <Text style={styles.greetingText}>{greeting}! 🇵🇭</Text>
            <Text style={styles.headline}>How's business today?</Text>

            {/* Search */}
            <View style={styles.searchBar}>
              <Feather name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products, orders..."
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity style={styles.searchAiButton}>
                <MaterialCommunityIcons name="filter-variant" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats Row */}
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <QuickStatCard icon="trending-up" label="Sales" value="₱0" color="#1B6B45" bgColor="#DCFCE7" />
          <QuickStatCard icon="clock" label="Pending" value="0" color="#F97316" bgColor="#FFF7ED" />
          <QuickStatCard icon="package" label="Products" value="0" color="#2563EB" bgColor="#DBEAFE" />
          <QuickStatCard icon="alert-triangle" label="Low Stock" value="0" color="#DC2626" bgColor="#FEE2E2" />
        </ScrollView>

        {/* Sales Overview */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.fireEmoji}>💰</Text>
            <Text style={styles.sectionTitle}>Sales Overview</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.salesCards}>
          <View style={styles.salesCard}>
            <View style={[styles.salesIcon, { backgroundColor: '#DCFCE7' }]}>
              <Feather name="dollar-sign" size={20} color="#1B6B45" />
            </View>
            <Text style={styles.salesValue}>₱0.00</Text>
            <Text style={styles.salesLabel}>Today's Revenue</Text>
          </View>
          <View style={styles.salesCard}>
            <View style={[styles.salesIcon, { backgroundColor: '#DBEAFE' }]}>
              <Feather name="shopping-bag" size={20} color="#2563EB" />
            </View>
            <Text style={styles.salesValue}>0</Text>
            <Text style={styles.salesLabel}>Orders Completed</Text>
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.fireEmoji}>📋</Text>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAll}>View all &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyCard}>
          <Feather name="inbox" size={36} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtext}>
            New customer orders will appear here
          </Text>
        </View>

        {/* Inventory Alerts */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.fireEmoji}>📦</Text>
            <Text style={styles.sectionTitle}>Inventory Alerts</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Manage &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyCard}>
          <Feather name="check-circle" size={36} color="#86EFAC" />
          <Text style={styles.emptyTitle}>All stocked up!</Text>
          <Text style={styles.emptySubtext}>
            You'll be notified when products run low
          </Text>
        </View>

        {/* Market Hours Card */}
        <View style={styles.marketHoursCard}>
          <View style={styles.marketHoursContent}>
            <Text style={styles.marketHoursLabel}>Today's Market Hours</Text>
            <Text style={styles.marketHoursTime}>4:00 AM – 2:00 PM</Text>
            <Text style={styles.marketHoursNote}>Your stall: {vendor?.stall_location ?? 'Taguig People\'s Market'}</Text>
          </View>
          <View style={styles.marketHoursIcon}>
            <MaterialCommunityIcons name="store" size={28} color="#FFFFFF" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Components ─── */

function QuickStatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={styles.quickStatCard}>
      <View style={[styles.quickStatIcon, { backgroundColor: bgColor }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.quickStatValue, { color }]}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
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
    paddingBottom: 20,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationLabel: {
    fontSize: 12,
    color: '#86EFAC',
    fontWeight: '500',
  },
  marketName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
    borderWidth: 1.5,
    borderColor: '#1B6B45',
  },
  greetingText: {
    fontSize: 14,
    color: '#86EFAC',
    fontWeight: '500',
    marginTop: 16,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 16,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  searchAiButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },

  // Quick Stats
  statsRow: {
    gap: 12,
    paddingBottom: 20,
  },
  quickStatCard: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  quickStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  fireEmoji: {
    fontSize: 16,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B6B45',
    marginBottom: 12,
  },

  // Sales Cards
  salesCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  salesCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  salesIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  salesValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  salesLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  // Empty Card
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },

  // Market Hours
  marketHoursCard: {
    flexDirection: 'row',
    backgroundColor: '#1B6B45',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marketHoursContent: { flex: 1 },
  marketHoursLabel: {
    fontSize: 12,
    color: '#86EFAC',
    fontWeight: '500',
    marginBottom: 2,
  },
  marketHoursTime: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  marketHoursNote: {
    fontSize: 12,
    color: '#86EFAC',
    marginTop: 2,
  },
  marketHoursIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
