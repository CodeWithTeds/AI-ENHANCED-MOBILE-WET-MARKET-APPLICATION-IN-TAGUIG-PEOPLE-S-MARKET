import { API_BASE_URL } from '@/config/api';

/**
 * Returns a fully qualified, loadable URL for a product image uploaded by a vendor.
 * Handles relative storage paths, full URLs, and localhost fallback.
 */
export function getProductImageUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;

  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  const storageBase = API_BASE_URL.replace('/api/v1', '');

  // If already an absolute http/https URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it points to localhost / 127.0.0.1 / local LAN IP, replace with configured API host
    const isLocalOrLan =
      trimmed.includes('localhost') ||
      trimmed.includes('127.0.0.1') ||
      trimmed.includes('192.168.') ||
      trimmed.includes('10.0.') ||
      trimmed.includes('172.');

    if (isLocalOrLan) {
      const idx = trimmed.indexOf('/storage/');
      if (idx !== -1) {
        return `${storageBase}${trimmed.substring(idx)}`;
      }
    }

    // If storageBase uses https, upgrade http to https to avoid Android mixed-content blocking
    if (storageBase.startsWith('https://') && trimmed.startsWith('http://')) {
      return trimmed.replace('http://', 'https://');
    }

    return trimmed;
  }

  // Strip leading slashes and optional 'storage/' prefix to avoid duplicate '/storage/storage/'
  const cleanPath = trimmed.replace(/^\/?(storage\/)?/, '');
  return `${storageBase}/storage/${cleanPath}`;
}
