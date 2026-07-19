/**
 * Vendor Registration Service — handles API calls for the registration flow.
 */

import { api, ApiError } from './api';
import type {
  Section,
  StallOption,
  VendorRegistrationData,
  VendorRegistrationResponse,
} from '@/types/vendor';

/**
 * Fetch all active sections from the database.
 */
export async function fetchSections(): Promise<Section[]> {
  const response = await api.request<Section[]>('/sections', { method: 'GET' });
  return response.data;
}

/**
 * Fetch vacant stalls, optionally filtered by section_id.
 */
export async function fetchVacantStalls(sectionId?: number): Promise<StallOption[]> {
  const endpoint = sectionId
    ? `/stalls/vacant?section_id=${sectionId}`
    : '/stalls/vacant';
  const response = await api.request<StallOption[]>(endpoint, { method: 'GET' });
  return response.data;
}

/**
 * Register a new vendor with all form data and documents.
 * Uses XMLHttpRequest for reliable file uploads on Android.
 */
export async function registerVendor(
  data: VendorRegistrationData
): Promise<VendorRegistrationResponse> {
  const formData = new FormData();

  // Personal info
  formData.append('full_name', data.personal.fullName);
  if (data.personal.email) {
    formData.append('email', data.personal.email);
  }
  formData.append('phone', data.personal.phone);
  formData.append('password', data.personal.password);

  // Business info
  formData.append('stall_name', data.business.stallName);
  if (data.business.stallId) {
    formData.append('stall_id', String(data.business.stallId));
  }
  data.business.productCategories.forEach((cat, index) => {
    formData.append(`product_categories[${index}]`, cat);
  });

  // Documents — React Native FormData requires {uri, name, type} objects
  if (data.documents.businessPermit) {
    const doc = data.documents.businessPermit;
    formData.append('business_permit', {
      uri: doc.uri,
      name: doc.name,
      type: doc.type,
    } as unknown as Blob);
  }

  if (data.documents.stallLease) {
    const doc = data.documents.stallLease;
    formData.append('stall_lease', {
      uri: doc.uri,
      name: doc.name,
      type: doc.type,
    } as unknown as Blob);
  }

  if (data.documents.validId) {
    const doc = data.documents.validId;
    formData.append('valid_id', {
      uri: doc.uri,
      name: doc.name,
      type: doc.type,
    } as unknown as Blob);
  }

  // Use XMLHttpRequest for reliable multipart uploads on Android
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `http://192.168.1.12:8080/api/v1/vendor/register`;

    xhr.open('POST', url);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response);
        } else {
          reject(new ApiError(
            response.message || 'Registration failed',
            xhr.status,
            response
          ));
        }
      } catch {
        reject(new ApiError(`Invalid response: ${xhr.responseText.substring(0, 100)}`, xhr.status));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError('Network request failed. Check your connection.', 0));
    };

    xhr.ontimeout = () => {
      reject(new ApiError('Request timed out. Try again.', 0));
    };

    xhr.timeout = 60000; // 60 seconds for file upload

    xhr.send(formData);
  });
}

/**
 * Get vendor status for authenticated user.
 */
export async function getVendorStatus(token: string) {
  return api.request('/vendor/status', {
    method: 'GET',
    token,
  });
}
