import { api } from './api';

export type StallComplaintType =
  | 'bad_smell'
  | 'cleanliness'
  | 'noise'
  | 'obstruction'
  | 'improper_handling'
  | 'other';

export interface StallComplaintPayload {
  stall_id?: number;
  vendor_id?: number;
  complaint_type: StallComplaintType;
  description: string;
}

export interface StallInfo {
  id: number;
  section_id?: number;
  section: string;
  stall_number: string;
  store_name: string;
  vendor_id?: number | null;
  status: string;
  section_relation?: {
    id: number;
    name: string;
    color?: string | null;
  } | null;
}

export async function fetchAllStalls(): Promise<StallInfo[]> {
  try {
    const res = await api.request<StallInfo[]>('/stalls', { method: 'GET' });
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function submitStallComplaint(
  payload: StallComplaintPayload,
  token?: string | null
): Promise<{ success: boolean; message: string }> {
  const endpoint = payload.stall_id
    ? `/stalls/${payload.stall_id}/complaints`
    : `/vendors/${payload.vendor_id}/complaints`;

  const res = await api.request(endpoint, {
    method: 'POST',
    token: token || undefined,
    body: {
      complaint_type: payload.complaint_type,
      description: payload.description,
    },
  });

  return {
    success: res.status === 'success',
    message: res.message || 'Report submitted successfully to Market Admin.',
  };
}
