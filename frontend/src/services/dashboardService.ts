// dashboardService — wraps /api/v1/admin/dashboard/overview/.
//
// Single aggregation endpoint backing the Operations Dashboard. Returns
// KPIs, pending approvals (mixed sources), venue coverage, SIA compliance,
// live activity, staff roster, and a 7×24 coverage heatmap in one round-trip.
//
// Mutations (approve/reject) live on the per-resource services
// (leaveService / recruitmentService / shiftService) — this service is
// read-only.

import { api } from "./index";

export type ApprovalUrgency = "high" | "medium" | "low";
export type ApprovalSource = "leave" | "recruitment" | "shift";
export type ActivityKind =
  | "check-in"
  | "check-out"
  | "incident"
  | "approval"
  | "license"
  | "invoice";
export type RosterStatus = "on-shift" | "break" | "late" | "off-duty";
export type DeltaDir = "up" | "down" | "neutral";

export interface DashboardKpi {
  value: number;
  delta: string;
  delta_dir: DeltaDir;
  spark: number[];
}

export interface DashboardKpis {
  officers_on_shift: DashboardKpi;
  hours_delivered_today: DashboardKpi;
  open_approvals: DashboardKpi;
  revenue_this_week: DashboardKpi;
}

export interface DashboardApproval {
  id: string; // namespaced — "leave:42", "recruitment:7", "shift:101"
  type: string;
  who: string;
  when: string;
  venue: string;
  urgency: ApprovalUrgency;
  source: ApprovalSource;
  source_id: number;
}

export interface DashboardVenueCoverage {
  id: number;
  name: string;
  staffed: number;
  required: number;
  coverage: number;
  incidents: number;
}

export interface DashboardSiaCompliance {
  valid: number;
  expiring_soon: number;
  expired: number;
  expiring_list: Array<{
    user_id: number;
    name: string;
    expiresIn: number;
    license: string;
  }>;
}

export interface DashboardActivity {
  t: string;
  kind: ActivityKind;
  text: string;
}

export interface DashboardRosterEntry {
  id: number;
  name: string;
  role: string;
  venue: string;
  status: RosterStatus;
  license: string;
  expiresIn: number;
  hours: number;
  avatarHue: number;
}

export interface DashboardOverviewResponse {
  kpis: DashboardKpis;
  pending_approvals: DashboardApproval[];
  venue_coverage: DashboardVenueCoverage[];
  sia_compliance: DashboardSiaCompliance;
  live_activity: DashboardActivity[];
  staff_roster: DashboardRosterEntry[];
  coverage_heatmap: number[][];
}

export const dashboardService = {
  async getOverview(): Promise<DashboardOverviewResponse> {
    const response = await api.get<DashboardOverviewResponse>(
      "/api/v1/admin/dashboard/overview/",
    );
    return response.data;
  },
};

export default dashboardService;
