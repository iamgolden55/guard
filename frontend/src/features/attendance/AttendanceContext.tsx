// AttendanceContext — bridges the useAttendanceData hook to all child
// components without prop-drilling through 4 layers. Components consume
// shifts/officers/venues/stats/timesheets/etc via useAttendance().
//
// Wraps server data, current-time refs, lookup helpers, and the
// adjustTime mutation in a single provider so child components don't
// need to know about React Query.
import { type ReactNode, createContext, useContext, useMemo } from "react";
import type {
  AttendanceStats,
  ShiftAdjustmentRecord,
} from "../../services/attendanceService";
import type {
  AttendanceOfficer,
  AttendanceShift,
  AttendanceVenue,
  TimesheetRow,
  WeekDay,
} from "./data/mocks";
import type { UseAttendanceDataReturn } from "./hooks/useAttendanceData";

interface AdjustTimeArgs {
  shiftId: number;
  payload: {
    adjusted_check_in_time?: string;
    adjusted_check_out_time?: string;
    adjusted_actual_hours: number;
    reason: string;
    manager_signature: string;
  };
}

interface ApproveShiftArgs {
  shiftId: number;
  approved: boolean;
  managerNotes?: string;
}

export interface AttendanceContextValue {
  // Live tab
  shifts: AttendanceShift[];
  officers: AttendanceOfficer[];
  venues: AttendanceVenue[];
  stats: AttendanceStats;
  liveShifts: AttendanceShift[];
  exceptionShifts: AttendanceShift[];
  // Timesheets tab
  timesheets: TimesheetRow[];
  weekDays: WeekDay[];
  // Now-time refs. When viewing a past or future date, isToday=false and
  // nowHour/nowLabel are sentinels (24/"") so the NOW marker hides.
  nowHour: number;
  nowLabel: string;
  todayLabel: string;
  isToday: boolean;
  // Date navigation
  selectedDate: string; // YYYY-MM-DD, drives live + exceptions queries
  setSelectedDate: (d: string) => void;
  selectedWeekStart: string; // YYYY-MM-DD (Monday), drives timesheets query
  setSelectedWeekStart: (d: string) => void;
  // Lookup helpers
  officerById: (id: string | null | undefined) => AttendanceOfficer | undefined;
  venueById: (id: string) => AttendanceVenue | undefined;
  // Drawer-scoped
  adjustments: ShiftAdjustmentRecord[];
  isLoadingAdjustments: boolean;
  // Selection
  selectedShiftId: number | null;
  setSelectedShiftId: (id: number | null) => void;
  // Search (officer name / venue name / area). Empty string = no filter.
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  matchesSearch: (shift: AttendanceShift) => boolean;
  // Mutations
  adjustTime: (args: AdjustTimeArgs) => Promise<ShiftAdjustmentRecord>;
  isAdjusting: boolean;
  approveShift: (args: ApproveShiftArgs) => Promise<unknown>;
  isApproving: boolean;
  // Loading states
  isLoadingLive: boolean;
  isLoadingTimesheets: boolean;
  liveError: Error | null;
  timesheetsError: Error | null;
}

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

interface AttendanceProviderProps {
  children: ReactNode;
  data: UseAttendanceDataReturn;
  selectedShiftId: number | null;
  setSelectedShiftId: (id: number | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  selectedWeekStart: string;
  setSelectedWeekStart: (d: string) => void;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildDateRefs(selectedDate: string) {
  const isToday = selectedDate === todayIsoLocal();
  const [y, m, d] = selectedDate.split("-").map(Number);
  const selected = new Date(y, m - 1, d);
  const todayLabel = selected.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (isToday) {
    const now = new Date();
    return {
      nowHour: now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600,
      nowLabel: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      todayLabel,
      isToday,
    };
  }
  // Past or future: NOW marker is meaningless — sentinels keep math benign
  // (24h = end-of-day, so any "elapsed since check-in" calc stays bounded).
  return { nowHour: 24, nowLabel: "", todayLabel, isToday };
}

export function AttendanceProvider({
  children,
  data,
  selectedShiftId,
  setSelectedShiftId,
  searchQuery,
  setSearchQuery,
  selectedDate,
  setSelectedDate,
  selectedWeekStart,
  setSelectedWeekStart,
}: AttendanceProviderProps) {
  const { nowHour, nowLabel, todayLabel, isToday } =
    buildDateRefs(selectedDate);

  // Derived selectors mirror mocks.ts liveShifts / exceptionShifts.
  // Note: these are pre-search-filter; tabs apply matchesSearch separately so
  // empty-state messages can still know the unfiltered counts.
  const liveShifts = useMemo(
    () =>
      data.shifts.filter(
        (s) => s.status === "on_duty" || s.status === "missing_out",
      ),
    [data.shifts],
  );

  const exceptionShifts = useMemo(
    () =>
      data.shifts.filter(
        (s) =>
          s.status === "no_show" ||
          s.status === "missing_out" ||
          s.geofence_fail ||
          s.status === "early_out" ||
          s.was_late ||
          (s.late_min ?? 0) >= 10,
      ),
    [data.shifts],
  );

  const officerByIdFn = useMemo(
    () => (id: string | null | undefined) =>
      id ? data.officerById.get(id) : undefined,
    [data.officerById],
  );

  const venueByIdFn = useMemo(
    () => (id: string) => data.venueById.get(id),
    [data.venueById],
  );

  const matchesSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return () => true;
    return (shift: AttendanceShift) => {
      const o = shift.oid ? data.officerById.get(shift.oid) : undefined;
      const v = data.venueById.get(shift.vid);
      const haystack = [o?.name, o?.role, o?.sia, v?.name, v?.area]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    };
  }, [searchQuery, data.officerById, data.venueById]);

  const value: AttendanceContextValue = {
    shifts: data.shifts,
    officers: data.officers,
    venues: data.venues,
    stats: data.stats,
    liveShifts,
    exceptionShifts,
    timesheets: data.timesheetRows,
    weekDays: data.weekDays,
    nowHour,
    nowLabel,
    todayLabel,
    isToday,
    selectedDate,
    setSelectedDate,
    selectedWeekStart,
    setSelectedWeekStart,
    officerById: officerByIdFn,
    venueById: venueByIdFn,
    adjustments: data.adjustments,
    isLoadingAdjustments: data.isLoadingAdjustments,
    selectedShiftId,
    setSelectedShiftId,
    searchQuery,
    setSearchQuery,
    matchesSearch,
    adjustTime: (args) => data.adjustTime.mutateAsync(args),
    isAdjusting: data.adjustTime.isPending,
    approveShift: (args) => data.approveShift.mutateAsync(args),
    isApproving: data.approveShift.isPending,
    isLoadingLive: data.isLoadingLive,
    isLoadingTimesheets: data.isLoadingTimesheets,
    liveError: data.liveError,
    timesheetsError: data.timesheetsError,
  };

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance(): AttendanceContextValue {
  const ctx = useContext(AttendanceContext);
  if (!ctx) {
    throw new Error("useAttendance must be used within <AttendanceProvider>");
  }
  return ctx;
}
