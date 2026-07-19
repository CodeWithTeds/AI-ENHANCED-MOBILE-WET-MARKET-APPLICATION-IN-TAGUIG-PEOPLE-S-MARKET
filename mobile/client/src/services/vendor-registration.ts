/**
 * Vendor Registration Service — handles API calls for the registration flow.
 */

import { api } from './api';
import type {
  VendorRegistrationData,
  VendorRegistrationResponse,
} from '@/types/vendor';

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
  formData.append('stall_location', data.business.stallLocation);
  data.business.productCategories.forEach((cat, index) => {
    formData.append(`product_categories[${index}]`, cat);
  });

  // Documents
  if (data.documents.businessPermit) {
    formData.append('business_permit', {
      uri: data.documents.businessPermit.uri,
      name: data.documents.businessPermit.name,
      type: data.documents.businessPermit.type,
    } as unknown as Blob);
  }

  if (data.documents.stallLease) {
    formData.append('stall_lease', {
      uri: data.documents.stallLease.uri,
      name: data.documents.stallLease.name,
      type: data.documents.stallLease.type,
    } as unknown as Blob);
  }

  if (data.documents.validId) {
    formData.append('valid_id', {
      uri: data.documents.validId.uri,
      name: data.documents.validId.name,
      type: data.documents.validId.type,
    } as unknown as Blob);
  }

  const response = await api.request<VendorRegistrationResponse['data']>(
    '/vendor/register',
    {
      method: 'POST',
      body: formData,
      isFormData: true,
    }
  );

  return response as unknown as VendorRegistrationResponse;
}

export async function getVendorStatus(token: string) {
  return api.request('/vendor/status', {
    method: 'GET',
    token,
  });
}
