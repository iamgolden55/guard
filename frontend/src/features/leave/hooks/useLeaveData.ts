// Leave management data layer — TanStack Query against leaveService +
// bankHolidayService.
//
// Reads
//   ["leave","balances"]               getMyBalances           — own balance per leave type
//   ["leave","my-requests"]            getMyLeaveRequests      — own leave history (paginated)
//   ["leave","types"]                  getLeaveTypes(activeOnly=true)
//   ["leave","calendar", monthKey]     getLeaveCalendar(start,end) — own + visible team events
//   ["leave","pending"]                getPendingLeaveRequests — manager queue (skip when not manager)
//   ["bank-holidays", year]            bankHolidayService.getBankHolidays({ year, is_active: true })
//
// Writes
//   submitRequest    — createLeaveRequest, optimistic add to ["leave","my-requests"]
//   cancelRequest    — cancelLeaveRequest, optimistic mark as CANCELLED
//   processRequest   — processLeaveRequest, optimistic remove from ["leave","pending"]
//
// Every mutation calls invalidateQueries in onSettled so server reality wins.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import leaveService from "../../../services/leaveService";
import { bankHolidayService, type BankHoliday } from "../../../services/bankHolidayService";
import {
  type LeaveApprovalAction,
  type LeaveBalanceResponse,
  type LeaveCalendarEvent,
  type LeaveRequest,
  LeaveRequestStatus,
  type LeaveRequestFormData,
  type LeaveRequestResponse,
  type LeaveType,
  type PendingLeaveRequest,
} from "../../../types/leave";

const ISO_DAY = "yyyy-MM-dd";

// Some Django list endpoints serialize as a bare array, others as a paginated
// envelope ({count, results}) or a wrapper ({events: [...]}). Normalize so
// downstream consumers always see an array.
function toArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.events)) return obj.events as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

// The balances endpoint can return either the documented envelope
// ({user, balances: [...], total_days_*}) or a bare array of summaries when
// no policy is set. Normalize to the envelope shape with safe defaults.
function normalizeBalances(data: unknown): LeaveBalanceResponse {
  const empty: LeaveBalanceResponse = {
    user: { id: 0, username: "", first_name: "", last_name: "", email: "", is_staff: false, is_manager: false, date_joined: "" },
    balances: [],
    total_days_available: "0",
    total_days_used: "0",
    total_days_pending: "0",
  };
  if (data == null) return empty;
  if (Array.isArray(data)) {
    return { ...empty, balances: data as LeaveBalanceResponse["balances"] };
  }
  if (typeof data === "object") {
    const obj = data as Partial<LeaveBalanceResponse> & Record<string, unknown>;
    return {
      ...empty,
      ...obj,
      balances: Array.isArray(obj.balances) ? obj.balances : [],
      total_days_available: String(obj.total_days_available ?? "0"),
      total_days_used: String(obj.total_days_used ?? "0"),
      total_days_pending: String(obj.total_days_pending ?? "0"),
    };
  }
  return empty;
}

export interface UseLeaveDataOptions {
  /** Which calendar month is currently displayed. Drives the calendar query. */
  calendarMonth: Date;
  /** Skip the manager-only pending-requests query when the user isn't a manager. */
  isManager: boolean;
}

export function useLeaveData({
  calendarMonth,
  isManager,
}: UseLeaveDataOptions) {
  const queryClient = useQueryClient();

  const monthKey = format(calendarMonth, "yyyy-MM");
  const monthStart = format(startOfMonth(calendarMonth), ISO_DAY);
  const monthEnd = format(endOfMonth(calendarMonth), ISO_DAY);
  const year = calendarMonth.getFullYear();

  // ── Reads ─────────────────────────────────────────────────────────────────
  const balancesQuery = useQuery<LeaveBalanceResponse>({
    queryKey: ["leave", "balances"],
    queryFn: async () => {
      const data = (await leaveService.getMyBalances()) as unknown;
      return normalizeBalances(data);
    },
  });

  const myRequestsQuery = useQuery<LeaveRequestResponse>({
    queryKey: ["leave", "my-requests"],
    queryFn: () => leaveService.getMyLeaveRequests(undefined, 1, 50),
  });

  const leaveTypesQuery = useQuery<LeaveType[]>({
    queryKey: ["leave", "types"],
    queryFn: async () => {
      const data = (await leaveService.getLeaveTypes(true)) as unknown;
      return toArray<LeaveType>(data);
    },
  });

  const calendarQuery = useQuery<LeaveCalendarEvent[]>({
    queryKey: ["leave", "calendar", monthKey],
    queryFn: async () => {
      const data = (await leaveService.getLeaveCalendar(
        monthStart,
        monthEnd,
      )) as unknown;
      return toArray<LeaveCalendarEvent>(data);
    },
  });

  const pendingQuery = useQuery<PendingLeaveRequest[]>({
    queryKey: ["leave", "pending"],
    queryFn: async () => {
      const data = (await leaveService.getPendingLeaveRequests()) as unknown;
      return toArray<PendingLeaveRequest>(data);
    },
    enabled: isManager,
  });

  const bankHolidaysQuery = useQuery<BankHoliday[]>({
    queryKey: ["bank-holidays", year],
    queryFn: () =>
      bankHolidayService.getBankHolidays({ year, is_active: true }),
  });

  // ── Submit a new leave request ────────────────────────────────────────────
  const submitRequest = useMutation({
    mutationFn: (payload: LeaveRequestFormData) =>
      leaveService.createLeaveRequest(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave", "balances"] });
      queryClient.invalidateQueries({ queryKey: ["leave", "calendar"] });
      queryClient.invalidateQueries({ queryKey: ["leave", "pending"] });
    },
  });

  // ── Cancel one of my pending requests ─────────────────────────────────────
  const cancelRequest = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      leaveService.cancelLeaveRequest(id, reason),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["leave", "my-requests"] });
      const prev = queryClient.getQueryData<LeaveRequestResponse>([
        "leave",
        "my-requests",
      ]);
      if (prev) {
        queryClient.setQueryData<LeaveRequestResponse>(
          ["leave", "my-requests"],
          {
            ...prev,
            results: prev.results.map((r) =>
              r.id === id ? { ...r, status: LeaveRequestStatus.CANCELLED } : r,
            ),
          },
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(["leave", "my-requests"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave", "balances"] });
      queryClient.invalidateQueries({ queryKey: ["leave", "calendar"] });
    },
  });

  // ── Approve or reject a pending request (manager) ─────────────────────────
  const processRequest = useMutation({
    mutationFn: (action: LeaveApprovalAction) =>
      leaveService.processLeaveRequest(action),
    onMutate: async ({ request_id }) => {
      await queryClient.cancelQueries({ queryKey: ["leave", "pending"] });
      const prev = queryClient.getQueryData<PendingLeaveRequest[]>([
        "leave",
        "pending",
      ]);
      if (prev) {
        queryClient.setQueryData<PendingLeaveRequest[]>(
          ["leave", "pending"],
          prev.filter((r) => r.id !== request_id),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["leave", "pending"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leave", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["leave", "calendar"] });
    },
  });

  return {
    balances: balancesQuery.data ?? null,
    myRequests: myRequestsQuery.data?.results ?? [],
    leaveTypes: leaveTypesQuery.data ?? [],
    calendarEvents: calendarQuery.data ?? [],
    pendingApprovals: pendingQuery.data ?? [],
    bankHolidays: bankHolidaysQuery.data ?? [],
    isLoading:
      balancesQuery.isLoading ||
      myRequestsQuery.isLoading ||
      leaveTypesQuery.isLoading,
    isCalendarLoading: calendarQuery.isLoading,
    isPendingLoading: pendingQuery.isLoading,
    submitRequest,
    cancelRequest,
    processRequest,
  };
}

/** Helper used by the request modal — count weekdays inclusive of both ends. */
export function calculateWorkingDays(start: Date, end: Date): number {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export type LeaveRequestRow = LeaveRequest;
