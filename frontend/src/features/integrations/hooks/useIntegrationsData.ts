// Integrations admin data layer — TanStack Query against:
//   • financeIntegrationsService (8 OAuth providers)
//   • deputyService              (1 API-key provider)
//
// Reads
//   ["integrations","finance","connections"]   listConnections
//   ["integrations","finance","logs"]          getSyncLogs
//   ["integrations","deputy","status"]         getDeputyStatus
//   ["integrations","deputy","logs"]           getSyncLogs (Deputy)
//
// Writes
//   disconnectFinance     — DELETE /finance/connections/{id}/  (optimistic)
//   testFinanceConnection — POST   /finance/connections/{id}/test_connection/
//   refreshFinanceToken   — POST   /finance/connections/{id}/refresh_token/
//   updateDeputyConfig    — PUT    /deputy/config/             (non-optimistic)
//   syncDeputyEmployees   — POST   /deputy/sync-employees/
//   syncDeputyTimesheets  — POST   /deputy/sync-timesheets/
//
// Deputy "connected" derives from getDeputyStatus().isConnected.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import financeIntegrationsService, {
  type ProviderConnection,
  type SyncLog as FinanceSyncLog,
} from "../../../services/financeIntegrationsService";
import deputyService from "../../../services/deputyService";
import type { DeputyStatus, SyncLog as DeputySyncLog } from "../../../types/deputy";

const FIN_CONN_KEY = ["integrations", "finance", "connections"] as const;
const FIN_LOGS_KEY = ["integrations", "finance", "logs"] as const;
const DEPUTY_STATUS_KEY = ["integrations", "deputy", "status"] as const;
const DEPUTY_LOGS_KEY = ["integrations", "deputy", "logs"] as const;
const DEPUTY_CONFIG_KEY = ["integrations", "deputy", "config"] as const;

export type ActivityLevel = "info" | "warning" | "error" | "success";

export interface ActivityEntry {
  id: string;
  source: "finance" | "deputy";
  providerLabel: string;
  level: ActivityLevel;
  operation: string;
  message: string;
  timestamp: string;
}

function normalizeFinanceLog(log: FinanceSyncLog): ActivityEntry {
  const level: ActivityLevel = ((): ActivityLevel => {
    switch (log.level) {
      case "info":
      case "warning":
      case "error":
      case "success":
        return log.level;
      default:
        return "info";
    }
  })();
  return {
    id: `fin-${log.id}`,
    source: "finance",
    providerLabel: log.connection_name || "Finance",
    level,
    operation: log.operation,
    message: log.message,
    timestamp: log.created_at,
  };
}

function normalizeDeputyLog(log: DeputySyncLog): ActivityEntry {
  return {
    id: `dep-${log.id}`,
    source: "deputy",
    providerLabel: "Deputy",
    level: log.status === "success" ? "success" : "error",
    operation: log.entityType === "employee" ? "sync_employees" : "sync_timesheets",
    message: log.message,
    timestamp: log.createdAt,
  };
}

export function useIntegrationsData() {
  const queryClient = useQueryClient();

  // ── Reads ────────────────────────────────────────────────────────────────
  const financeConnections = useQuery<ProviderConnection[]>({
    queryKey: FIN_CONN_KEY,
    queryFn: () => financeIntegrationsService.getConnections(),
  });

  const financeLogs = useQuery<FinanceSyncLog[]>({
    queryKey: FIN_LOGS_KEY,
    queryFn: () => financeIntegrationsService.getSyncLogs(),
  });

  const deputyStatus = useQuery<DeputyStatus | null>({
    queryKey: DEPUTY_STATUS_KEY,
    queryFn: async () => {
      try {
        return await deputyService.getDeputyStatus();
      } catch {
        // Deputy isn't configured yet — that's the most common case. Treat
        // the failure as "not connected" rather than blowing up the page.
        return null;
      }
    },
    retry: false,
  });

  const deputyLogs = useQuery<DeputySyncLog[]>({
    queryKey: DEPUTY_LOGS_KEY,
    queryFn: async () => {
      try {
        return await deputyService.getSyncLogs();
      } catch {
        return [];
      }
    },
    retry: false,
  });

  // ── Derived activity feed (chronological) ───────────────────────────────
  const activity: ActivityEntry[] = useMemo(() => {
    const finance = (financeLogs.data ?? []).map(normalizeFinanceLog);
    const deputy = (deputyLogs.data ?? []).map(normalizeDeputyLog);
    return [...finance, ...deputy].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0,
    );
  }, [financeLogs.data, deputyLogs.data]);

  // ── Connected-count derived from caches ──────────────────────────────────
  const connectedCount =
    (financeConnections.data?.length ?? 0) +
    (deputyStatus.data?.isConnected ? 1 : 0);

  const errorCount =
    (financeConnections.data ?? []).filter(
      (c) => c.status === "error" || c.status === "expired",
    ).length + (deputyStatus.data?.errorMessage ? 1 : 0);

  // ── Finance writes ──────────────────────────────────────────────────────
  const disconnectFinance = useMutation({
    mutationFn: (id: number) => financeIntegrationsService.deleteConnection(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: FIN_CONN_KEY });
      const previous = queryClient.getQueryData<ProviderConnection[]>(FIN_CONN_KEY);
      queryClient.setQueryData<ProviderConnection[]>(
        FIN_CONN_KEY,
        (previous ?? []).filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(FIN_CONN_KEY, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const testFinanceConnection = useMutation({
    mutationFn: (id: number) => financeIntegrationsService.testConnection(id),
  });

  const refreshFinanceToken = useMutation({
    mutationFn: (id: number) => financeIntegrationsService.refreshToken(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FIN_CONN_KEY });
    },
  });

  // ── Deputy writes ───────────────────────────────────────────────────────
  const updateDeputyConfig = useMutation({
    mutationFn: (data: {
      apiEndpoint: string;
      apiKey: string;
      isActive: boolean;
    }) => deputyService.updateDeputyConfig(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DEPUTY_CONFIG_KEY });
      queryClient.invalidateQueries({ queryKey: DEPUTY_STATUS_KEY });
    },
  });

  const disconnectDeputy = useMutation({
    mutationFn: () =>
      deputyService.updateDeputyConfig({
        apiEndpoint: "",
        apiKey: "",
        isActive: false,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DEPUTY_STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: DEPUTY_CONFIG_KEY });
    },
  });

  const syncDeputyEmployees = useMutation({
    mutationFn: () => deputyService.syncEmployees(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DEPUTY_LOGS_KEY });
      queryClient.invalidateQueries({ queryKey: DEPUTY_STATUS_KEY });
    },
  });

  const syncDeputyTimesheets = useMutation({
    mutationFn: () => deputyService.syncTimesheets(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DEPUTY_LOGS_KEY });
      queryClient.invalidateQueries({ queryKey: DEPUTY_STATUS_KEY });
    },
  });

  return {
    // Reads
    financeConnections: financeConnections.data ?? [],
    deputyStatus: deputyStatus.data ?? null,
    activity,
    connectedCount,
    errorCount,
    isLoading:
      financeConnections.isLoading ||
      deputyStatus.isLoading ||
      financeLogs.isLoading ||
      deputyLogs.isLoading,
    isFinanceLoading: financeConnections.isLoading,
    isDeputyLoading: deputyStatus.isLoading,
    isActivityLoading: financeLogs.isLoading || deputyLogs.isLoading,
    // Writes
    disconnectFinance,
    testFinanceConnection,
    refreshFinanceToken,
    updateDeputyConfig,
    disconnectDeputy,
    syncDeputyEmployees,
    syncDeputyTimesheets,
  };
}
