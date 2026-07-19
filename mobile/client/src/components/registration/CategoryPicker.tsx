/**
 * CategoryPicker — multi-select chip picker for product categories.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { PRODUCT_CATEGORIES } from '@/types/vendor';

interface CategoryPickerProps {
  selected: string[];
  onToggle: (category: string) => void;
  error?: string;
}

export function CategoryPicker({ selected, onToggle, error }: CategoryPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Product Categories <Text style={styles.required}>*</Text>
      </Text>
      <Text style={styles.hint}>Select all that apply</Text>
      <View style={styles.chipContainer}>
        {PRODUCT_CATEGORIES.map((category) => {
          const isSelected = selected.includes(category);
          return (
            <TouchableOpacity
              key={category}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onToggle(category)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${category} category`}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  required: {
    color: Colors.destructive,
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: Colors.destructive,
    marginTop: 6,
  },
});
