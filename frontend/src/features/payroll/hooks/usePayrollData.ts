// Payroll page data layer — TanStack Query against payrollService.
//
// Reads
//   ["payroll", "current"]                       getCurrentRun()
//   ["payroll", "officers", runCode]             getRunOfficers(runCode)
//   ["payroll", "history"]                       getRunHistory()
//   ["payroll", "composition", runCode]          getRunComposition(runCode)
//   ["payroll", "sia-holds", runCode]            getRunSiaHolds(runCode)
//   ["payroll", "officer", runCode, officerId]   getOfficerBundle(runCode, officerId)
import { useQuery } from "@tanstack/react-query";
import payrollService from "../../../services/payrollService";
import type {
  Officer,
  OfficerBundle,
  PayrollCycle,
  PayrollHistoryRun,
  PayrollRun,
} from "../data/mocks";

const CURRENT_KEY = (cycle: PayrollCycle) => ["payroll", "current", cycle] as const;
const OFFICERS_KEY = (runCode: string | null) =>
  ["payroll", "officers", runCode] as const;
const HISTORY_KEY = (cycle: PayrollCycle) => ["payroll", "history", cycle] as const;
const COMPOSITION_KEY = (runCode: string | null) =>
  ["payroll", "composition", runCode] as const;
const SIA_HOLDS_KEY = (runCode: string | null) =>
  ["payroll", "sia-holds", runCode] as const;
const OFFICER_KEY = (runCode: string | null, officerId: number | null) =>
  ["payroll", "officer", runCode, officerId] as const;

export function usePayrollRun(
  runCode?: string | null,
  cycle: PayrollCycle = "weekly",
) {
  return useQuery<PayrollRun>({
    queryKey: runCode ? (["payroll", "run", runCode] as const) : CURRENT_KEY(cycle),
    queryFn: () =>
      runCode
        ? payrollService.getRun(runCode)
        : payrollService.getCurrentRun(cycle),
    staleTime: 30_000,
  });
}

export function useRunOfficers(runCode: string | null | undefined) {
  return useQuery<Officer[]>({
    queryKey: OFFICERS_KEY(runCode ?? null),
    queryFn: () => payrollService.getRunOfficers(runCode!),
    enabled: !!runCode,
    staleTime: 30_000,
  });
}

export function useRunHistory(cycle: PayrollCycle = "weekly") {
  return useQuery<PayrollHistoryRun[]>({
    queryKey: HISTORY_KEY(cycle),
    queryFn: () => payrollService.getRunHistory(cycle),
    staleTime: 60_000,
  });
}

export function useRunComposition(runCode: string | null | undefined) {
  return useQuery<Record<string, number>>({
    queryKey: COMPOSITION_KEY(runCode ?? null),
    queryFn: () => payrollService.getRunComposition(runCode!),
    enabled: !!runCode,
    staleTime: 30_000,
  });
}

export function useRunSiaHolds(runCode: string | null | undefined) {
  return useQuery<Officer[]>({
    queryKey: SIA_HOLDS_KEY(runCode ?? null),
    queryFn: () => payrollService.getRunSiaHolds(runCode!),
    enabled: !!runCode,
    staleTime: 30_000,
  });
}

export function useOfficerBundle(
  runCode: string | null | undefined,
  officerId: number | null | undefined,
) {
  return useQuery<OfficerBundle>({
    queryKey: OFFICER_KEY(runCode ?? null, officerId ?? null),
    queryFn: () => payrollService.getOfficerBundle(runCode!, officerId!),
    enabled: !!runCode && !!officerId,
    staleTime: 30_000,
  });
}
