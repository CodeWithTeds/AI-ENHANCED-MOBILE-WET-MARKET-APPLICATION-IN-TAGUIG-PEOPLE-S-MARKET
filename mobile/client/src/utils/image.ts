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
    // If it points to localhost / 127.0.0.1, replace with the configured API host
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      const idx = trimmed.indexOf('/storage/');
      if (idx !== -1) {
        return `${storageBase}${trimmed.substring(idx)}`;
      }
    }
    return trimmed;
  }

  // Strip leading slashes and optional 'storage/' prefix to avoid duplicate '/storage/storage/'
  const cleanPath = trimmed.replace(/^\/?(storage\/)?/, '');
  return `${storageBase}/storage/${cleanPath}`;
}
