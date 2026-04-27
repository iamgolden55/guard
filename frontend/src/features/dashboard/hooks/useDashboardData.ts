// Dashboard data layer.
//
// Phase 3 ships with mock data so the visual port can be reviewed
// side-by-side against project/Dashboard.html. Each section is structured
// as a discrete slice that gets swapped to a real TanStack Query call
// in a follow-up pass — see the TODO blocks. The shape returned here is
// the contract DashboardPage relies on, so swapping mock → real is a
// one-file change per section.
import { useState } from "react";
import {
  MOCK_ACTIVITY,
  MOCK_APPROVALS,
  MOCK_HEATMAP,
  MOCK_HOURS_SERIES,
  MOCK_STAFF,
  MOCK_VENUES,
  type DashboardActivity,
  type DashboardApproval,
  type DashboardStaff,
  type DashboardVenue,
} from "../data/mocks";

export interface DashboardKpi {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: "up" | "down" | "neutral";
  sparkData?: number[];
}

export interface UseDashboardDataResult {
  kpis: DashboardKpi[];
  staff: DashboardStaff[];
  venues: DashboardVenue[];
  approvals: DashboardApproval[];
  activity: DashboardActivity[];
  heatmap: number[][];
  /** Resolve an approval (optimistic; mock implementation removes from the list). */
  resolveApproval: (id: number, action: "approve" | "deny") => void;
  /** True when any section is still using mock data. Drives a dev-only banner. */
  isMockData: boolean;
}

export function useDashboardData(): UseDashboardDataResult {
  // TODO(Phase 3.5 — wire real services, slice by slice):
  //   shiftService.getShifts({ status: "in_progress" }).length → KPI "Officers on shift"
  //   sum(shift.actual_hours) for today → KPI "Hours delivered today"
  //   shiftService.getPendingApprovals() ∪ leaveService.getPendingRequests() → approvals + KPI "Open approvals"
  //   invoiceService.getCurrentRunTotal() → KPI "Revenue this wk"
  //   userService.getStaff() + active-shift cross-ref → staff[]
  //   venueService.getVenues() + per-venue staffed counts → venues[]
  //   derive heatmap from getShifts({ start__gte: 7daysAgo, status: "completed" })
  //   activity feed: investigate /api/v1/activity/; if absent, ship a recent-shifts MVP

  const [approvals, setApprovals] = useState<DashboardApproval[]>(MOCK_APPROVALS);

  const resolveApproval = (id: number, _action: "approve" | "deny") => {
    setApprovals((curr) => curr.filter((a) => a.id !== id));
  };

  const kpis: DashboardKpi[] = [
    { label: "Officers on shift", value: "127", delta: "+12", deltaDir: "up", sparkData: MOCK_HOURS_SERIES },
    { label: "Hours delivered today", value: "1,084", delta: "+4.2%", deltaDir: "up", sparkData: MOCK_HOURS_SERIES.slice(2) },
    { label: "Open approvals", value: "14", delta: "3 urgent", deltaDir: "neutral", sparkData: [4, 6, 9, 8, 11, 13, 14] },
    { label: "Revenue this wk", value: "£84,210", delta: "-1.8%", deltaDir: "down", sparkData: [84, 79, 82, 88, 79, 82, 84] },
  ];

  return {
    kpis,
    staff: MOCK_STAFF,
    venues: MOCK_VENUES,
    approvals,
    activity: MOCK_ACTIVITY,
    heatmap: MOCK_HEATMAP,
    resolveApproval,
    isMockData: true,
  };
}
