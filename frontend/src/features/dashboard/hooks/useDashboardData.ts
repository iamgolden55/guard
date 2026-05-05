// Dashboard data layer.
//
// Single TanStack Query against /api/v1/admin/dashboard/overview/ which
// aggregates KPIs, pending approvals, venue coverage, SIA compliance,
// live activity, staff roster, and a 7×24 heatmap server-side.
//
// resolveApproval routes by id prefix:
//   "leave:42"        → leaveService.approveLeaveRequest / rejectLeaveRequest
//   "recruitment:7"   → recruitmentService.approveApplication / rejectApplication
//   "shift:101"       → shifts require manager signature → not done in-place;
//                       caller should navigate to /scheduling.
//
// Optimistic mutation snapshots the current overview cache and removes the
// row instantly; rolls back on error. Pattern from useRecruitmentData.ts.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leaveService } from "../../../services";
import {
  type DashboardOverviewResponse,
  dashboardService,
} from "../../../services/dashboardService";
import { recruitmentService } from "../../../services/recruitmentService";
import type {
  DashboardActivity,
  DashboardApproval,
  DashboardStaff,
  DashboardVenue,
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
  expiringLicensesCount: number;
  /** Canonical pending-approvals count from the open_approvals KPI.
   * Use this for headline numbers; `approvals.length` is just the
   * displayed top-N. */
  openApprovalsCount: number;
  isLoading: boolean;
  error: Error | null;
  /** Approve or deny an approval. Routes by id prefix; shifts open the
   * scheduling page rather than approving in-place (signature required). */
  resolveApproval: (id: string, action: "approve" | "deny") => void;
}

const OVERVIEW_KEY = ["dashboard", "overview"] as const;

const EMPTY_OVERVIEW: DashboardOverviewResponse = {
  kpis: {
    officers_on_shift: { value: 0, delta: "", delta_dir: "neutral", spark: [] },
    hours_delivered_today: {
      value: 0,
      delta: "",
      delta_dir: "neutral",
      spark: [],
    },
    open_approvals: { value: 0, delta: "", delta_dir: "neutral", spark: [] },
    revenue_this_week: { value: 0, delta: "", delta_dir: "neutral", spark: [] },
  },
  pending_approvals: [],
  venue_coverage: [],
  sia_compliance: { valid: 0, expiring_soon: 0, expired: 0, expiring_list: [] },
  live_activity: [],
  staff_roster: [],
  coverage_heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)),
};

function formatNumber(n: number, currency = false): string {
  if (currency) {
    return `£${Math.round(n).toLocaleString("en-GB")}`;
  }
  return Math.round(n).toLocaleString("en-GB");
}

function toKpis(overview: DashboardOverviewResponse): DashboardKpi[] {
  const k = overview.kpis;
  return [
    {
      label: "Officers on shift",
      value: formatNumber(k.officers_on_shift.value),
      delta: k.officers_on_shift.delta || undefined,
      deltaDir: k.officers_on_shift.delta_dir,
      sparkData: k.officers_on_shift.spark,
    },
    {
      label: "Hours delivered today",
      value: formatNumber(k.hours_delivered_today.value),
      delta: k.hours_delivered_today.delta || undefined,
      deltaDir: k.hours_delivered_today.delta_dir,
      sparkData: k.hours_delivered_today.spark,
    },
    {
      label: "Open approvals",
      value: formatNumber(k.open_approvals.value),
      delta: k.open_approvals.delta || undefined,
      deltaDir: k.open_approvals.delta_dir,
      sparkData: k.open_approvals.spark,
    },
    {
      label: "Revenue this wk",
      value: formatNumber(k.revenue_this_week.value, true),
      delta: k.revenue_this_week.delta || undefined,
      deltaDir: k.revenue_this_week.delta_dir,
      sparkData: k.revenue_this_week.spark,
    },
  ];
}

function toStaff(overview: DashboardOverviewResponse): DashboardStaff[] {
  return overview.staff_roster.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    venue: s.venue,
    status: s.status,
    license: s.license,
    expiresIn: s.expiresIn,
    hours: s.hours,
    rating: 0, // Backend doesn't track ratings; column hidden in StaffTable.
    avatarHue: s.avatarHue,
  }));
}

function toVenues(overview: DashboardOverviewResponse): DashboardVenue[] {
  return overview.venue_coverage.map((v) => ({
    name: v.name,
    staffed: v.staffed,
    required: v.required,
    coverage: v.coverage,
    incidents: v.incidents,
  }));
}

function parseApprovalId(
  id: string,
): { source: string; sourceId: number } | null {
  const idx = id.indexOf(":");
  if (idx < 0) return null;
  const source = id.slice(0, idx);
  const sourceId = Number(id.slice(idx + 1));
  if (!Number.isFinite(sourceId)) return null;
  return { source, sourceId };
}

export function useDashboardData(): UseDashboardDataResult {
  const queryClient = useQueryClient();

  const overviewQuery = useQuery<DashboardOverviewResponse>({
    queryKey: OVERVIEW_KEY,
    queryFn: dashboardService.getOverview,
    staleTime: 30 * 1000,
  });

  const overview = overviewQuery.data ?? EMPTY_OVERVIEW;

  const resolveMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "approve" | "deny";
    }) => {
      const parsed = parseApprovalId(id);
      if (!parsed) throw new Error(`Invalid approval id: ${id}`);
      const { source, sourceId } = parsed;

      if (source === "leave") {
        return action === "approve"
          ? leaveService.approveLeaveRequest(sourceId)
          : leaveService.rejectLeaveRequest(
              sourceId,
              "Rejected from dashboard",
            );
      }
      if (source === "recruitment") {
        return action === "approve"
          ? recruitmentService.approveApplication(sourceId)
          : recruitmentService.rejectApplication(
              sourceId,
              "Rejected from dashboard",
            );
      }
      if (source === "shift") {
        // Shift approval requires manager signature — surface to scheduling.
        throw new Error(
          "Shift approvals require a manager signature. Open Scheduling to approve.",
        );
      }
      throw new Error(`Unknown approval source: ${source}`);
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: OVERVIEW_KEY });
      const snapshot =
        queryClient.getQueryData<DashboardOverviewResponse>(OVERVIEW_KEY);
      queryClient.setQueryData<DashboardOverviewResponse>(
        OVERVIEW_KEY,
        (curr) => {
          if (!curr) return curr;
          return {
            ...curr,
            pending_approvals: curr.pending_approvals.filter(
              (a) => a.id !== id,
            ),
          };
        },
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(OVERVIEW_KEY, ctx.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
  });

  return {
    kpis: toKpis(overview),
    staff: toStaff(overview),
    venues: toVenues(overview),
    approvals: overview.pending_approvals,
    activity: overview.live_activity,
    heatmap: overview.coverage_heatmap,
    expiringLicensesCount: overview.sia_compliance.expiring_soon,
    openApprovalsCount: overview.kpis.open_approvals.value,
    isLoading: overviewQuery.isLoading,
    error: overviewQuery.error as Error | null,
    resolveApproval: (id, action) => resolveMutation.mutate({ id, action }),
  };
}
