// @ts-nocheck — depends on src/pages/admin/scheduler/types not yet ported. Address in Phase 7 (Scheduling).
import api from './api';
import type {
  ResourceTimelineResponse,
  ValidationResult,
  BulkUpdateRequest,
  BulkUpdateResponse,
  PublishRequest,
  PublishResponse,
  ScheduleHealth,
} from '../pages/admin/scheduler/types/scheduler';

const BASE = '/api/v1/shifts';

export interface TimelineParams {
  start: string;
  end: string;
  group_by?: 'staff' | 'venue';
  venue_ids?: number[];
  staff_ids?: number[];
  roles?: string[];
  status?: string;
}

export interface ValidateParams {
  staff_user?: number | null;
  venue?: number;
  start_time: string;
  end_time: string;
  required_security_role?: string;
  exclude_shift_id?: number | null;
}

export interface CreateShiftParams {
  venue: number;
  staff_user?: number | null;
  start_time: string;
  end_time: string;
  break_duration?: number;
  required_security_role?: string;
  hourly_rate?: string;
  bill_rate?: string;
  notes?: string;
  status?: string;
  is_published?: boolean;
}

export interface BulkCreateRecurrencePayload {
  mode: 'recurrence';
  venue: number;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  officers_needed: number;
  staff_users?: number[];
  required_security_role?: string;
  hourly_rate?: string;
  bill_rate?: string;
  notes?: string;
  is_special_event?: boolean;
  allow_past_dates?: boolean;
  is_published?: boolean;
  send_notifications?: boolean;
}

export interface BulkCreateExplicitShift {
  venue: number;
  start_time: string;
  end_time: string;
  staff_users?: number[];
  officers_needed?: number;
  required_security_role?: string;
  hourly_rate?: string;
  bill_rate?: string;
  notes?: string;
  is_special_event?: boolean;
}

export interface BulkCreateExplicitPayload {
  mode: 'explicit';
  shifts: BulkCreateExplicitShift[];
  is_published?: boolean;
  send_notifications?: boolean;
  allow_past_dates?: boolean;
}

export type BulkCreatePayload =
  | BulkCreateRecurrencePayload
  | BulkCreateExplicitPayload;

export type BulkCreateSlotStatus = 'ok' | 'conflict' | 'open';

export interface BulkCreatePreviewSlot {
  staff_user: number | null;
  status: BulkCreateSlotStatus;
  reason?: string;
}

export interface BulkCreatePreviewShift {
  date: string;
  start: string;
  end: string;
  preview_group_id: string;
  slots: BulkCreatePreviewSlot[];
}

export interface BulkCreatePreviewSummary {
  to_create: number;
  assigned_slots: number;
  conflict_slots: number;
  open_slots: number;
}

export interface BulkCreatePreviewResponse {
  preview: true;
  summary: BulkCreatePreviewSummary;
  shifts: BulkCreatePreviewShift[];
}

export interface BulkCreateCommittedShift {
  id: number;
  shift_group: string;
  staff_user: number | null;
  venue: number;
  start_time: string;
  end_time: string;
  status: string;
}

export interface BulkCreateCommitResponse {
  preview: false;
  created: number;
  skipped_assignments: number;
  shift_groups: string[];
  shifts: BulkCreateCommittedShift[];
}

export type BulkCreateResponse = BulkCreatePreviewResponse | BulkCreateCommitResponse;

const schedulerService = {
  async getResourceTimeline(params: TimelineParams): Promise<ResourceTimelineResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('start', params.start);
    searchParams.set('end', params.end);
    if (params.group_by) searchParams.set('group_by', params.group_by);
    if (params.status) searchParams.set('status', params.status);
    params.venue_ids?.forEach((id) => searchParams.append('venue_ids[]', String(id)));
    params.staff_ids?.forEach((id) => searchParams.append('staff_ids[]', String(id)));
    params.roles?.forEach((r) => searchParams.append('roles[]', r));

    const { data } = await api.get<ResourceTimelineResponse>(
      `${BASE}/resource_timeline/?${searchParams.toString()}`
    );
    return data;
  },

  async validateShift(params: ValidateParams): Promise<ValidationResult> {
    const { data } = await api.post<ValidationResult>(`${BASE}/validate/`, params);
    return data;
  },

  async createShift(params: CreateShiftParams): Promise<unknown> {
    const { data } = await api.post(`${BASE}/`, params);
    return data;
  },

  bulkCreateShifts<P extends boolean = false>(
    payload: BulkCreatePayload,
    options: { preview?: P } = {},
  ): Promise<P extends true ? BulkCreatePreviewResponse : BulkCreateCommitResponse> {
    const qs = options.preview ? '?preview=true' : '';
    return api
      .post<BulkCreateResponse>(`${BASE}/bulk_create/${qs}`, payload)
      .then((res) => res.data as P extends true ? BulkCreatePreviewResponse : BulkCreateCommitResponse);
  },

  async updateShift(id: number, params: Partial<CreateShiftParams>): Promise<unknown> {
    const { data } = await api.patch(`${BASE}/${id}/`, params);
    return data;
  },

  async deleteShift(id: number): Promise<void> {
    await api.delete(`${BASE}/${id}/`);
  },

  async bulkUpdateShifts(request: BulkUpdateRequest): Promise<BulkUpdateResponse> {
    const { data } = await api.patch<BulkUpdateResponse>(`${BASE}/bulk_update/`, request);
    return data;
  },

  async publishShifts(request: PublishRequest): Promise<PublishResponse> {
    const { data } = await api.post<PublishResponse>(`${BASE}/publish/`, request);
    return data;
  },

  async getScheduleHealth(params: { start: string; end: string; venue_ids?: number[] }): Promise<ScheduleHealth> {
    const searchParams = new URLSearchParams();
    searchParams.set('start', params.start);
    searchParams.set('end', params.end);
    params.venue_ids?.forEach((id) => searchParams.append('venue_ids[]', String(id)));

    const { data } = await api.get<ScheduleHealth>(
      `${BASE}/schedule_health/?${searchParams.toString()}`
    );
    return data;
  },
};

export default schedulerService;
