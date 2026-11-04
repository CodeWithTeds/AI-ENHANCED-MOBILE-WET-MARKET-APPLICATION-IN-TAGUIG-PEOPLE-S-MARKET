/**
 * API base URL — defaults to the Railway production deployment.
 * Override locally with EXPO_PUBLIC_API_URL (e.g. in .env.local):
 *   EXPO_PUBLIC_API_URL=https://taguig-suki-production.up.railway.app/api/v1
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://taguig-suki-production.up.railway.app/api/v1';

// Kept for backwards compatibility; prefer API_BASE_URL directly
export const API_CONFIG = {
  host: 'taguig-suki-production.up.railway.app',
  port: '443',
} as const;
