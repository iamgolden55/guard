// IncidentService — wraps /api/v1/incidents/.
//
// IncidentReport currently exposed by `IncidentReportSerializer` (see
// backend/api/serializers.py:2865). Mobile-only fields added in migration
// 0035 (incident_type, status, photos, gps, voice_note, witnesses, police
// reference, ambulance_called, etc.) are NOT serialized yet — the admin
// drawer surfaces a notice listing the gap rather than reading them blind.

import { api } from "./index";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface IncidentReport {
  id: number;
  venue: number | null;
  venue_name: string | null;
  reported_by: number;
  reported_by_name: string;
  shift: number | null;
  incident_time: string;
  description: string;
  severity: IncidentSeverity;
  actions_taken: string;
  requires_followup: boolean;
  followup_notes: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: number | null;
  resolved_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentListParams {
  resolved?: boolean;
  venue?: number;
  severity?: IncidentSeverity;
}

export interface IncidentResolvePayload {
  followup_notes?: string;
  requires_followup?: boolean;
}

const BASE = "/api/v1/incidents";

function unwrapList(data: unknown): IncidentReport[] {
  if (Array.isArray(data)) return data as IncidentReport[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as IncidentReport[];
    if (Array.isArray(obj.data)) return obj.data as IncidentReport[];
  }
  return [];
}

export const incidentService = {
  async list(params: IncidentListParams = {}): Promise<IncidentReport[]> {
    const response = await api.get(`${BASE}/`, { params });
    return unwrapList(response.data);
  },

  async retrieve(id: number): Promise<IncidentReport> {
    const response = await api.get(`${BASE}/${id}/`);
    return response.data as IncidentReport;
  },

  async resolve(
    id: number,
    payload: IncidentResolvePayload = {},
  ): Promise<IncidentReport> {
    const response = await api.post(`${BASE}/${id}/resolve/`, payload);
    return response.data as IncidentReport;
  },
};

export default incidentService;
