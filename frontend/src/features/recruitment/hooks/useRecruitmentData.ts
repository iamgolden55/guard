// Recruitment admin data layer — TanStack Query against recruitmentService +
// companyService.
//
// Reads
//   ["recruitment","applications", filters]  getApplications(filters)
//   ["recruitment","stats"]                  getStats()
//   ["recruitment","company-slug"]           companyService.getCurrentCompanyContext()
//
// Writes (all optimistic over the cached applications list)
//   approveApplication   — flip status to 'approved'
//   rejectApplication    — flip status to 'rejected' (notes required)
//   convertToUser        — no optimistic; server creates a User; toast on success
//
// Every mutation invalidates ["recruitment"] in onSettled so server reality wins.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import companyService from "../../../services/companyService";
import {
  recruitmentService,
  type ApplicationFilters,
  type RecruitmentApplication,
  type RecruitmentStats,
} from "../../../services/recruitmentService";

const APPS_KEY_BASE = ["recruitment", "applications"] as const;
const STATS_KEY = ["recruitment", "stats"] as const;
const COMPANY_KEY = ["recruitment", "company-slug"] as const;

// Defensive normalize — backend may return partial fields. Keep all numbers
// non-negative integers; missing fields fall back to 0.
function normalizeStats(data: unknown): RecruitmentStats {
  const empty: RecruitmentStats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    converted: 0,
    by_employment_type: {},
  };
  if (!data || typeof data !== "object") return empty;
  const obj = data as Partial<RecruitmentStats> & Record<string, unknown>;
  return {
    total: Number(obj.total ?? 0) || 0,
    pending: Number(obj.pending ?? 0) || 0,
    approved: Number(obj.approved ?? 0) || 0,
    rejected: Number(obj.rejected ?? 0) || 0,
    converted: Number(obj.converted ?? 0) || 0,
    by_employment_type:
      obj.by_employment_type && typeof obj.by_employment_type === "object"
        ? (obj.by_employment_type as Record<string, number>)
        : {},
  };
}

function setStatusInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number,
  status: RecruitmentApplication["status"],
) {
  // Patch every applications cache (one per filter combination) by walking
  // the cache. The simplest safe approach: invalidate after; but we still do
  // an optimistic merge over the *current* tab so the row flips instantly.
  const queries = queryClient.getQueriesData<RecruitmentApplication[]>({
    queryKey: APPS_KEY_BASE,
  });
  for (const [key, list] of queries) {
    if (!Array.isArray(list)) continue;
    queryClient.setQueryData<RecruitmentApplication[]>(
      key,
      list.map((a) => (a.id === id ? { ...a, status } : a)),
    );
  }
}

function snapshotAllAppsCaches(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return queryClient.getQueriesData<RecruitmentApplication[]>({
    queryKey: APPS_KEY_BASE,
  });
}

function restoreAppsCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: ReturnType<typeof snapshotAllAppsCaches>,
) {
  for (const [key, value] of snapshot) {
    queryClient.setQueryData(key, value);
  }
}

export interface UseRecruitmentDataOptions {
  filters: ApplicationFilters;
}

export function useRecruitmentData({ filters }: UseRecruitmentDataOptions) {
  const queryClient = useQueryClient();

  const applicationsQuery = useQuery<RecruitmentApplication[]>({
    queryKey: [...APPS_KEY_BASE, filters],
    queryFn: () => recruitmentService.getApplications(filters),
  });

  const statsQuery = useQuery<RecruitmentStats>({
    queryKey: STATS_KEY,
    queryFn: async () => {
      const data = (await recruitmentService.getStats()) as unknown;
      return normalizeStats(data);
    },
  });

  const companySlugQuery = useQuery<string | null>({
    queryKey: COMPANY_KEY,
    queryFn: async () => {
      const ctx = await companyService.getCurrentCompanyContext();
      const slug = (ctx as { company?: { slug?: string } } | null)?.company?.slug;
      return slug ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Edit (patch personal/contact fields, etc.) ────────────────────────────
  const updateApplication = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<RecruitmentApplication>;
    }) => recruitmentService.patchApplication(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: APPS_KEY_BASE });
      const snapshot = snapshotAllAppsCaches(queryClient);
      const queries = queryClient.getQueriesData<RecruitmentApplication[]>({
        queryKey: APPS_KEY_BASE,
      });
      for (const [key, list] of queries) {
        if (!Array.isArray(list)) continue;
        queryClient.setQueryData<RecruitmentApplication[]>(
          key,
          list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        );
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreAppsCaches(queryClient, ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
    },
  });

  // ── Approve ───────────────────────────────────────────────────────────────
  const approveApplication = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      recruitmentService.approveApplication(id, notes),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: APPS_KEY_BASE });
      const snapshot = snapshotAllAppsCaches(queryClient);
      setStatusInCache(queryClient, id, "approved");
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreAppsCaches(queryClient, ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
    },
  });

  // ── Reject (notes required) ───────────────────────────────────────────────
  const rejectApplication = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      recruitmentService.rejectApplication(id, notes),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: APPS_KEY_BASE });
      const snapshot = snapshotAllAppsCaches(queryClient);
      setStatusInCache(queryClient, id, "rejected");
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreAppsCaches(queryClient, ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
    },
  });

  // ── Convert to user (non-optimistic — server creates a User) ──────────────
  const convertToUser = useMutation({
    mutationFn: (id: number) => recruitmentService.convertToUser(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
    },
  });

  return {
    applications: applicationsQuery.data ?? [],
    stats: statsQuery.data ?? normalizeStats(undefined),
    companySlug: companySlugQuery.data ?? null,
    isLoading: applicationsQuery.isLoading,
    isStatsLoading: statsQuery.isLoading,
    approveApplication,
    rejectApplication,
    convertToUser,
    updateApplication,
  };
}
