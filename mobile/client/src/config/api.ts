/**
 * API base URL — defaults to the Railway production deployment.
 * Override locally with EXPO_PUBLIC_API_URL (e.g. in .env.local):
 *   EXPO_PUBLIC_API_URL=http://192.168.1.2:8080/api/v1
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://ai-enhanced-mobile-wet-market-application-in-tag-production.up.railway.app/api/v1';

// Kept for backwards compatibility; prefer API_BASE_URL directly
export const API_CONFIG = {
  host: 'ai-enhanced-mobile-wet-market-application-in-tag-production.up.railway.app',
  port: '',
} as const;
