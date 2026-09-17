/**
 * Customer ID Verification Service — upload ID picture for verification.
 */
import { api, ApiError } from './api';
import { API_BASE_URL } from '@/config/api';

export const ID_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'Passport' },
  { value: 'umid', label: 'UMID' },
  { value: 'philhealth', label: 'PhilHealth ID' },
  { value: 'sss', label: 'SSS ID' },
  { value: 'voters_id', label: "Voter's ID" },
  { value: 'postal_id', label: 'Postal ID' },
  { value: 'student_id', label: 'Student ID' },
  { value: 'other', label: 'Other' },
] as const;

export type IdType = (typeof ID_TYPES)[number]['value'];

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface CustomerVerification {
  id: number;
  user_id: number;
  id_type: IdType | null;
  id_image_path: string | null;
  id_image_url: string | null;
  status: VerificationStatus;
  rejection_reason: string | null;
  verified_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fixImageUrl(url: string | null, path: string | null): string | null {
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

function fixVerification(data: CustomerVerification): CustomerVerification {
  return {
    ...data,
    id_image_url: fixImageUrl(data.id_image_url, data.id_image_path),
  };
}

export async function getCustomerVerification(token: string): Promise<CustomerVerification> {
  const response = await api.request<CustomerVerification>('/profile/verification', {
    method: 'GET',
    token,
  });
  return fixVerification(response.data);
}

export interface UploadVerificationParams {
  id_type: IdType;
  id_image_uri: string; // local uri from expo-image-picker
}

export async function uploadCustomerVerification(
  token: string,
  params: UploadVerificationParams,
): Promise<CustomerVerification> {
  const formData = new FormData();
  formData.append('id_type', params.id_type);

  const filename = params.id_image_uri.split('/').pop() ?? 'id_image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  formData.append('id_image', {
    uri: params.id_image_uri,
    name: filename,
    type,
  } as unknown as Blob);

  return new Promise<CustomerVerification>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/profile/verification`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 30000;

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(fixVerification(res.data as CustomerVerification));
        } else {
          const message = res.message || 'Failed to upload ID';
          let fullMessage = message;
          if (res.errors && typeof res.errors === 'object') {
            const errs = Object.values(res.errors as Record<string, string[]>).flat().join('\n');
            if (errs) fullMessage = errs;
          }
          reject(new ApiError(fullMessage, xhr.status, res));
        }
      } catch {
        reject(new ApiError(`Invalid response: ${xhr.responseText.substring(0, 150)}`, xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError('Network request failed. Check your connection.', 0));
    xhr.ontimeout = () => reject(new ApiError('Request timed out. Try again.', 0));

    xhr.send(formData);
  });
}

export async function deleteCustomerVerification(token: string): Promise<CustomerVerification> {
  const response = await api.request<CustomerVerification>('/profile/verification', {
    method: 'DELETE',
    token,
  });
  return fixVerification(response.data);
}

export function statusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'pending':
      return 'Pending Review';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Not Verified';
  }
}

export function statusColor(status: VerificationStatus): string {
  switch (status) {
    case 'verified':
      return '#10B981';
    case 'pending':
      return '#F59E0B';
    case 'rejected':
      return '#EF4444';
    default:
      return '#6B7280';
  }
}
