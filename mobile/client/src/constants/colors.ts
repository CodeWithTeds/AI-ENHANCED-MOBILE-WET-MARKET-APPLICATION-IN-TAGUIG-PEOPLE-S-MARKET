/**
 * TaguigSuki color palette — green-based (oklch hue 155).
 * Derived from the web admin panel's CSS custom properties.
 */

export const Colors = {
  primary: '#1B8A5A', // oklch(0.48 0.1 155) approx
  primaryLight: '#2DAF73', // oklch(0.55 0.1 155) approx
  primaryDark: '#136B45',
  primaryForeground: '#FFFFFF',

  secondary: '#F0F2F5', // oklch(0.96 0.01 240)
  secondaryForeground: '#1F2937',

  background: '#F5F7FA', // oklch(0.965 0.005 240)
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  border: '#E5E7EB',
  borderFocused: '#1B8A5A',
  inputBackground: '#F9FAFB',

  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',

  success: '#16A34A',
  warning: '#F59E0B',

  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export type ColorKey = keyof typeof Colors;
