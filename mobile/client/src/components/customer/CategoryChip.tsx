import React, { useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getCategoryConfig } from '@/constants/categories';

interface CategoryChipProps {
  category: string;
  label?: string;
  isActive: boolean;
  onPress: () => void;
  size?: number;
}

export function CategoryChip({
  category,
  label,
  isActive,
  onPress,
  size = 62,
}: CategoryChipProps) {
  const [imageError, setImageError] = useState(false);
  const config = getCategoryConfig(category);
  const displayLabel = label ?? config.label;

  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.containerActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${displayLabel}`}
      accessibilityState={{ selected: isActive }}
    >
      <View
        style={[
          styles.imageWrapper,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.32),
            backgroundColor: config.bg,
            borderColor: isActive ? '#1B6B45' : '#E5E7EB',
            borderWidth: isActive ? 2.5 : 1.5,
          },
          isActive && styles.imageWrapperActive,
        ]}
      >
        {!imageError ? (
          <Image
            source={config.image}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.fallbackContainer, { backgroundColor: config.bg }]}>
            <Text style={[styles.fallbackEmoji, { fontSize: Math.round(size * 0.44) }]}>
              {config.emoji}
            </Text>
          </View>
        )}

        {/* Mini badge with accurate category emoji for instant recognition */}
        <View
          style={[
            styles.emojiBadge,
            {
              backgroundColor: isActive ? '#1B6B45' : '#FFFFFF',
              borderColor: isActive ? '#FFFFFF' : '#E5E7EB',
            },
          ]}
        >
          <Text style={styles.badgeEmoji}>{config.emoji}</Text>
        </View>
      </View>

      <Text
        style={[
          styles.label,
          isActive && styles.labelActive,
        ]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 7,
    width: 72,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  containerActive: {
    transform: [{ scale: 1.02 }],
  },
  imageWrapper: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  imageWrapperActive: {
    shadowColor: '#1B6B45',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    textAlign: 'center',
  },
  emojiBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeEmoji: {
    fontSize: 11,
    lineHeight: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  labelActive: {
    color: '#1B6B45',
    fontWeight: '800',
  },
});
