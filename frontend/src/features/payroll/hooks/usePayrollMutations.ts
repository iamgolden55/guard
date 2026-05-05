// Payroll mutations — approve/reject officer + adjust shift hours.
//
// All mutations invalidate the active run's queries so the table, drawer,
// composition card, and SIA holds card refresh consistently.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import payrollService from "../../../services/payrollService";

export function usePayrollMutations(runCode: string | null | undefined) {
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  // P6 (M5 fix): Use the logged-in manager's identity as the audit signature
  // instead of the hardcoded literal "manager". The backend stores this on
  // TimeAdjustment.manager_signature for the audit trail.
  const managerSignature =
    [authState.user?.firstName, authState.user?.lastName]
      .filter(Boolean)
      .join(" ") ||
    authState.user?.username ||
    "unknown";

  const invalidateRun = () => {
    if (!runCode) return;
    queryClient.invalidateQueries({
      queryKey: ["payroll", "officers", runCode],
    });
    queryClient.invalidateQueries({
      queryKey: ["payroll", "composition", runCode],
    });
    queryClient.invalidateQueries({
      queryKey: ["payroll", "sia-holds", runCode],
    });
    queryClient.invalidateQueries({ queryKey: ["payroll", "current"] });
    queryClient.invalidateQueries({ queryKey: ["payroll", "run", runCode] });
    queryClient.invalidateQueries({
      queryKey: ["payroll", "officer", runCode],
    });
    // PayrollRun cached aggregates feed the "Previous runs" rail too, so a
    // time adjustment that shifts an invoice total must refresh history.
    queryClient.invalidateQueries({ queryKey: ["payroll", "history"] });
  };

  const approveOfficer = useMutation({
    mutationFn: (officerId: number) => {
      if (!runCode) throw new Error("No active run");
      return payrollService.approveOfficer(runCode, officerId);
    },
    onSuccess: invalidateRun,
  });

  const approveAllPending = useMutation({
    mutationFn: (officerIds?: number[]) => {
      if (!runCode) throw new Error("No active run");
      return payrollService.approveAllPending(runCode, officerIds);
    },
    onSuccess: invalidateRun,
  });

  const markPaidOfficer = useMutation({
    mutationFn: (officerId: number) => {
      if (!runCode) throw new Error("No active run");
      return payrollService.markPaidOfficer(runCode, officerId);
    },
    onSuccess: invalidateRun,
  });

  const markPaidAllApproved = useMutation({
    mutationFn: (officerIds?: number[]) => {
      if (!runCode) throw new Error("No active run");
      return payrollService.markPaidAllApproved(runCode, officerIds);
    },
    onSuccess: invalidateRun,
  });

  const rejectOfficer = useMutation({
    mutationFn: ({
      officerId,
      reason,
    }: { officerId: number; reason: string }) => {
      if (!runCode) throw new Error("No active run");
      return payrollService.rejectOfficer(runCode, officerId, reason);
    },
    onSuccess: invalidateRun,
  });

  const adjustTime = useMutation({
    mutationFn: ({
      shiftId,
      adjustedCheckIn,
      adjustedCheckOut,
      adjustedHours,
      reason,
    }: {
      shiftId: number;
      adjustedCheckIn: string;
      adjustedCheckOut: string;
      adjustedHours: number;
      reason: string;
    }) =>
      payrollService.adjustTime(shiftId, {
        adjusted_check_in_time: adjustedCheckIn,
        adjusted_check_out_time: adjustedCheckOut,
        adjusted_actual_hours: adjustedHours,
        reason,
        manager_signature: managerSignature,
      }),
    onSuccess: invalidateRun,
  });

  return {
    approveOfficer,
    approveAllPending,
    markPaidOfficer,
    markPaidAllApproved,
    rejectOfficer,
    adjustTime,
  };
}
