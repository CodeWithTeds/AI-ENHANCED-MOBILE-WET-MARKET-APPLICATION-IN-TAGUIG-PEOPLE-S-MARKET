/**
 * API base URL — defaults to the Railway production deployment.
 * Override locally with EXPO_PUBLIC_API_URL (e.g. in .env.local):
 *   EXPO_PUBLIC_API_URL=http://192.168.1.2:8080/api/v1
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.4:8080/api/v1';

// Kept for backwards compatibility; prefer API_BASE_URL directly
export const API_CONFIG = {
  host: '192.168.1.4',
  port: '8080',
} as const;
