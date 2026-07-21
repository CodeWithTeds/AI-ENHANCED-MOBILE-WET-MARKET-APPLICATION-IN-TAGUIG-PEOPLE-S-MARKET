/**
 * Vendor Dashboard — sales overview, pending orders, inventory summary.
 */

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

export default function VendorDashboard() {
  const { vendor, user } = useAuth();

  const greeting = getGreeting();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{greeting} 👋</Text>
              <Text style={styles.vendorName}>{vendor?.stall_name ?? user?.name}</Text>
            </View>
            <TouchableOpacity style={styles.notifButton} accessibilityLabel="Notifications">
              <Feather name="bell" size={22} color={Colors.text} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>
          <Text style={styles.location}>
            <Feather name="map-pin" size={12} color={Colors.primary} /> {vendor?.stall_location ?? 'Taguig People\'s Market'}
          </Text>
        </View>

        {/* Sales Overview Cards */}
        <Text style={styles.sectionTitle}>Sales Overview</Text>
        <View style={styles.statsRow}>
          <StatCard
            icon="trending-up"
            label="Today's Sales"
            value="₱0.00"
            color="#488562"
          />
          <StatCard
            icon="dollar-sign"
            label="This Month"
            value="₱0.00"
            color="#0867ff"
          />
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <QuickStat icon="clock" label="Pending Orders" value="0" color="#ee600e" />
          <QuickStat icon="package" label="Products" value="0" color="#488562" />
          <QuickStat icon="alert-circle" label="Low Stock" value="0" color="#dc2626" />
        </View>

        {/* Recent Orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyCard}>
          <Feather name="inbox" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySubtext}>
            Orders from customers will appear here
          </Text>
        </View>

        {/* Inventory Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inventory Summary</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Manage</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyCard}>
          <Feather name="box" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No products listed</Text>
          <Text style={styles.emptySubtext}>
            Add products to start selling
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickStat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.quickStatCard}>
      <View style={[styles.quickStatIcon, { backgroundColor: `${color}15` }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.quickStatValue}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Header
  header: {
    marginBottom: 24,
    paddingTop: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  notifButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.destructive,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  location: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 12,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  quickStatLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
