/**
 * StarRating — interactive 5-star input + read-only display.
 * Used by order tracking reviews, product details, and recipe ratings.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/* ─── Interactive input ─── */

export function StarRating({
  value,
  onChange,
  size = 30,
  disabled = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !disabled && onChange(star)}
          disabled={disabled}
          activeOpacity={0.7}
          accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
          style={styles.starBtn}
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? '#F59E0B' : '#D1D5DB'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─── Read-only summary ─── */

export function StarRatingDisplay({
  value,
  total,
  size = 14,
  color = '#F59E0B',
}: {
  value: number;
  total?: number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={styles.displayRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= Math.round(value) ? 'star' : 'star-outline'}
          size={size}
          color={star <= Math.round(value) ? color : '#D1D5DB'}
        />
      ))}
      <Text style={styles.displayValue}>
        {Number(value).toFixed(1)}
        {typeof total === 'number' ? ` (${total})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  starBtn: { padding: 2 },
  displayRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  displayValue: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginLeft: 6 },
});
