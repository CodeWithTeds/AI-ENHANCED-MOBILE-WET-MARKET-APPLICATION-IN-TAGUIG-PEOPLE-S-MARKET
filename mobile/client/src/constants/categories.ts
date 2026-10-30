import { ImageSourcePropType } from 'react-native';

export interface CategoryConfig {
  key: string;
  label: string;
  emoji: string;
  image: ImageSourcePropType;
  bg: string;
  accentColor: string;
}

export const CATEGORY_IMAGES: Record<string, ImageSourcePropType> = {
  all: require('@/assets/images/categories/all.jpg'),
  meat: require('@/assets/images/categories/meat.jpg'),
  poultry: require('@/assets/images/categories/poultry.jpg'),
  fish: require('@/assets/images/categories/fish.jpg'),
  seafood: require('@/assets/images/categories/seafood.jpg'),
  vegetables: require('@/assets/images/categories/vegetables.jpg'),
  fruits: require('@/assets/images/categories/fruits.jpg'),
  spices: require('@/assets/images/categories/spices.jpg'),
  condiments: require('@/assets/images/categories/condiments.jpg'),
  dairy: require('@/assets/images/categories/dairy.jpg'),
  grains: require('@/assets/images/categories/grains.jpg'),
  dryIngredients: require('@/assets/images/categories/dry-ingredients.jpg'),
  herbs: require('@/assets/images/categories/herbs.jpg'),
};

export const CATEGORY_DEFINITIONS: Record<string, CategoryConfig> = {
  all: {
    key: 'all',
    label: 'All',
    emoji: '🛒',
    image: CATEGORY_IMAGES.all,
    bg: '#E8F5E9',
    accentColor: '#1B6B45',
  },
  meat: {
    key: 'meat',
    label: 'Meat',
    emoji: '🥩',
    image: CATEGORY_IMAGES.meat,
    bg: '#FFEBEE',
    accentColor: '#DC2626',
  },
  poultry: {
    key: 'poultry',
    label: 'Poultry',
    emoji: '🍗',
    image: CATEGORY_IMAGES.poultry,
    bg: '#FFF8E1',
    accentColor: '#D97706',
  },
  fish: {
    key: 'fish',
    label: 'Fish',
    emoji: '🐟',
    image: CATEGORY_IMAGES.fish,
    bg: '#E3F2FD',
    accentColor: '#2563EB',
  },
  seafood: {
    key: 'seafood',
    label: 'Seafood',
    emoji: '🦐',
    image: CATEGORY_IMAGES.seafood,
    bg: '#E0F2F1',
    accentColor: '#0D9488',
  },
  vegetables: {
    key: 'vegetables',
    label: 'Vegetables',
    emoji: '🥬',
    image: CATEGORY_IMAGES.vegetables,
    bg: '#E8F5E9',
    accentColor: '#16A34A',
  },
  fruits: {
    key: 'fruits',
    label: 'Fruits',
    emoji: '🍎',
    image: CATEGORY_IMAGES.fruits,
    bg: '#FFF3E0',
    accentColor: '#EA580C',
  },
  spices: {
    key: 'spices',
    label: 'Spices',
    emoji: '🌶️',
    image: CATEGORY_IMAGES.spices,
    bg: '#FCE4EC',
    accentColor: '#E11D48',
  },
  condiments: {
    key: 'condiments',
    label: 'Condiments',
    emoji: '🫙',
    image: CATEGORY_IMAGES.condiments,
    bg: '#F3E5F5',
    accentColor: '#9333EA',
  },
  dairy: {
    key: 'dairy',
    label: 'Dairy',
    emoji: '🥛',
    image: CATEGORY_IMAGES.dairy,
    bg: '#EDE7F6',
    accentColor: '#4F46E5',
  },
  grains: {
    key: 'grains',
    label: 'Grains & Rice',
    emoji: '🌾',
    image: CATEGORY_IMAGES.grains,
    bg: '#FFF9C4',
    accentColor: '#CA8A04',
  },
  dryIngredients: {
    key: 'dry-ingredients',
    label: 'Dry Ingredients',
    emoji: '🥫',
    image: CATEGORY_IMAGES.dryIngredients,
    bg: '#FFFDE7',
    accentColor: '#D97706',
  },
  herbs: {
    key: 'herbs',
    label: 'Herbs',
    emoji: '🌿',
    image: CATEGORY_IMAGES.herbs,
    bg: '#F1F8E9',
    accentColor: '#65A30D',
  },
};

/**
 * Normalized lookup for any category string.
 * Gracefully resolves variations like "poultry", "Poultry", "Chicken", "Grains & Rice", etc.
 */
export function getCategoryConfig(category?: string | null): CategoryConfig {
  if (!category) return CATEGORY_DEFINITIONS.all;

  const raw = category.trim().toLowerCase();

  // Direct key lookup
  if (CATEGORY_DEFINITIONS[raw]) {
    return CATEGORY_DEFINITIONS[raw];
  }

  // Common aliases and synonyms
  if (/poult|chick|manok|duck|pato|turkey/i.test(raw)) {
    return CATEGORY_DEFINITIONS.poultry;
  }
  if (/seafood|shrimp|hipon|prawn|crab|alimango|alimasag|squid|pusit|shellfish/i.test(raw)) {
    return CATEGORY_DEFINITIONS.seafood;
  }
  if (/fish|isda|bangus|tilapia|salmon|tuna|galunggong/i.test(raw)) {
    return CATEGORY_DEFINITIONS.fish;
  }
  if (/meat|beef|pork|karne|baboy|baka|steak|mutton|lamb/i.test(raw)) {
    return CATEGORY_DEFINITIONS.meat;
  }
  if (/veg|gulay|lettuce|cabbage|carrot|spinach/i.test(raw)) {
    return CATEGORY_DEFINITIONS.vegetables;
  }
  if (/fruit|prutas|mango|apple|banana|orange/i.test(raw)) {
    return CATEGORY_DEFINITIONS.fruits;
  }
  if (/spice|sili|chili|pepper|garlic|bawang|onion|sibuyas|ginger|luya/i.test(raw)) {
    return CATEGORY_DEFINITIONS.spices;
  }
  if (/condiment|sauce|toyo|patis|suka|vinegar|oil|seasoning/i.test(raw)) {
    return CATEGORY_DEFINITIONS.condiments;
  }
  if (/dairy|milk|gatas|cheese|keso|egg|itlog|butter/i.test(raw)) {
    return CATEGORY_DEFINITIONS.dairy;
  }
  if (/grain|rice|bigas|palay|cereal|oat|flour|corn|mais/i.test(raw)) {
    return CATEGORY_DEFINITIONS.grains;
  }
  if (/dry|pantry|bean|mongo|legume/i.test(raw)) {
    return CATEGORY_DEFINITIONS.dryIngredients;
  }
  if (/herb|dahon|basil|parsley|cilantro|oregano/i.test(raw)) {
    return CATEGORY_DEFINITIONS.herbs;
  }

  // Fallback with clean title casing and shopping bag emoji (never mismatched cardboard box)
  const formattedLabel = category.charAt(0).toUpperCase() + category.slice(1);
  return {
    key: raw,
    label: formattedLabel,
    emoji: '🛒',
    image: CATEGORY_IMAGES.all,
    bg: '#F3F4F6',
    accentColor: '#1B6B45',
  };
}

export function getCategoryEmoji(category?: string | null): string {
  return getCategoryConfig(category).emoji;
}

export function getCategoryColor(category?: string | null): string {
  return getCategoryConfig(category).bg;
}

export function getCategoryImage(category?: string | null): ImageSourcePropType {
  return getCategoryConfig(category).image;
}
