// Capacity logbook service — admin-side reads for the digital capacity-check
// logbook. Logbooks are produced by staff signing off at end-of-shift via the
// mobile app; this service is the admin's read + export window into them.

import api from './api';

export interface PerformedByDetails {
  id: number;
  first_name: string;
  last_name: string;
}

export interface CapacityCheck {
  id: number;
  shift: number;
  shift_group: string | null;
  timestamp: string;
  current_count: number;
  venue_capacity: number;
  is_at_capacity: boolean;
  action_taken: string | null;
  notes: string | null;
  photo_evidence: string | null;
  location: { latitude: number; longitude: number } | null;
  performed_by: number | null;
  performed_by_details: PerformedByDetails | null;
}

export interface CapacityCheckSlotMiss {
  id: number;
  shift_group: string;
  venue: number;
  expected_at: string;
  detected_at: string;
  acknowledged: boolean;
  acknowledged_by: number | null;
  acknowledged_by_details: PerformedByDetails | null;
  acknowledged_at: string | null;
  acknowledgement_reason: string;
}

export interface CapacityLogbookSignoff {
  id: number;
  shift_group: string;
  venue: number;
  venue_name: string;
  venue_capacity: number;
  closed_by_name: string;
  closed_by_role: string;
  signature: string;
  signed_at: string | null;
  override_reason: string;
  is_override: boolean;
  auto_closed: boolean;
  closed_by_staff: number | null;
  closed_by_staff_details: PerformedByDetails | null;
  notes: string;
  total_checks: number;
  total_missed: number;
  created_at: string;
}

/** Live row returned by /capacity-logbooks/active/ — one entry per shift_group. */
export interface ActiveCapacityShift {
  shift_group: string;
  venue_id: number;
  venue_name: string;
  venue_capacity: number;
  interval_minutes: number;
  shift_id: number;
  start_time: string | null;
  end_time: string | null;
  check_in_time: string | null;
  last_check: {
    id: number;
    current_count: number;
    venue_capacity: number;
    is_at_capacity: boolean;
    timestamp: string;
    performed_by_details: PerformedByDetails | null;
  } | null;
  next_due_at: string | null;
  is_overdue: boolean;
  total_checks: number;
  total_missed: number;
}

export interface CapacityLogbookTimeline {
  shift_group: string;
  signoff: CapacityLogbookSignoff | null;
  checks: CapacityCheck[];
  misses: CapacityCheckSlotMiss[];
}

export interface ListLogbookParams {
  venueId?: number;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  search?: string;
}

class CapacityLogbookService {
  /** GET /api/v1/capacity-logbooks/ — paginated list, scoped to the requester's company. */
  async list(params: ListLogbookParams = {}): Promise<CapacityLogbookSignoff[]> {
    const qs = new URLSearchParams();
    if (params.venueId != null) qs.append('venue', String(params.venueId));
    if (params.dateFrom) qs.append('date_from', params.dateFrom);
    if (params.dateTo) qs.append('date_to', params.dateTo);
    const url = `/api/v1/capacity-logbooks/${qs.toString() ? `?${qs.toString()}` : ''}`;
    const response = await api.get<{ results?: CapacityLogbookSignoff[] } | CapacityLogbookSignoff[]>(url);
    // DRF default pagination wraps; non-paginated returns a bare list.
    if (Array.isArray(response.data)) return response.data;
    return response.data.results ?? [];
  }

  /**
   * GET /api/v1/capacity-logbooks/active/ — live view of in-progress
   * monitored shifts in the requester's company.
   */
  async listActive(): Promise<ActiveCapacityShift[]> {
    const response = await api.get<ActiveCapacityShift[]>(
      '/api/v1/capacity-logbooks/active/',
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * GET /api/v1/capacity-logbooks/timeline/?shift_group=… — bundled view
   * (signoff + checks + misses) so the detail drawer needs one round-trip.
   */
  async getTimeline(shiftGroup: string): Promise<CapacityLogbookTimeline> {
    const response = await api.get<CapacityLogbookTimeline>(
      `/api/v1/capacity-logbooks/timeline/?shift_group=${encodeURIComponent(shiftGroup)}`,
    );
    return response.data;
  }

  /**
   * GET /api/v1/capacity-logbooks/{id}/pdf/ — server-rendered audit-ready
   * PDF with the duty manager's signature embedded. Triggers a browser
   * download via the same blob → object URL pattern as billingService.
   */
  async downloadPdf(signoff: CapacityLogbookSignoff): Promise<string> {
    const response = await api.get(`/api/v1/capacity-logbooks/${signoff.id}/pdf/`, {
      responseType: 'blob',
    });
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    // Match the server-side filename convention so users see the same name.
    const dateStr = (signoff.signed_at || signoff.created_at).slice(0, 10);
    const venueSlug = (signoff.venue_name || 'venue')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'venue';
    const filename = `capacity-logbook-${venueSlug}-${dateStr}.pdf`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return filename;
  }

  /** GET /api/v1/capacity-logbooks/export-csv/ — bulk CSV download honouring the same filters. */
  async exportCsv(params: ListLogbookParams = {}): Promise<string> {
    const qs = new URLSearchParams();
    if (params.venueId != null) qs.append('venue', String(params.venueId));
    if (params.dateFrom) qs.append('date_from', params.dateFrom);
    if (params.dateTo) qs.append('date_to', params.dateTo);
    const url = `/api/v1/capacity-logbooks/export-csv/${qs.toString() ? `?${qs.toString()}` : ''}`;

    const response = await api.get(url, { responseType: 'blob' });
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `capacity-logbooks-${today}.csv`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return filename;
  }
}

export const capacityLogbookService = new CapacityLogbookService();
export default capacityLogbookService;
