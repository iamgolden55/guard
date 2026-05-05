// Compliance admin data layer — TanStack Query against ComplianceService.
//
// Reads
//   ["compliance","dashboard"]                getDashboardMetrics()
//   ["compliance","violations", filters]      getViolations(filters)
//   ["compliance","metrics", params]          getMetrics(params)
//   ["compliance","profiles"]                 getAllProfiles()
//
// Writes (optimistic over cached violations + profiles lists)
//   resolveViolation     — flip resolution_status to 'resolved'
//   setActiveProfile     — flip is_active across the profile list
//   upsertProfile        — create or update; non-optimistic, invalidate on settle
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ComplianceService } from "../../../services/complianceService";
import type {
  ComplianceDashboardMetrics,
  ComplianceMetrics,
  ComplianceProfile,
  ComplianceViolation,
  MetricsParams,
  PaginatedResponse,
  ViolationFilters,
  ViolationResolution,
} from "../../../types/compliance";

const VIOLATIONS_KEY_BASE = ["compliance", "violations"] as const;
const PROFILES_KEY = ["compliance", "profiles"] as const;
const DASHBOARD_KEY = ["compliance", "dashboard"] as const;

function patchViolationInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number,
  patch: Partial<ComplianceViolation>,
) {
  const queries = queryClient.getQueriesData<
    PaginatedResponse<ComplianceViolation> | undefined
  >({
    queryKey: VIOLATIONS_KEY_BASE,
  });
  for (const [key, page] of queries) {
    if (!page || !Array.isArray(page.results)) continue;
    queryClient.setQueryData<PaginatedResponse<ComplianceViolation>>(key, {
      ...page,
      results: page.results.map((v) =>
        v.id === id ? ({ ...v, ...patch } as ComplianceViolation) : v,
      ),
    });
  }
}

function snapshotViolations(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.getQueriesData<PaginatedResponse<ComplianceViolation>>({
    queryKey: VIOLATIONS_KEY_BASE,
  });
}

function restoreViolations(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: ReturnType<typeof snapshotViolations>,
) {
  for (const [key, value] of snapshot) {
    queryClient.setQueryData(key, value);
  }
}

function setProfileActiveInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  activeId: number,
) {
  const profiles = queryClient.getQueryData<
    PaginatedResponse<ComplianceProfile> | undefined
  >(PROFILES_KEY);
  if (!profiles?.results) return;
  queryClient.setQueryData<PaginatedResponse<ComplianceProfile>>(PROFILES_KEY, {
    ...profiles,
    results: profiles.results.map((p) => ({
      ...p,
      is_active: p.id === activeId,
    })),
  });
}

export interface UseComplianceDataOptions {
  violationFilters?: ViolationFilters;
  metricsParams?: MetricsParams;
}

export function useComplianceData({
  violationFilters,
  metricsParams,
}: UseComplianceDataOptions = {}) {
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery<ComplianceDashboardMetrics | null>({
    queryKey: DASHBOARD_KEY,
    queryFn: async () => {
      const res = await ComplianceService.getDashboardMetrics();
      return res.data ?? null;
    },
    staleTime: 30_000,
  });

  const violationsQuery = useQuery<PaginatedResponse<ComplianceViolation>>({
    queryKey: [...VIOLATIONS_KEY_BASE, violationFilters ?? {}],
    queryFn: () => ComplianceService.getViolations(violationFilters ?? {}),
  });

  const metricsQuery = useQuery<PaginatedResponse<ComplianceMetrics>>({
    queryKey: ["compliance", "metrics", metricsParams ?? {}],
    queryFn: () => ComplianceService.getMetrics(metricsParams ?? {}),
  });

  const profilesQuery = useQuery<PaginatedResponse<ComplianceProfile>>({
    queryKey: PROFILES_KEY,
    queryFn: () => ComplianceService.getAllProfiles(),
  });

  // ── Resolve violation ────────────────────────────────────────────────────
  const resolveViolation = useMutation({
    mutationFn: ({
      id,
      resolution,
    }: {
      id: number;
      resolution: ViolationResolution;
    }) => ComplianceService.resolveViolation(id, resolution),
    onMutate: async ({ id, resolution }) => {
      await queryClient.cancelQueries({ queryKey: VIOLATIONS_KEY_BASE });
      const snapshot = snapshotViolations(queryClient);
      patchViolationInCaches(queryClient, id, {
        resolution_status: resolution.exception_granted
          ? "resolved"
          : "resolved",
        resolution_status_display: "Resolved",
        resolution_notes: resolution.resolution_notes,
        exception_granted: resolution.exception_granted,
        exception_reason: resolution.exception_reason ?? "",
        is_resolved: true,
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreViolations(queryClient, ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
  });

  // ── Set active profile ───────────────────────────────────────────────────
  const setActiveProfile = useMutation({
    mutationFn: (id: number) => ComplianceService.setActiveProfile(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: PROFILES_KEY });
      const previous = queryClient.getQueryData<
        PaginatedResponse<ComplianceProfile>
      >(PROFILES_KEY);
      setProfileActiveInCache(queryClient, id);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(PROFILES_KEY, ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
  });

  // ── Create or update profile ─────────────────────────────────────────────
  const upsertProfile = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: number;
      payload: Partial<ComplianceProfile>;
    }) =>
      id
        ? ComplianceService.updateProfile(id, payload)
        : ComplianceService.createProfile(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });

  return {
    dashboard: dashboardQuery.data ?? null,
    violations: violationsQuery.data?.results ?? [],
    metrics: metricsQuery.data?.results ?? [],
    profiles: profilesQuery.data?.results ?? [],
    isLoading:
      dashboardQuery.isLoading ||
      violationsQuery.isLoading ||
      metricsQuery.isLoading ||
      profilesQuery.isLoading,
    isViolationsLoading: violationsQuery.isLoading,
    isMetricsLoading: metricsQuery.isLoading,
    isProfilesLoading: profilesQuery.isLoading,
    isDashboardLoading: dashboardQuery.isLoading,
    error:
      dashboardQuery.error ??
      violationsQuery.error ??
      metricsQuery.error ??
      profilesQuery.error,
    resolveViolation,
    setActiveProfile,
    upsertProfile,
  };
}
