// Scheduling shared types + pure formatters.
//
// This began as the prototype's mock dataset. The fixtures are gone: the grid
// is fed by useSchedulingData (resource_timeline + staff-profiles + venues)
// and the unavailability overlay by data/unavailability.ts. Only the shapes
// and the pure helpers those adapters target are left, so the filename stays
// for the ~15 modules importing types from it.

export type ShiftStatus = "draft" | "open" | "assigned" | "in_progress" | "completed";
export type ViolationTier = "soft" | "hard";

export interface Violation {
  tier: ViolationTier;
  code: string;
  msg: string;
}

export interface SchedulingDay {
  d: number;
  date: string;
  day: string;
  dd: string;
  today?: boolean;
  bankHoliday?: string;
}

export interface SchedulingWeek {
  id: string;
  label: string;
  start: string;
  end: string;
  days: SchedulingDay[];
}

export interface SchedulingVenue {
  id: string;
  name: string;
  area: string;
  hue: number;
  req: string;
  color: string;
}

export interface OfficerSia {
  level: string;
  no: string;
  daysLeft: number;
}

export interface SchedulingOfficer {
  id: string;
  name: string;
  role: string;
  sia: OfficerSia;
  hue: number;
  weeklyHrs: number;
  cap: number;
  optOut?: boolean;
}

export type UnavailType = "leave" | "unavailable";

export interface Unavailability {
  officerId: string;
  day: number;
  type: UnavailType;
  reason: string;
}

export interface Shift {
  id: string;
  venueId: string;
  officerId: string | null;
  /** 0–6 within the focused week. */
  day: number;
  start: number;
  end: number;
  published: boolean;
  status: ShiftStatus;
  violations?: Violation[];
  /** ISO yyyy-mm-dd of the shift start. Set by the API adapter so views that
   *  need an absolute date (Month) don't have to convert from `day`. */
  date?: string;
  /** UUID linking shifts that share a multi-officer slot. Adding officers in
   *  edit mode creates new rows with this group. */
  shiftGroup?: string;
  /** ISO timestamp of when the assigned officer checked in. Null/undefined =
   *  not yet checked in. Used by the coverage-alert banner. */
  checkInTime?: string | null;
  /** Per-shift hourly rate override. Null = use the rate hierarchy at calc time. */
  hourlyRate?: number | null;
  /** Whether this shift uses the company special-event pay rate. */
  isSpecialEvent?: boolean;
}

export const HOURS_START = 5;
export const HOURS_END = 29;

// Helpers
export const fmtH = (h: number) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
export const fmtRange = (s: number, e: number) => `${fmtH(s)}–${fmtH(e)}`;
export const hrs = (s: number, e: number) => e - s;

/** Format a decimal-hour duration for display.
 *  Rounds to 2 decimals and trims trailing zeros, so `6.699999999999999` → "6.7"
 *  and `8` → "8" rather than "8.00". */
export const fmtHrs = (h: number): string => {
  const rounded = Math.round(h * 100) / 100;
  return rounded.toString();
};

export interface SiaState {
  tone: "danger" | "warning";
  label: string;
  short: string;
  hard?: boolean;
  soft?: boolean;
}

export function siaState(sia: OfficerSia): SiaState | null {
  if (sia.daysLeft < 0)
    return { tone: "danger", label: `SIA expired ${Math.abs(sia.daysLeft)}d`, short: "Expired", hard: true };
  if (sia.daysLeft <= 14)
    return { tone: "danger", label: `SIA ${sia.daysLeft}d left`, short: `${sia.daysLeft}d`, soft: true };
  if (sia.daysLeft <= 30)
    return { tone: "warning", label: `SIA ${sia.daysLeft}d left`, short: `${sia.daysLeft}d`, soft: true };
  return null;
}
