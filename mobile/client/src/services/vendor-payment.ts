/**
 * Vendor Payment Settings Service — GCash / Maya numbers + QR codes.
 */

import { api } from './api';

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

export async function getPaymentSettings(token: string): Promise<VendorPaymentSettings> {
  const response = await api.request<VendorPaymentSettings>('/vendor/payment-settings', {
    method: 'GET',
    token,
  });
  return response.data;
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
      // @ts-ignore — React Native FormData file shape
      formData.append(field, { uri, name: filename, type } as any);
    }

    if (params.gcash_qr_uri) appendImage(params.gcash_qr_uri, 'gcash_qr');
    if (params.maya_qr_uri) appendImage(params.maya_qr_uri, 'maya_qr');

    const response = await api.request<VendorPaymentSettings>('/vendor/payment-settings', {
      method: 'POST',
      body: formData,
      token,
      isFormData: true,
    });
    return response.data;
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
  return response.data;
}
