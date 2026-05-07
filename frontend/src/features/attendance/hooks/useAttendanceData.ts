// Attendance admin data layer — TanStack Query against attendanceService.
//
// Reads
//   ["attendance", "live", date]                    getLiveAttendance(date)
//   ["attendance", "timesheets", weekStart]         getTimesheets(weekStart)
//   ["attendance", "adjustments", shiftId]          getShiftAdjustments(shiftId)
//
// Writes
//   adjustTime                                      optimistically prepends a
//                                                   placeholder audit row and
//                                                   invalidates live + adjustments.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import attendanceService, {
  type AttendanceStats,
  type LiveAttendancePayload,
  type ShiftAdjustmentRecord,
  type TimesheetsPayload,
} from "../../../services/attendanceService";
import type {
  AttendanceOfficer,
  AttendanceShift,
  AttendanceVenue,
  TimesheetRow,
  WeekDay,
} from "../data/mocks";

const LIVE_KEY = (date: string) => ["attendance", "live", date] as const;
const TIMESHEETS_KEY = (weekStart: string) => ["attendance", "timesheets", weekStart] as const;
const ADJUSTMENTS_KEY = (shiftId: number | null) =>
  ["attendance", "adjustments", shiftId] as const;

const EMPTY_STATS: AttendanceStats = {
  on_duty: 0,
  pending: 0,
  exceptions: 0,
  no_show: 0,
  missing_out: 0,
  geofence: 0,
  late: 0,
  early_out: 0,
  expected_so_far: 0,
  showed_up: 0,
};

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mondayIso(ref: Date = new Date()): string {
  const d = new Date(ref);
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface UseAttendanceDataOptions {
  date?: string;
  weekStart?: string;
  selectedShiftId?: number | null;
  /** Polling interval for the live tab; null disables polling. Default 30s. */
  livePollMs?: number | null;
}

export function useAttendanceData(opts: UseAttendanceDataOptions = {}) {
  const date = opts.date ?? todayIso();
  const weekStart = opts.weekStart ?? mondayIso();
  const selectedShiftId = opts.selectedShiftId ?? null;
  const livePollMs = opts.livePollMs === undefined ? 30_000 : opts.livePollMs;

  const queryClient = useQueryClient();

  const liveQuery = useQuery<LiveAttendancePayload>({
    queryKey: LIVE_KEY(date),
    queryFn: () => attendanceService.getLiveAttendance(date),
    refetchInterval: livePollMs ?? false,
    refetchOnWindowFocus: true,
  });

  const timesheetsQuery = useQuery<TimesheetsPayload>({
    queryKey: TIMESHEETS_KEY(weekStart),
    queryFn: () => attendanceService.getTimesheets(weekStart),
  });

  const adjustmentsQuery = useQuery<ShiftAdjustmentRecord[]>({
    queryKey: ADJUSTMENTS_KEY(selectedShiftId),
    queryFn: () =>
      selectedShiftId
        ? attendanceService.getShiftAdjustments(selectedShiftId)
        : Promise.resolve([]),
    enabled: selectedShiftId !== null,
  });

  const adjustTime = useMutation({
    mutationFn: ({
      shiftId,
      payload,
    }: {
      shiftId: number;
      payload: {
        adjusted_check_in_time?: string;
        adjusted_check_out_time?: string;
        adjusted_actual_hours: number;
        reason: string;
        manager_signature: string;
      };
    }) => attendanceService.adjustShiftTime(shiftId, payload),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ADJUSTMENTS_KEY(vars.shiftId) });
      queryClient.invalidateQueries({ queryKey: LIVE_KEY(date) });
      queryClient.invalidateQueries({ queryKey: TIMESHEETS_KEY(weekStart) });
    },
  });

  const approveShift = useMutation({
    mutationFn: ({
      shiftId,
      approved,
      managerNotes,
    }: {
      shiftId: number;
      approved: boolean;
      managerNotes?: string;
    }) => attendanceService.approveShift(shiftId, { approved, managerNotes }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LIVE_KEY(date) });
      queryClient.invalidateQueries({ queryKey: TIMESHEETS_KEY(weekStart) });
    },
  });

  // Defensive defaults so child components never have to null-check
  const shifts: AttendanceShift[] = liveQuery.data?.shifts ?? [];
  const officers: AttendanceOfficer[] = liveQuery.data?.officers ?? [];
  const venues: AttendanceVenue[] = liveQuery.data?.venues ?? [];
  const stats: AttendanceStats = liveQuery.data?.stats ?? EMPTY_STATS;
  const timesheetRows: TimesheetRow[] = timesheetsQuery.data?.rows ?? [];
  const weekDays: WeekDay[] = timesheetsQuery.data?.days ?? [];
  const timesheetOfficers: AttendanceOfficer[] = timesheetsQuery.data?.officers ?? [];
  const timesheetVenues: AttendanceVenue[] = timesheetsQuery.data?.venues ?? [];

  // Lookup maps for O(1) child component access (avoids re-iterating arrays
  // when rendering 200+ ribbons in TimelineRiver).
  const officerById = useMemo(() => {
    const map = new Map<string, AttendanceOfficer>();
    for (const o of officers) map.set(o.id, o);
    for (const o of timesheetOfficers) if (!map.has(o.id)) map.set(o.id, o);
    return map;
  }, [officers, timesheetOfficers]);

  const venueById = useMemo(() => {
    const map = new Map<string, AttendanceVenue>();
    for (const v of venues) map.set(v.id, v);
    for (const v of timesheetVenues) if (!map.has(v.id)) map.set(v.id, v);
    return map;
  }, [venues, timesheetVenues]);

  return {
    // Live tab
    shifts,
    officers,
    venues,
    stats,
    isLoadingLive: liveQuery.isLoading,
    liveError: liveQuery.error as Error | null,
    refetchLive: liveQuery.refetch,
    // Timesheets tab
    timesheetRows,
    weekDays,
    timesheetOfficers,
    isLoadingTimesheets: timesheetsQuery.isLoading,
    timesheetsError: timesheetsQuery.error as Error | null,
    // Drawer
    adjustments: adjustmentsQuery.data ?? [],
    isLoadingAdjustments: adjustmentsQuery.isLoading,
    // Mutations
    adjustTime,
    approveShift,
    // Lookup maps
    officerById,
    venueById,
  };
}

export type UseAttendanceDataReturn = ReturnType<typeof useAttendanceData>;
