// Incidents admin data layer — TanStack Query against incidentService.
//
// Reads
//   ["incidents","list", params]   incidentService.list(params)
//
// Writes (optimistic over every cached list)
//   resolveIncident   — flip resolved=true, set resolved_at/by, save followup_notes
//
// Stats are derived locally from the cached list — backend has no /stats
// endpoint for incidents. Keep this hook thin; richer KPIs land when the
// serializer is extended (Phase 8F).
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  incidentService,
  type IncidentReport,
  type IncidentResolvePayload,
} from "../../../services/incidentService";
import { useAuth } from "../../../contexts/AuthContext";

const LIST_KEY_BASE = ["incidents", "list"] as const;

export interface IncidentsStats {
  total: number;
  open: number;
  resolved: number;
  bySeverity: Record<string, number>;
}

function computeStats(incidents: IncidentReport[]): IncidentsStats {
  const bySeverity: Record<string, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  let open = 0;
  let resolved = 0;
  for (const i of incidents) {
    if (i.resolved) resolved += 1;
    else open += 1;
    bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
  }
  return { total: incidents.length, open, resolved, bySeverity };
}

function patchIncidentInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number,
  patch: Partial<IncidentReport>,
) {
  const queries = queryClient.getQueriesData<IncidentReport[]>({
    queryKey: LIST_KEY_BASE,
  });
  for (const [key, list] of queries) {
    if (!Array.isArray(list)) continue;
    queryClient.setQueryData<IncidentReport[]>(
      key,
      list.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }
}

function snapshotAllListCaches(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.getQueriesData<IncidentReport[]>({
    queryKey: LIST_KEY_BASE,
  });
}

function restoreListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: ReturnType<typeof snapshotAllListCaches>,
) {
  for (const [key, value] of snapshot) {
    queryClient.setQueryData(key, value);
  }
}

export function useIncidentsData() {
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const me = authState.user;

  const listQuery = useQuery<IncidentReport[]>({
    queryKey: [...LIST_KEY_BASE, {}],
    queryFn: () => incidentService.list(),
  });

  const incidents = listQuery.data ?? [];

  const stats = useMemo(() => computeStats(incidents), [incidents]);

  const resolveIncident = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: IncidentResolvePayload;
    }) => incidentService.resolve(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: LIST_KEY_BASE });
      const snapshot = snapshotAllListCaches(queryClient);
      const meName = me
        ? `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || me.username
        : "";
      patchIncidentInCaches(queryClient, id, {
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: me?.id ?? null,
        resolved_by_name: meName,
        followup_notes: payload.followup_notes ?? "",
        requires_followup: payload.requires_followup ?? false,
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreListCaches(queryClient, ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  return {
    incidents,
    stats,
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    resolveIncident,
  };
}
