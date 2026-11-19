/**
 * Vendor Stall Lease Contract Service
 * Handles fetching contract details, expiration status, and submitting Renewal or Cancellation requests.
 */

import { api } from './api';

export interface VendorContractDetails {
  vendor_id: number;
  stall_name: string;
  stall_location: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_duration_months: number;
  contract_status: 'active' | 'expiring_soon' | 'expired' | 'renewal_requested' | 'cancellation_requested' | 'cancelled' | string;
  days_until_expiration: number | null;
  is_expiring_soon: boolean;
  is_expired: boolean;
  latest_request: {
    id: number;
    type: 'renewal' | 'cancellation';
    requested_duration_months: number | null;
    status: 'pending' | 'approved' | 'rejected';
    reason: string | null;
    admin_notes: string | null;
    created_at: string;
    reviewed_at: string | null;
  } | null;
}

export interface SubmitContractRequestPayload {
  type: 'renewal' | 'cancellation';
  duration_months?: 1 | 3 | 6 | 12;
  reason?: string;
}

export async function getVendorContractDetails(token: string): Promise<VendorContractDetails> {
  const res = await api.request<VendorContractDetails>('/vendor/contract', {
    method: 'GET',
    token,
  });
  return res.data;
}

export async function submitVendorContractRequest(
  token: string,
  payload: SubmitContractRequestPayload
): Promise<any> {
  const res = await api.request('/vendor/contract/request', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
    token,
  });
  return res.data;
}
