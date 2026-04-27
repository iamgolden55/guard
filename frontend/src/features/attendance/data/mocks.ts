// Attendance mock data — ported 1:1 from project/attendance-data.jsx.
// Phase 4 ships with mocks for visual review parity. Phase 4.5 wires
// real shiftService calls.

export type ShiftStatus =
  | "on_duty"
  | "completed"
  | "pending_approval"
  | "approved"
  | "no_show"
  | "late"
  | "early_out"
  | "missing_out"
  | "upcoming"
  | "geofence_fail";

export type SiaCode = "DS" | "CCTV" | "SG" | "CP";

export interface AttendanceVenue {
  id: string;
  name: string;
  area: string;
  hue: number;
  geofence: boolean;
  radius: number;
}

export interface AttendanceOfficer {
  id: string;
  name: string;
  role: string;
  sia: SiaCode;
  hue: number;
}

export interface AttendanceShift {
  id: string;
  oid: string | null;
  vid: string;
  sch_start: number;
  sch_end: number;
  act_start: number | null;
  act_end: number | null;
  status: ShiftStatus;
  late_min?: number;
  early_min?: number;
  photo?: boolean;
  gps_ok?: boolean | null;
  dist_m?: number;
  patrol?: [number, number];
  breaks?: number;
  was_late?: boolean;
  geofence_fail?: boolean;
  open?: boolean;
  note?: string;
}

export interface ShiftAdjustment {
  at: string;
  by: string;
  field: string;
  from: string;
  to: string;
  reason: string;
}

export interface WeekDay {
  d: number;
  label: string;
  date: string;
  today?: boolean;
  bh?: boolean;
}

export type CellStatus =
  | "ok"
  | "approved"
  | "pending"
  | "late"
  | "early"
  | "noshow"
  | "missing"
  | "geofence"
  | "absent"
  | "future";

export interface DayCellData {
  sch: number;
  act: number;
  status: CellStatus;
}

export type TimesheetStatus = "ready" | "review" | "blocked" | "approved";

export interface TimesheetRow {
  oid: string;
  scheduled: number;
  actual: number;
  variance: number;
  status: TimesheetStatus;
  flags: { late: number; early: number; noshow: number; missing: number; geofence: number };
  days: DayCellData[];
}

// "Now" reference — Thursday 23 Apr 2026, 14:42
export const NOW_HOUR = 14 + 42 / 60;
export const NOW_LABEL = "14:42";
export const TODAY_LABEL = "Thursday 23 April 2026";
export const TODAY_ISO = "2026-04-23";

export const A_VENUES: AttendanceVenue[] = [
  { id: "sba", name: "Southbank Arena", area: "SE1", hue: 12, geofence: true, radius: 150 },
  { id: "khq", name: "Kensington HQ", area: "SW7", hue: 280, geofence: true, radius: 120 },
  { id: "vpk", name: "Victoria Park", area: "E9", hue: 160, geofence: true, radius: 250 },
  { id: "cwf", name: "Canary Wharf", area: "E14", hue: 32, geofence: true, radius: 100 },
  { id: "wsf", name: "Westfield Stratford", area: "E20", hue: 210, geofence: true, radius: 180 },
  { id: "rah", name: "Royal Albert Hall", area: "SW7", hue: 340, geofence: true, radius: 130 },
  { id: "dok", name: "Docklands Estate", area: "E16", hue: 245, geofence: true, radius: 200 },
  { id: "shm", name: "Shoreditch Ministry", area: "EC2", hue: 14, geofence: true, radius: 110 },
  { id: "o2g", name: "O2 Greenwich", area: "SE10", hue: 355, geofence: true, radius: 220 },
];

export const A_OFFICERS: AttendanceOfficer[] = [
  { id: "u1", name: "Jordan Okafor", role: "Door Sup.", sia: "DS", hue: 12 },
  { id: "u2", name: "Priya Shah", role: "Control Room", sia: "CCTV", hue: 280 },
  { id: "u3", name: "Marcus Bell", role: "Events Steward", sia: "SG", hue: 160 },
  { id: "u4", name: "Siobhan Clarke", role: "Close Protection", sia: "CP", hue: 32 },
  { id: "u5", name: "Haroon Idris", role: "Retail Guard", sia: "SG", hue: 210 },
  { id: "u6", name: "Lindiwe Msimang", role: "Front-of-House", sia: "SG", hue: 340 },
  { id: "u7", name: "Aaron Whitfield", role: "Events Steward", sia: "SG", hue: 245 },
  { id: "u8", name: "Danielle Roe", role: "Events Steward", sia: "SG", hue: 90 },
  { id: "u9", name: "Tomasz Krawczyk", role: "Door Sup.", sia: "DS", hue: 14 },
  { id: "u10", name: "Esi Mensah", role: "Control Room", sia: "CCTV", hue: 310 },
  { id: "u11", name: "Callum Drew", role: "Retail Guard", sia: "SG", hue: 196 },
  { id: "u12", name: "Farida Hassan", role: "Events Steward", sia: "SG", hue: 355 },
];

export const SHIFTS_TODAY: AttendanceShift[] = [
  // ON DUTY
  { id: "t01", oid: "u1", vid: "sba", sch_start: 14, sch_end: 22, act_start: 14.0, act_end: null, status: "on_duty", late_min: 0, photo: true, gps_ok: true, dist_m: 14, patrol: [3, 4], breaks: 0 },
  { id: "t02", oid: "u2", vid: "khq", sch_start: 9, sch_end: 17, act_start: 9.05, act_end: null, status: "on_duty", late_min: 3, photo: true, gps_ok: true, dist_m: 22, patrol: [6, 8], breaks: 1 },
  { id: "t03", oid: "u3", vid: "vpk", sch_start: 9, sch_end: 17, act_start: 9.2, act_end: null, status: "on_duty", late_min: 12, photo: true, gps_ok: true, dist_m: 78, patrol: [4, 6], breaks: 1 },
  { id: "t04", oid: "u4", vid: "cwf", sch_start: 7, sch_end: 19, act_start: 6.95, act_end: null, status: "on_duty", late_min: -3, photo: true, gps_ok: true, dist_m: 9, patrol: [9, 12], breaks: 2 },
  { id: "t05", oid: "u5", vid: "wsf", sch_start: 10, sch_end: 18, act_start: 10.0, act_end: null, status: "on_duty", late_min: 0, photo: true, gps_ok: true, dist_m: 41, patrol: [5, 6], breaks: 1 },
  { id: "t06", oid: "u11", vid: "wsf", sch_start: 10, sch_end: 18, act_start: 10.5, act_end: null, status: "on_duty", late_min: 28, photo: true, gps_ok: true, dist_m: 38, patrol: [4, 6], breaks: 1, was_late: true },
  { id: "t07", oid: "u9", vid: "shm", sch_start: 14, sch_end: 22, act_start: 14.1, act_end: null, status: "on_duty", late_min: 6, photo: true, gps_ok: true, dist_m: 18, patrol: [1, 4], breaks: 0 },

  // EXCEPTIONS
  { id: "t10", oid: "u7", vid: "dok", sch_start: 6, sch_end: 14, act_start: null, act_end: null, status: "no_show", late_min: 522, photo: false, gps_ok: null, note: "Tried calling 3×, voicemail. Backup officer dispatched 14:05." },
  { id: "t11", oid: "u6", vid: "rah", sch_start: 10, sch_end: 14, act_start: 10.2, act_end: null, status: "missing_out", late_min: 12, photo: true, gps_ok: true, dist_m: 33, patrol: [3, 4], breaks: 1, note: "Shift ended 42 min ago — no check-out. Auto-checkout in 18 min." },
  { id: "t12", oid: "u12", vid: "o2g", sch_start: 11, sch_end: 19, act_start: 11.05, act_end: null, status: "on_duty", late_min: 3, photo: true, gps_ok: false, dist_m: 412, patrol: [2, 5], breaks: 1, geofence_fail: true, note: "Checked in 412m from venue boundary. Manager pinged for confirmation." },

  // COMPLETED earlier today
  { id: "t20", oid: "u8", vid: "vpk", sch_start: 5, sch_end: 11, act_start: 5.02, act_end: 11.05, status: "pending_approval", late_min: 1, photo: true, gps_ok: true, dist_m: 28, patrol: [4, 4], breaks: 1 },
  { id: "t21", oid: "u10", vid: "khq", sch_start: 5, sch_end: 9, act_start: 5.0, act_end: 8.4, status: "early_out", late_min: 0, early_min: 36, photo: true, gps_ok: true, dist_m: 19, patrol: [3, 3], breaks: 0, note: "Officer left early, cited equipment fault. Awaiting manager review." },

  // UPCOMING
  { id: "t30", oid: "u9", vid: "dok", sch_start: 18, sch_end: 26, act_start: null, act_end: null, status: "upcoming" },
  { id: "t31", oid: null, vid: "rah", sch_start: 18, sch_end: 23, act_start: null, act_end: null, status: "upcoming", open: true },
  { id: "t32", oid: "u3", vid: "shm", sch_start: 20, sch_end: 28, act_start: null, act_end: null, status: "upcoming" },
  { id: "t33", oid: null, vid: "o2g", sch_start: 17, sch_end: 23, act_start: null, act_end: null, status: "upcoming", open: true },
];

export const ADJUSTMENTS: Record<string, ShiftAdjustment[]> = {
  t06: [
    {
      at: "2026-04-23T11:14:00",
      by: "Maya Chen (Manager)",
      field: "check_in_time",
      from: "10:30",
      to: "10:30",
      reason: "Officer reported app would not load — confirmed via radio at 10:32.",
    },
  ],
  t21: [
    {
      at: "2026-04-23T08:55:00",
      by: "Maya Chen (Manager)",
      field: "check_out_time",
      from: "08:40",
      to: "08:40",
      reason: "Faulty fire-panel forced site closure. Approved early dismissal.",
    },
  ],
};

export const WEEK_DAYS: WeekDay[] = [
  { d: 0, label: "Mon", date: "20" },
  { d: 1, label: "Tue", date: "21" },
  { d: 2, label: "Wed", date: "22" },
  { d: 3, label: "Thu", date: "23", today: true },
  { d: 4, label: "Fri", date: "24" },
  { d: 5, label: "Sat", date: "25", bh: true },
  { d: 6, label: "Sun", date: "26" },
];

const dc = (sch: number, act: number, status: CellStatus): DayCellData => ({ sch, act, status });

export const TIMESHEETS: TimesheetRow[] = [
  { oid: "u1", scheduled: 32, actual: 31.92, variance: -0.08, status: "ready", flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 7.92, "pending"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u2", scheduled: 32, actual: 31.85, variance: -0.15, status: "ready", flags: { late: 1, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 7.85, "pending"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u3", scheduled: 34, actual: 33.55, variance: -0.45, status: "review", flags: { late: 2, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(8, 8, "approved"), dc(8, 8, "approved"), dc(10, 9.83, "late"), dc(8, 7.72, "late"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u4", scheduled: 48, actual: 48.05, variance: 0.05, status: "ready", flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(12, 12, "approved"), dc(12, 12, "approved"), dc(12, 12.05, "approved"), dc(12, 12, "pending"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u5", scheduled: 32, actual: 32.08, variance: 0.08, status: "ready", flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(8, 8.08, "approved"), dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 8, "pending"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u6", scheduled: 16, actual: 8.3, variance: -7.7, status: "review", flags: { late: 0, early: 0, noshow: 0, missing: 1, geofence: 0 }, days: [dc(0, 0, "absent"), dc(0, 0, "absent"), dc(8, 8, "approved"), dc(4, 0.3, "missing"), dc(0, 0, "future"), dc(4, 0, "future"), dc(0, 0, "future")] },
  { oid: "u7", scheduled: 40, actual: 24.0, variance: -16.0, status: "blocked", flags: { late: 0, early: 0, noshow: 1, missing: 0, geofence: 0 }, days: [dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 0, "noshow"), dc(0, 0, "future"), dc(8, 0, "future"), dc(0, 0, "future")] },
  { oid: "u8", scheduled: 24, actual: 24.05, variance: 0.05, status: "review", flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(6, 6, "approved"), dc(6, 6.05, "approved"), dc(6, 6, "approved"), dc(6, 6, "pending"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u9", scheduled: 32, actual: 31.9, variance: -0.1, status: "ready", flags: { late: 1, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 7.9, "late"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u10", scheduled: 16, actual: 11.4, variance: -4.6, status: "review", flags: { late: 0, early: 1, noshow: 0, missing: 0, geofence: 0 }, days: [dc(4, 4, "approved"), dc(4, 4, "approved"), dc(4, 4, "approved"), dc(4, 3.4, "early"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u11", scheduled: 32, actual: 31.5, variance: -0.5, status: "review", flags: { late: 1, early: 0, noshow: 0, missing: 0, geofence: 0 }, days: [dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 8, "approved"), dc(8, 7.5, "late"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
  { oid: "u12", scheduled: 24, actual: 23.95, variance: -0.05, status: "blocked", flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 1 }, days: [dc(8, 8, "approved"), dc(8, 8, "approved"), dc(0, 0, "absent"), dc(8, 7.95, "geofence"), dc(0, 0, "future"), dc(0, 0, "future"), dc(0, 0, "future")] },
];

// Helpers
export const officerById = (id: string | null | undefined) =>
  id ? A_OFFICERS.find((o) => o.id === id) : undefined;
export const venueById = (id: string) => A_VENUES.find((v) => v.id === id);

export function fmtHr(h: number | null | undefined): string {
  if (h == null) return "—";
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const fmtRange2 = (s: number, e: number) => `${fmtHr(s)} – ${fmtHr(e)}`;

export function fmtVar(m: number): string {
  if (!m) return "on time";
  const sign = m > 0 ? "+" : "−";
  const abs = Math.abs(m);
  if (abs < 60) return `${sign}${abs}m`;
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${h}h${mm ? ` ${mm}m` : ""}`;
}

export function fmtH2(h: number): string {
  if (!h) return "—";
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  return `${whole}h ${String(min).padStart(2, "0")}m`;
}

// Derived helpers
export const liveShifts = SHIFTS_TODAY.filter(
  (s) => s.status === "on_duty" || s.status === "missing_out",
);

export const exceptionShifts = SHIFTS_TODAY.filter(
  (s) =>
    s.status === "no_show" ||
    s.status === "missing_out" ||
    s.geofence_fail ||
    s.status === "early_out" ||
    s.was_late ||
    (s.late_min ?? 0) >= 10,
);

export const ATT_STATS = {
  on_duty: SHIFTS_TODAY.filter((s) => s.status === "on_duty").length,
  pending: SHIFTS_TODAY.filter((s) => s.status === "pending_approval" || s.status === "early_out").length,
  exceptions: exceptionShifts.length,
  no_show: SHIFTS_TODAY.filter((s) => s.status === "no_show").length,
  missing_out: SHIFTS_TODAY.filter((s) => s.status === "missing_out").length,
  geofence: SHIFTS_TODAY.filter((s) => s.geofence_fail).length,
  late: SHIFTS_TODAY.filter((s) => (s.late_min ?? 0) >= 10).length,
  early_out: SHIFTS_TODAY.filter((s) => s.status === "early_out").length,
  expected_so_far: 11,
  showed_up: 9,
};

export type RibbonKey =
  | "on_duty"
  | "late"
  | "early_out"
  | "pending"
  | "no_show"
  | "missing_out"
  | "geofence"
  | "upcoming";

export function ribbonKey(s: AttendanceShift): RibbonKey {
  if (s.status === "no_show") return "no_show";
  if (s.status === "missing_out") return "missing_out";
  if (s.geofence_fail) return "geofence";
  if (s.status === "early_out") return "early_out";
  if (s.status === "pending_approval") return "pending";
  if (s.status === "upcoming") return "upcoming";
  if ((s.late_min ?? 0) >= 10 && s.status === "on_duty") return "late";
  if (s.was_late) return "late";
  return "on_duty";
}

export const RIBBON_COLORS: Record<RibbonKey, { bg: string; glow: string }> = {
  on_duty: { bg: "#0f9d58", glow: "rgba(15,157,88,0.35)" },
  late: { bg: "#d97706", glow: "rgba(217,119,6,0.35)" },
  early_out: { bg: "#d97706", glow: "rgba(217,119,6,0.30)" },
  pending: { bg: "#a19f9d", glow: "rgba(161,159,157,0.25)" },
  no_show: { bg: "#cb2431", glow: "rgba(203,36,49,0.40)" },
  missing_out: { bg: "#cb2431", glow: "rgba(203,36,49,0.30)" },
  geofence: { bg: "#6d28d9", glow: "rgba(109,40,217,0.30)" },
  upcoming: { bg: "transparent", glow: "transparent" },
};

export const SCHEDULED_BG = "rgba(96, 94, 92, 0.18)";
export const SCHEDULED_BORDER = "rgba(96, 94, 92, 0.35)";
