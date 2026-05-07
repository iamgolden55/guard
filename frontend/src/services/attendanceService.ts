import api from './api';
import shiftService from './shiftService';
import type {
  AttendanceShift,
  AttendanceVenue,
  AttendanceOfficer,
  TimesheetRow,
  WeekDay,
} from '../features/attendance/data/mocks';

export interface AttendanceStats {
  on_duty: number;
  pending: number;
  exceptions: number;
  no_show: number;
  missing_out: number;
  geofence: number;
  late: number;
  early_out: number;
  expected_so_far: number;
  showed_up: number;
}

export interface LiveAttendancePayload {
  shifts: AttendanceShift[];
  officers: AttendanceOfficer[];
  venues: AttendanceVenue[];
  stats: AttendanceStats;
}

export interface TimesheetsPayload {
  rows: TimesheetRow[];
  days: WeekDay[];
  officers: AttendanceOfficer[];
  venues: AttendanceVenue[];
}

export interface ShiftAdjustmentRecord {
  id: number;
  shift: number;
  original_check_in_time: string | null;
  original_check_out_time: string | null;
  original_actual_hours: number | null;
  adjusted_check_in_time: string | null;
  adjusted_check_out_time: string | null;
  adjusted_actual_hours: number;
  reason: string;
  adjusted_by: number;
  manager_signature: string;
  created_at: string;
}

const empty: AttendanceStats = {
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

export const attendanceService = {
  async getLiveAttendance(date?: string, venueId?: number): Promise<LiveAttendancePayload> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (venueId) params.append('venueId', String(venueId));
    const qs = params.toString();
    const url = `/api/v1/shifts/attendance/live/${qs ? `?${qs}` : ''}`;
    const response = await api.get<LiveAttendancePayload>(url);
    return {
      shifts: response.data?.shifts ?? [],
      officers: response.data?.officers ?? [],
      venues: response.data?.venues ?? [],
      stats: { ...empty, ...(response.data?.stats ?? {}) },
    };
  },

  async getTimesheets(weekStart: string, venueId?: number): Promise<TimesheetsPayload> {
    const params = new URLSearchParams();
    params.append('weekStart', weekStart);
    if (venueId) params.append('venueId', String(venueId));
    const url = `/api/v1/shifts/attendance/timesheets/?${params.toString()}`;
    const response = await api.get<TimesheetsPayload>(url);
    return {
      rows: response.data?.rows ?? [],
      days: response.data?.days ?? [],
      officers: response.data?.officers ?? [],
      venues: response.data?.venues ?? [],
    };
  },

  async getShiftAdjustments(shiftId: number): Promise<ShiftAdjustmentRecord[]> {
    return shiftService.getTimeAdjustments(shiftId);
  },

  async adjustShiftTime(
    shiftId: number,
    payload: {
      adjusted_check_in_time?: string;
      adjusted_check_out_time?: string;
      adjusted_actual_hours: number;
      reason: string;
      manager_signature: string;
    },
  ): Promise<ShiftAdjustmentRecord> {
    // The Attendance drawer is a recording flow (admin attesting to what
    // happened), so we hit /record_attendance/. The backend transparently
    // creates an audit TimeAdjustment when prior values are overwritten.
    return shiftService.recordAttendance(shiftId, payload);
  },

  /**
   * Approve or reject a shift. approved=true flips status → "approved" and
   * locks hours for payroll; false → "rejected". Backend requires a manager
   * signature for approval.
   */
  async approveShift(
    shiftId: number,
    args: { approved: boolean; managerNotes?: string; managerSignature?: string },
  ): Promise<unknown> {
    return shiftService.managerApproval(shiftId, {
      approved: args.approved,
      managerSignature: args.managerSignature ?? "manager",
      managerNotes: args.managerNotes,
    });
  },
};

export default attendanceService;
