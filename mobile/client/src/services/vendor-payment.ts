/**
 * Vendor Payment Settings Service — GCash / Maya numbers + QR codes.
 */

import { api, ApiError } from './api';
import { API_BASE_URL } from '@/config/api';

export interface VendorPaymentSettings {
  vendor_id: number;
  stall_name: string;
  gcash_number: string | null;
  gcash_qr_path: string | null;
  gcash_qr_url: string | null;
  maya_number: string | null;
  maya_qr_path: string | null;
  maya_qr_url: string | null;
  has_gcash: boolean;
  has_maya: boolean;
}

function fixQrUrl(url: string | null, path: string | null): string | null {
  // Prefer building from path using API host (works for LAN IP 192.168.x.x)
  if (path) {
    const base = API_BASE_URL.replace('/api/v1', '');
    return `${base}/storage/${path.replace(/^\//, '')}`;
  }
  if (url && url.includes('localhost')) {
    const base = API_BASE_URL.replace('/api/v1', '');
    const idx = url.indexOf('/storage/');
    if (idx !== -1) return base + url.substring(idx);
  }
  return url;
}

function fixSettingsUrls(data: VendorPaymentSettings): VendorPaymentSettings {
  return {
    ...data,
    gcash_qr_url: fixQrUrl(data.gcash_qr_url, data.gcash_qr_path),
    maya_qr_url: fixQrUrl(data.maya_qr_url, data.maya_qr_path),
  };
}

export async function getPaymentSettings(token: string): Promise<VendorPaymentSettings> {
  const response = await api.request<VendorPaymentSettings>('/vendor/payment-settings', {
    method: 'GET',
    token,
  });
  return fixSettingsUrls(response.data);
}

export interface UpdatePaymentSettingsParams {
  gcash_number?: string | null;
  maya_number?: string | null;
  gcash_qr_uri?: string | null; // local file uri from expo-image-picker
  maya_qr_uri?: string | null;
  remove_gcash_qr?: boolean;
  remove_maya_qr?: boolean;
}

export async function updatePaymentSettings(
  token: string,
  params: UpdatePaymentSettingsParams,
): Promise<VendorPaymentSettings> {
  const hasFile = !!params.gcash_qr_uri || !!params.maya_qr_uri;

  if (hasFile) {
    const formData = new FormData();

    // Numbers — send empty string to clear; send actual value to update
    if (params.gcash_number !== undefined) {
      formData.append('gcash_number', params.gcash_number ?? '');
    }
    if (params.maya_number !== undefined) {
      formData.append('maya_number', params.maya_number ?? '');
    }

    if (params.remove_gcash_qr) formData.append('remove_gcash_qr', '1');
    if (params.remove_maya_qr) formData.append('remove_maya_qr', '1');

    function appendImage(uri: string, field: string) {
      const filename = uri.split('/').pop() ?? `${field}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      // React Native FormData file shape — must be cast as Blob for XHR
      formData.append(field, {
        uri,
        name: filename,
        type,
      } as unknown as Blob);
    }

    if (params.gcash_qr_uri) appendImage(params.gcash_qr_uri, 'gcash_qr');
    if (params.maya_qr_uri) appendImage(params.maya_qr_uri, 'maya_qr');

    // Use XMLHttpRequest for reliable multipart upload on Android (fetch + FormData with file object fails with undici)
    return new Promise<VendorPaymentSettings>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/vendor/payment-settings`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 30000;

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            // api returns {status, message, data}
            resolve(fixSettingsUrls(res.data as VendorPaymentSettings));
          } else {
            const message = res.message || 'Failed to update payment settings';
            // Include validation errors if present
            let fullMessage = message;
            if (res.errors && typeof res.errors === 'object') {
              const errs = Object.values(res.errors as Record<string, string[]>).flat().join('\n');
              if (errs) fullMessage = errs;
            }
            reject(new ApiError(fullMessage, xhr.status, res));
          }
        } catch {
          reject(new ApiError(`Invalid response: ${xhr.responseText.substring(0, 100)}`, xhr.status));
        }
      };

      xhr.onerror = () => reject(new ApiError('Network request failed. Check your connection.', 0));
      xhr.ontimeout = () => reject(new ApiError('Request timed out. Try again.', 0));

      xhr.send(formData);
    });
  }

  // JSON path — numbers only
  const body: Record<string, unknown> = {};
  if (params.gcash_number !== undefined) body.gcash_number = params.gcash_number ?? '';
  if (params.maya_number !== undefined) body.maya_number = params.maya_number ?? '';
  if (params.remove_gcash_qr) body.remove_gcash_qr = true;
  if (params.remove_maya_qr) body.remove_maya_qr = true;

  const response = await api.request<VendorPaymentSettings>('/vendor/payment-settings', {
    method: 'PUT',
    body,
    token,
  });
  return fixSettingsUrls(response.data);
}
