/**
 * Staff Attendance Analytics Types
 */

export type PerformanceStatus = 'excellent' | 'good' | 'warning' | 'critical';

export interface StaffAttendanceMetric {
  staffId: number;
  staffName: string;
  staffEmail: string;
  checkInCount: number;
  noShowCount: number;
  lateCount: number;
  totalHoursWorked: number;
  onTimePercentage: number;
  lastShiftDate: string | null;
  status: PerformanceStatus;
}

export interface PeriodComparison {
  checkInsChange: number;
  noShowsChange: number;
  lateChange: number;
  hoursChange: number;
}

export interface AttendanceSummary {
  totalCheckIns: number;
  totalNoShows: number;
  totalLateCheckIns: number;
  totalHoursWorked: number;
  avgHoursPerStaff: number;
  onTimePercentage: number;
  previousPeriodComparison: PeriodComparison;
}

export interface AttendancePagination {
  page: number;
  totalPages: number;
  totalCount: number;
}

export interface AttendanceReport {
  summary: AttendanceSummary;
  staffMetrics: StaffAttendanceMetric[];
  pagination: AttendancePagination;
}

export interface AttendanceReportParams {
  startDate: string;
  endDate: string;
  venueId?: number;
  page?: number;
  pageSize?: number;
}
