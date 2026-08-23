/**
 * Vendor Reviews & Ratings Screen
 * Shows customer ratings and feedback for the vendor's stall and products.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/services/auth';
import {
  getVendorReviewsDashboard,
  type ProductReviewItem,
  type Review,
  type ReviewSummary,
  type VendorReviewsDashboardResponse,
} from '@/services/reviews';

const SCREEN_WIDTH = Dimensions.get('window').width;

/* ─── Design Tokens ─── */
const C = {
  bg: '#F4F7F5',
  card: '#FFFFFF',
  ink: '#0F1E17',
  sub: '#586A61',
  muted: '#94A39A',
  line: '#E7ECE9',
  brand: '#10B981',
  brandDark: '#0B8F60',
  brandSoft: '#E7F7EF',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  purple: '#8B5CF6',
  purpleSoft: '#F5F3FF',
  orange: '#F97316',
  orangeSoft: '#FFF4EB',
  header: '#0E8F5B',
  starFilled: '#F59E0B',
  starEmpty: '#E5E7EB',
} as const;

type Tab = 'stall' | 'products';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

export default function VendorReviewsScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<VendorReviewsDashboardResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('stall');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const authToken = token ?? (await getToken());
    if (!authToken) { setLoading(false); setRefreshing(false); return; }
    try {
      const result = await getVendorReviewsDashboard(authToken);
      setData(result);
    } catch {
      // keep last data on refresh failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const stall = data?.stall ?? { reviews: [], average_rating: 0, total: 0, rating_counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  const products = data?.products ?? { reviews: [], average_rating: 0, total: 0, rating_counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

  // Overall combined rating
  const totalReviews = stall.total + products.total;
  const overallRating = totalReviews > 0
    ? Math.round(((stall.average_rating * stall.total) + (products.average_rating * products.total)) / totalReviews * 10) / 10
    : 0;

  const activeData = activeTab === 'stall' ? stall : products;

  // Apply filter + sort
  const filteredReviews = useMemo(() => {
    let list: (Review | ProductReviewItem)[] = [...activeData.reviews];

    if (selectedRatingFilter !== null) {
      list = list.filter((r) => r.rating === selectedRatingFilter);
    }

    switch (sortBy) {
      case 'newest':
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'highest':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        list.sort((a, b) => a.rating - b.rating);
        break;
    }
    return list;
  }, [activeData.reviews, selectedRatingFilter, sortBy]);

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerNav}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Ratings & Reviews</Text>
              <View style={{ width: 38 }} />
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={styles.loadingText}>Loading customer feedback…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ─── Header ─── */}
      <View style={styles.headerWrap}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <View style={styles.headerNav}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
                <Ionicons name="arrow-back" size={20} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerEyebrow}>Customer Feedback</Text>
                <Text style={styles.headerTitle}>Ratings & Reviews</Text>
              </View>
              <View style={{ width: 38 }} />
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={C.brand}
          />
        }
      >
        {/* ─── Overall Score Hero ─── */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroScoreLabel}>Overall Rating</Text>
            <Text style={styles.heroScore}>{overallRating > 0 ? overallRating.toFixed(1) : '—'}</Text>
            <StarRow rating={overallRating} size={22} />
            <Text style={styles.heroTotalReviews}>
              {totalReviews > 0
                ? `Based on ${totalReviews} customer review${totalReviews !== 1 ? 's' : ''}`
                : 'No reviews yet'}
            </Text>
          </View>

          <View style={styles.heroRight}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = (stall.rating_counts[star] ?? 0) + (products.rating_counts[star] ?? 0);
              const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <TouchableOpacity
                  key={star}
                  style={styles.ratingBarRow}
                  onPress={() => setSelectedRatingFilter(selectedRatingFilter === star ? null : star)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.ratingBarStar}>{star}</Text>
                  <Ionicons name="star" size={10} color={C.starFilled} />
                  <View style={styles.ratingBarTrack}>
                    <View style={[styles.ratingBarFill, { width: `${Math.max(2, pct)}%`, backgroundColor: getBarColor(star) }]} />
                  </View>
                  <Text style={styles.ratingBarCount}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── KPI Cards ─── */}
        <View style={styles.kpiRow}>
          <KpiCard
            icon="star"
            label="Stall Rating"
            value={stall.average_rating > 0 ? stall.average_rating.toFixed(1) : '—'}
            sub={`${stall.total} review${stall.total !== 1 ? 's' : ''}`}
            color={C.amber}
            bg={C.amberSoft}
          />
          <KpiCard
            icon="cube-outline"
            label="Product Rating"
            value={products.average_rating > 0 ? products.average_rating.toFixed(1) : '—'}
            sub={`${products.total} review${products.total !== 1 ? 's' : ''}`}
            color={C.brand}
            bg={C.brandSoft}
          />
          <KpiCard
            icon="people-outline"
            label="Total Feedback"
            value={String(totalReviews)}
            sub="all sources"
            color={C.blue}
            bg={C.blueSoft}
          />
        </View>

        {/* ─── Tab Switcher ─── */}
        <View style={styles.tabRow}>
          {(['stall', 'products'] as Tab[]).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'stall' ? 'Stall Reviews' : 'Product Reviews';
            const count = tab === 'stall' ? stall.total : products.total;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => { setActiveTab(tab); setSelectedRatingFilter(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Rating Filter + Sort Controls ─── */}
        <View style={styles.controlsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
            <TouchableOpacity
              style={[styles.filterPill, selectedRatingFilter === null && styles.filterPillActive]}
              onPress={() => setSelectedRatingFilter(null)}
            >
              <Text style={[styles.filterPillText, selectedRatingFilter === null && styles.filterPillTextActive]}>All</Text>
            </TouchableOpacity>
            {[5, 4, 3, 2, 1].map((star) => {
              const active = selectedRatingFilter === star;
              return (
                <TouchableOpacity
                  key={star}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setSelectedRatingFilter(active ? null : star)}
                >
                  <Ionicons name="star" size={11} color={active ? '#FFF' : C.starFilled} />
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{star}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => {
              const order: SortOption[] = ['newest', 'highest', 'lowest', 'oldest'];
              const idx = order.indexOf(sortBy);
              setSortBy(order[(idx + 1) % order.length]);
            }}
          >
            <Ionicons name="swap-vertical" size={13} color={C.sub} />
            <Text style={styles.sortBtnText}>
              {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'highest' ? '⭐ High' : '⭐ Low'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Reviews List ─── */}
        <View style={styles.reviewsCard}>
          <View style={styles.reviewsHeader}>
            <View style={styles.reviewsHeaderLeft}>
              <View style={[styles.reviewsHeaderIcon, { backgroundColor: C.amberSoft }]}>
                <Ionicons name="chatbubble-outline" size={16} color={C.amber} />
              </View>
              <View>
                <Text style={styles.reviewsTitle}>
                  {activeTab === 'stall' ? 'Stall Feedback' : 'Product Feedback'}
                </Text>
                <Text style={styles.reviewsSubtitle}>
                  {filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''}
                  {selectedRatingFilter !== null ? ` with ${selectedRatingFilter}★` : ''}
                </Text>
              </View>
            </View>
          </View>

          {filteredReviews.length === 0 ? (
            <EmptyState
              icon="star-outline"
              title={selectedRatingFilter !== null ? `No ${selectedRatingFilter}★ reviews` : 'No reviews yet'}
              sub={selectedRatingFilter !== null
                ? 'Try clearing the filter to see all feedback.'
                : activeTab === 'stall'
                  ? 'Customer stall ratings will appear here once orders are completed and reviewed.'
                  : 'Customer product ratings will appear here once they review purchased items.'}
            />
          ) : (
            filteredReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isProduct={activeTab === 'products'}
                expanded={expandedId === review.id}
                onToggle={() => setExpandedId(expandedId === review.id ? null : review.id)}
              />
            ))
          )}
        </View>

        {/* ─── Insight Summary ─── */}
        {totalReviews > 0 && (
          <InsightSummary stall={stall} products={products} />
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Sub-components ─── */

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={star <= Math.round(rating) ? C.starFilled : C.starEmpty}
        />
      ))}
    </View>
  );
}

function KpiCard({ icon, label, value, sub, color, bg }: {
  icon: string; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function ReviewCard({ review, isProduct, expanded, onToggle }: {
  review: Review | ProductReviewItem;
  isProduct: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const productReview = isProduct ? (review as ProductReviewItem) : null;
  const dateStr = new Date(review.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const timeStr = new Date(review.created_at).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.reviewCard}>
      <TouchableOpacity style={styles.reviewCardHeader} onPress={onToggle} activeOpacity={0.75}>
        {/* Avatar */}
        <View style={[styles.reviewAvatar, { backgroundColor: getAvatarColor(review.user) }]}>
          <Text style={styles.reviewAvatarText}>{review.user.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.reviewInfo}>
          <View style={styles.reviewNameRow}>
            <Text style={styles.reviewerName} numberOfLines={1}>{review.user}</Text>
            {productReview && (
              <View style={styles.productBadge}>
                <Text style={styles.productBadgeText} numberOfLines={1}>{productReview.product_name}</Text>
              </View>
            )}
          </View>
          {/* Stars inline */}
          <View style={styles.reviewStarsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= review.rating ? 'star' : 'star-outline'}
                size={13}
                color={s <= review.rating ? C.starFilled : C.starEmpty}
              />
            ))}
            <Text style={styles.reviewRatingText}>{review.rating}.0</Text>
          </View>
          {review.comment ? (
            <Text style={styles.reviewComment} numberOfLines={expanded ? undefined : 2}>
              {review.comment}
            </Text>
          ) : (
            <Text style={styles.noCommentText}>No written comment</Text>
          )}
        </View>

        <View style={styles.reviewRight}>
          <Text style={styles.reviewDate}>{dateStr}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.muted} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.reviewExpanded}>
          <View style={styles.reviewDivider} />
          <View style={styles.reviewDetailRow}>
            <Ionicons name="time-outline" size={12} color={C.muted} />
            <Text style={styles.reviewDetailText}>{dateStr} at {timeStr}</Text>
          </View>
          {productReview && (
            <View style={styles.reviewDetailRow}>
              <Ionicons name="cube-outline" size={12} color={C.muted} />
              <Text style={styles.reviewDetailText}>
                {productReview.product_name} · {productReview.product_category}
              </Text>
            </View>
          )}
          <View style={styles.fullStarRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= review.rating ? 'star' : 'star-outline'}
                size={20}
                color={s <= review.rating ? C.starFilled : C.starEmpty}
              />
            ))}
            <Text style={styles.fullStarRating}>{review.rating} / 5</Text>
          </View>
          {review.comment && (
            <View style={styles.commentBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={C.brand} />
              <Text style={styles.commentBoxText}>"{review.comment}"</Text>
            </View>
          )}
          {/* Sentiment chip */}
          <View style={[styles.sentimentChip, { backgroundColor: getSentimentColor(review.rating).bg }]}>
            <Ionicons name={getSentimentColor(review.rating).icon as any} size={12} color={getSentimentColor(review.rating).color} />
            <Text style={[styles.sentimentText, { color: getSentimentColor(review.rating).color }]}>
              {getSentimentLabel(review.rating)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function InsightSummary({ stall, products }: { stall: ReviewSummary; products: { reviews: ProductReviewItem[]; average_rating: number; total: number; rating_counts: Record<number, number> } }) {
  const stallPositive = (stall.rating_counts[5] ?? 0) + (stall.rating_counts[4] ?? 0);
  const stallNegative = (stall.rating_counts[1] ?? 0) + (stall.rating_counts[2] ?? 0);
  const prodPositive = (products.rating_counts[5] ?? 0) + (products.rating_counts[4] ?? 0);
  const total = stall.total + products.total;
  const positiveRate = total > 0 ? Math.round(((stallPositive + prodPositive) / total) * 100) : 0;

  return (
    <View style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightHeaderIcon, { backgroundColor: C.brandSoft }]}>
          <Ionicons name="analytics-outline" size={16} color={C.brand} />
        </View>
        <Text style={styles.insightTitle}>Performance Insights</Text>
      </View>

      <View style={styles.insightGrid}>
        <View style={styles.insightItem}>
          <Text style={styles.insightValue}>{positiveRate}%</Text>
          <Text style={styles.insightLabel}>Positive Rate</Text>
          <Text style={styles.insightSub}>(4★ & 5★ reviews)</Text>
        </View>
        <View style={styles.insightDivider} />
        <View style={styles.insightItem}>
          <Text style={[styles.insightValue, { color: C.red }]}>{stallNegative}</Text>
          <Text style={styles.insightLabel}>Needs Attention</Text>
          <Text style={styles.insightSub}>(1★ & 2★ reviews)</Text>
        </View>
        <View style={styles.insightDivider} />
        <View style={styles.insightItem}>
          <Text style={[styles.insightValue, { color: C.brand }]}>{stallPositive + prodPositive}</Text>
          <Text style={styles.insightLabel}>Happy Customers</Text>
          <Text style={styles.insightSub}>(4★ & 5★ reviews)</Text>
        </View>
      </View>

      {positiveRate >= 80 && (
        <View style={styles.insightBadge}>
          <Ionicons name="ribbon-outline" size={14} color={C.brandDark} />
          <Text style={styles.insightBadgeText}>Excellent customer satisfaction! Keep up the great work.</Text>
        </View>
      )}
      {positiveRate < 60 && total > 0 && (
        <View style={[styles.insightBadge, { backgroundColor: C.amberSoft }]}>
          <Ionicons name="alert-circle-outline" size={14} color={C.amber} />
          <Text style={[styles.insightBadgeText, { color: C.amber }]}>There are some areas to improve. Check 1–2★ reviews for details.</Text>
        </View>
      )}
    </View>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon as any} size={34} color={C.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

/* ─── Helpers ─── */

function getBarColor(star: number): string {
  if (star >= 4) return C.brand;
  if (star === 3) return C.amber;
  return C.red;
}

function getAvatarColor(name: string): string {
  const colors = [C.brandSoft, C.blueSoft, C.purpleSoft, C.amberSoft, C.orangeSoft];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
}

function getSentimentColor(rating: number) {
  if (rating >= 4) return { color: C.brandDark, bg: C.brandSoft, icon: 'happy-outline' };
  if (rating === 3) return { color: C.amber, bg: C.amberSoft, icon: 'remove-circle-outline' };
  return { color: C.red, bg: C.redSoft, icon: 'sad-outline' };
}

function getSentimentLabel(rating: number): string {
  if (rating === 5) return 'Excellent';
  if (rating === 4) return 'Good';
  if (rating === 3) return 'Neutral';
  if (rating === 2) return 'Poor';
  return 'Very Poor';
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  /* Header */
  headerWrap: {
    backgroundColor: C.header,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerInner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 22 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerEyebrow: { fontSize: 11, fontWeight: '700', color: '#B8F0D4', letterSpacing: 0.5 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: C.muted, fontWeight: '600' },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40, gap: 14 },

  /* Hero rating card */
  heroCard: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  heroLeft: { flex: 0, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
  heroScoreLabel: { fontSize: 10, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroScore: { fontSize: 42, fontWeight: '900', color: C.ink, letterSpacing: -1, marginTop: 4, fontVariant: ['tabular-nums'] },
  heroTotalReviews: { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  heroRight: { flex: 1, gap: 5, justifyContent: 'center' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingBarStar: { fontSize: 11, fontWeight: '700', color: C.sub, width: 10, textAlign: 'right' },
  ratingBarTrack: { flex: 1, height: 7, backgroundColor: '#EBEEEA', borderRadius: 4, overflow: 'hidden' },
  ratingBarFill: { height: '100%', borderRadius: 4 },
  ratingBarCount: { fontSize: 10, color: C.muted, fontWeight: '600', width: 18, textAlign: 'right', fontVariant: ['tabular-nums'] },

  /* KPI row */
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12,
    alignItems: 'center', gap: 3,
    borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: C.sub },
  kpiSub: { fontSize: 9, color: C.muted, fontWeight: '500' },

  /* Tabs */
  tabRow: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#E8EFEA',
    borderRadius: 14, padding: 4,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  tabActive: {
    backgroundColor: C.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3, elevation: 2,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: C.sub },
  tabTextActive: { color: C.brandDark, fontWeight: '800' },
  tabBadge: { backgroundColor: '#D0DDD5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  tabBadgeActive: { backgroundColor: C.brandSoft },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: C.sub },
  tabBadgeTextActive: { color: C.brandDark },

  /* Controls */
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filterPills: { flexGrow: 0 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.card, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16, marginRight: 6,
    borderWidth: 1, borderColor: C.line,
  },
  filterPillActive: { backgroundColor: C.amber, borderColor: C.amber },
  filterPillText: { fontSize: 12, fontWeight: '700', color: C.sub },
  filterPillTextActive: { color: '#FFF' },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.card, paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: C.line,
  },
  sortBtnText: { fontSize: 11, fontWeight: '700', color: C.sub },

  /* Reviews card */
  reviewsCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  reviewsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewsHeaderIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  reviewsTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  reviewsSubtitle: { fontSize: 11, color: C.muted, marginTop: 1 },

  /* Individual review card */
  reviewCard: {
    backgroundColor: '#FAFCFA', borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.line, overflow: 'hidden',
  },
  reviewCardHeader: { flexDirection: 'row', padding: 12, gap: 10, alignItems: 'flex-start' },
  reviewAvatar: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  reviewAvatarText: { fontSize: 16, fontWeight: '800', color: C.ink },
  reviewInfo: { flex: 1 },
  reviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  reviewerName: { fontSize: 13, fontWeight: '700', color: C.ink, flexShrink: 1 },
  productBadge: {
    backgroundColor: C.brandSoft, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 5, flexShrink: 1,
  },
  productBadgeText: { fontSize: 9, fontWeight: '700', color: C.brandDark },
  reviewStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 5 },
  reviewRatingText: { fontSize: 11, fontWeight: '700', color: C.amber, marginLeft: 3 },
  reviewComment: { fontSize: 12, color: C.sub, lineHeight: 17 },
  noCommentText: { fontSize: 11, color: C.muted, fontStyle: 'italic' },
  reviewRight: { alignItems: 'flex-end', gap: 2 },
  reviewDate: { fontSize: 10, color: C.muted, fontWeight: '600' },

  /* Expanded review */
  reviewExpanded: { paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#F3F7F4' },
  reviewDivider: { height: 1, backgroundColor: C.line, marginBottom: 10 },
  reviewDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reviewDetailText: { fontSize: 11, color: C.muted, fontWeight: '600' },
  fullStarRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 8 },
  fullStarRating: { fontSize: 13, fontWeight: '800', color: C.ink, marginLeft: 4 },
  commentBox: {
    backgroundColor: C.card, borderRadius: 10, padding: 10,
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginBottom: 8, borderWidth: 1, borderColor: C.line,
  },
  commentBoxText: { flex: 1, fontSize: 12, color: C.ink, fontStyle: 'italic', lineHeight: 18 },
  sentimentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  sentimentText: { fontSize: 11, fontWeight: '700' },

  /* Insight card */
  insightCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  insightHeaderIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  insightGrid: {
    flexDirection: 'row', backgroundColor: C.bg,
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  insightItem: { flex: 1, alignItems: 'center', gap: 3 },
  insightValue: { fontSize: 20, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  insightLabel: { fontSize: 11, fontWeight: '700', color: C.sub, textAlign: 'center' },
  insightSub: { fontSize: 9, color: C.muted, textAlign: 'center' },
  insightDivider: { width: 1, height: 40, backgroundColor: C.line },
  insightBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.brandSoft, borderRadius: 12,
    padding: 10, marginTop: 12,
  },
  insightBadgeText: { flex: 1, fontSize: 12, fontWeight: '600', color: C.brandDark, lineHeight: 16 },

  /* Empty state */
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 4 },
  emptySub: { fontSize: 12, color: C.muted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },
});
