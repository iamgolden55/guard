import type {
  Officer,
  OfficerBundle,
  PayrollHistoryRun,
  PayrollRun,
} from "../features/payroll/data/mocks";
// Payroll service — talks to /api/v1/payroll/runs/ for the Payroll page.
// Shapes match the PayrollRun / Officer / OfficerBundle / FinanceProvider /
// PayrollHistoryRun TS interfaces in features/payroll/data/mocks.ts.
import api from "./api";

type PayrollCycleParam = "weekly" | "monthly";

class PayrollService {
  /** GET /api/v1/payroll/runs/current/?cycle=weekly|monthly */
  async getCurrentRun(
    cycle: PayrollCycleParam = "weekly",
  ): Promise<PayrollRun> {
    const response = await api.get<PayrollRun>(
      `/api/v1/payroll/runs/current/?cycle=${cycle}`,
    );
    return response.data;
  }

  /** GET /api/v1/payroll/runs/?cycle=weekly|monthly — last ~12 runs */
  async getRunHistory(
    cycle: PayrollCycleParam = "weekly",
  ): Promise<PayrollHistoryRun[]> {
    const response = await api.get<PayrollHistoryRun[]>(
      `/api/v1/payroll/runs/?cycle=${cycle}`,
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  /** GET /api/v1/payroll/runs/{run_code}/ */
  async getRun(runCode: string): Promise<PayrollRun> {
    const response = await api.get<PayrollRun>(
      `/api/v1/payroll/runs/${runCode}/`,
    );
    return response.data;
  }

  /** GET /api/v1/payroll/runs/{run_code}/officers/ */
  async getRunOfficers(runCode: string): Promise<Officer[]> {
    const response = await api.get<Officer[]>(
      `/api/v1/payroll/runs/${runCode}/officers/`,
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  /** GET /api/v1/payroll/runs/{run_code}/officers/{officer_id}/ */
  async getOfficerBundle(
    runCode: string,
    officerId: number,
  ): Promise<OfficerBundle> {
    const response = await api.get<OfficerBundle>(
      `/api/v1/payroll/runs/${runCode}/officers/${officerId}/`,
    );
    return response.data;
  }

  /** GET /api/v1/payroll/runs/{run_code}/composition/ */
  async getRunComposition(runCode: string): Promise<Record<string, number>> {
    const response = await api.get<Record<string, number>>(
      `/api/v1/payroll/runs/${runCode}/composition/`,
    );
    return response.data || {};
  }

  /** GET /api/v1/payroll/runs/{run_code}/sia-holds/ */
  async getRunSiaHolds(runCode: string): Promise<Officer[]> {
    const response = await api.get<Officer[]>(
      `/api/v1/payroll/runs/${runCode}/sia-holds/`,
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  /** POST /api/v1/payroll/runs/{run_code}/officers/{id}/approve/ */
  async approveOfficer(runCode: string, officerId: number): Promise<Officer> {
    const response = await api.post<Officer>(
      `/api/v1/payroll/runs/${runCode}/officers/${officerId}/approve/`,
    );
    return response.data;
  }

  /** POST /api/v1/payroll/runs/{run_code}/approve-all/ — bulk-approve every
   * pending invoice in the run. Returns the count approved + refreshed
   * officer list. */
  async approveAllPending(
    runCode: string,
    officerIds?: number[],
  ): Promise<{
    approved_count: number;
    run_status: string;
    officers: Officer[];
  }> {
    const body =
      officerIds && officerIds.length > 0 ? { officer_ids: officerIds } : {};
    const response = await api.post<{
      approved_count: number;
      run_status: string;
      officers: Officer[];
    }>(`/api/v1/payroll/runs/${runCode}/approve-all/`, body);
    return response.data;
  }

  /** POST /api/v1/payroll/runs/{run_code}/officers/{id}/mark-paid/ — flips
   * an approved invoice to paid. Refused if the invoice isn't approved. */
  async markPaidOfficer(runCode: string, officerId: number): Promise<Officer> {
    const response = await api.post<Officer>(
      `/api/v1/payroll/runs/${runCode}/officers/${officerId}/mark-paid/`,
    );
    return response.data;
  }

  /** POST /api/v1/payroll/runs/{run_code}/mark-paid-all/ — bulk-flip every
   * approved invoice in the run to paid. Refused if nothing is approved. */
  async markPaidAllApproved(
    runCode: string,
    officerIds?: number[],
  ): Promise<{
    paid_count: number;
    run_status: string;
    officers: Officer[];
  }> {
    const body =
      officerIds && officerIds.length > 0 ? { officer_ids: officerIds } : {};
    const response = await api.post<{
      paid_count: number;
      run_status: string;
      officers: Officer[];
    }>(`/api/v1/payroll/runs/${runCode}/mark-paid-all/`, body);
    return response.data;
  }

  /** POST /api/v1/payroll/runs/{run_code}/regenerate/ — re-aggregate invoices for this run */
  async regenerateRun(
    runCode: string,
  ): Promise<{ run: PayrollRun; regenerated: number; errors: number }> {
    const response = await api.post<{
      run: PayrollRun;
      regenerated: number;
      errors: number;
    }>(`/api/v1/payroll/runs/${runCode}/regenerate/`);
    return response.data;
  }

  /** POST /api/v1/payroll/runs/{run_code}/officers/{id}/reject/ */
  async rejectOfficer(
    runCode: string,
    officerId: number,
    reason: string,
  ): Promise<Officer> {
    const response = await api.post<Officer>(
      `/api/v1/payroll/runs/${runCode}/officers/${officerId}/reject/`,
      { reason },
    );
    return response.data;
  }

  /** POST /api/v1/shifts/{shiftId}/adjust_time/ — existing endpoint at backend/shifts/views.py:1405 */
  async adjustTime(
    shiftId: number,
    body: {
      adjusted_check_in_time?: string;
      adjusted_check_out_time?: string;
      adjusted_actual_hours: number;
      reason: string;
      manager_signature: string;
    },
  ): Promise<unknown> {
    const response = await api.post(
      `/api/v1/shifts/${shiftId}/adjust_time/`,
      body,
    );
    return response.data;
  }
}

const payrollService = new PayrollService();
export default payrollService;
