// Scheduling mock data — ported 1:1 from project/scheduling-data.jsx.
// Phase 7 ships the visual layer with mocks. Phase 7.5 wires
// schedulerService.getScheduledShifts and the @dnd-kit drag-drop +
// violation engine.

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
  day: number;
  start: number;
  end: number;
  published: boolean;
  status: ShiftStatus;
  violations?: Violation[];
}

export const WEEK: SchedulingWeek = {
  id: "W17-2026",
  label: "Week 17 · w/c Mon 20 Apr 2026",
  start: "2026-04-20",
  end: "2026-04-26",
  days: [
    { d: 0, date: "2026-04-20", day: "Mon", dd: "20" },
    { d: 1, date: "2026-04-21", day: "Tue", dd: "21" },
    { d: 2, date: "2026-04-22", day: "Wed", dd: "22" },
    { d: 3, date: "2026-04-23", day: "Thu", dd: "23", today: true },
    { d: 4, date: "2026-04-24", day: "Fri", dd: "24" },
    { d: 5, date: "2026-04-25", day: "Sat", dd: "25", bankHoliday: "St George's Day (obs.)" },
    { d: 6, date: "2026-04-26", day: "Sun", dd: "26" },
  ],
};

export const VENUES: SchedulingVenue[] = [
  { id: "sba", name: "Southbank Arena", area: "SE1", hue: 12, req: "DS", color: "#cb2431" },
  { id: "khq", name: "Kensington HQ", area: "SW7", hue: 280, req: "CCTV", color: "#5b21b6" },
  { id: "vpk", name: "Victoria Park", area: "E9", hue: 160, req: "SG", color: "#0f766e" },
  { id: "cwf", name: "Canary Wharf", area: "E14", hue: 32, req: "CP", color: "#b45309" },
  { id: "wsf", name: "Westfield Stratford", area: "E20", hue: 210, req: "SG", color: "#1e40af" },
  { id: "rah", name: "Royal Albert Hall", area: "SW7", hue: 340, req: "SG", color: "#9d174d" },
  { id: "dok", name: "Docklands Estate", area: "E16", hue: 245, req: "SG", color: "#3730a3" },
  { id: "shm", name: "Shoreditch Ministry", area: "EC2", hue: 14, req: "DS", color: "#9a3412" },
  { id: "o2g", name: "O2 Greenwich", area: "SE10", hue: 355, req: "SG", color: "#be123c" },
];

export const OFFICERS: SchedulingOfficer[] = [
  { id: "u1", name: "Jordan Okafor", role: "Door Sup.", sia: { level: "DS", no: "1220 7895 2331 4567", daysLeft: 184 }, hue: 12, weeklyHrs: 44, cap: 48 },
  { id: "u2", name: "Priya Shah", role: "Control Room", sia: { level: "CCTV", no: "1220 4423 9912 0011", daysLeft: 402 }, hue: 280, weeklyHrs: 40, cap: 48 },
  { id: "u3", name: "Marcus Bell", role: "Events Steward", sia: { level: "SG", no: "1220 0987 7821 5512", daysLeft: 9 }, hue: 160, weeklyHrs: 46, cap: 48 },
  { id: "u4", name: "Siobhan Clarke", role: "Close Protection", sia: { level: "CP", no: "1220 3311 8867 2290", daysLeft: 221 }, hue: 32, weeklyHrs: 54, cap: 48, optOut: true },
  { id: "u5", name: "Haroon Idris", role: "Retail Guard", sia: { level: "SG", no: "1220 8812 0044 1198", daysLeft: 561 }, hue: 210, weeklyHrs: 40, cap: 48 },
  { id: "u6", name: "Lindiwe Msimang", role: "Front-of-House", sia: { level: "SG", no: "1220 0012 7765 9900", daysLeft: 45 }, hue: 340, weeklyHrs: 30, cap: 48 },
  { id: "u7", name: "Aaron Whitfield", role: "Events Steward", sia: { level: "SG", no: "1220 4498 2235 7781", daysLeft: -3 }, hue: 245, weeklyHrs: 48, cap: 48 },
  { id: "u8", name: "Danielle Roe", role: "Events Steward", sia: { level: "SG", no: "1220 6677 4412 5500", daysLeft: 298 }, hue: 90, weeklyHrs: 24, cap: 48 },
  { id: "u9", name: "Tomasz Krawczyk", role: "Door Sup.", sia: { level: "DS", no: "1220 5523 8890 1129", daysLeft: 133 }, hue: 14, weeklyHrs: 32, cap: 48 },
  { id: "u10", name: "Esi Mensah", role: "Control Room", sia: { level: "CCTV", no: "1220 0055 7711 3388", daysLeft: 512 }, hue: 310, weeklyHrs: 40, cap: 48 },
  { id: "u11", name: "Callum Drew", role: "Retail Guard", sia: { level: "SG", no: "1220 9988 6655 2211", daysLeft: 77 }, hue: 196, weeklyHrs: 42, cap: 48 },
  { id: "u12", name: "Farida Hassan", role: "Events Steward", sia: { level: "SG", no: "1220 3344 7788 9900", daysLeft: 612 }, hue: 355, weeklyHrs: 32, cap: 48 },
];

export const UNAVAIL: Unavailability[] = [
  { officerId: "u2", day: 3, type: "leave", reason: "Approved annual leave · 3d" },
  { officerId: "u8", day: 5, type: "unavailable", reason: "Contractor unavailable" },
  { officerId: "u10", day: 4, type: "leave", reason: "Approved annual leave" },
];

export const SHIFTS: Shift[] = [
  // Monday
  { id: "s01", venueId: "sba", officerId: "u1", day: 0, start: 14, end: 22, published: true, status: "assigned" },
  { id: "s02", venueId: "khq", officerId: "u2", day: 0, start: 9, end: 17, published: true, status: "assigned" },
  { id: "s03", venueId: "vpk", officerId: "u3", day: 0, start: 9, end: 17, published: true, status: "assigned" },
  { id: "s04", venueId: "cwf", officerId: "u4", day: 0, start: 7, end: 19, published: true, status: "assigned" },
  { id: "s05", venueId: "wsf", officerId: "u5", day: 0, start: 10, end: 18, published: true, status: "assigned" },
  { id: "s06", venueId: "dok", officerId: "u7", day: 0, start: 18, end: 26, published: true, status: "assigned" },
  { id: "s07", venueId: "shm", officerId: "u9", day: 0, start: 20, end: 28, published: true, status: "assigned" },
  // Tuesday
  { id: "s10", venueId: "sba", officerId: "u1", day: 1, start: 14, end: 22, published: true, status: "assigned" },
  { id: "s11", venueId: "khq", officerId: "u2", day: 1, start: 9, end: 17, published: true, status: "assigned" },
  { id: "s12", venueId: "vpk", officerId: "u3", day: 1, start: 9, end: 17, published: true, status: "assigned" },
  { id: "s13", venueId: "cwf", officerId: "u4", day: 1, start: 7, end: 19, published: true, status: "assigned" },
  { id: "s14", venueId: "wsf", officerId: "u11", day: 1, start: 10, end: 18, published: true, status: "assigned" },
  { id: "s15", venueId: "dok", officerId: "u7", day: 1, start: 18, end: 26, published: true, status: "assigned" },
  { id: "s16", venueId: "o2g", officerId: null, day: 1, start: 17, end: 23, published: true, status: "open" },
  // Wednesday
  { id: "s20", venueId: "sba", officerId: "u1", day: 2, start: 14, end: 22, published: true, status: "assigned" },
  { id: "s21", venueId: "khq", officerId: "u2", day: 2, start: 9, end: 17, published: true, status: "assigned" },
  { id: "s22", venueId: "vpk", officerId: "u3", day: 2, start: 9, end: 19, published: true, status: "assigned" },
  { id: "s23", venueId: "cwf", officerId: "u4", day: 2, start: 7, end: 21, published: true, status: "assigned",
    violations: [{ tier: "soft", code: "OT1", msg: "14h shift → OT tier 1 will apply after 10h" }] },
  { id: "s24", venueId: "rah", officerId: "u6", day: 2, start: 18, end: 23, published: true, status: "assigned" },
  { id: "s25", venueId: "shm", officerId: "u9", day: 2, start: 20, end: 28, published: true, status: "assigned" },
  // Thursday (today)
  { id: "s30", venueId: "sba", officerId: "u1", day: 3, start: 14, end: 22, published: true, status: "assigned" },
  { id: "s31", venueId: "khq", officerId: "u2", day: 3, start: 9, end: 17, published: false, status: "draft",
    violations: [{ tier: "hard", code: "LEAVE", msg: "Priya is on approved annual leave" }] },
  { id: "s32", venueId: "vpk", officerId: "u3", day: 3, start: 9, end: 17, published: true, status: "assigned",
    violations: [{ tier: "soft", code: "SIA", msg: "Marcus's SIA expires in 9 days — renew before next week" }] },
  { id: "s33", venueId: "cwf", officerId: "u4", day: 3, start: 5, end: 11, published: false, status: "draft",
    violations: [{ tier: "soft", code: "OT2", msg: "Over 48h cap this week — WTR opt-out on file" }] },
  { id: "s34", venueId: "wsf", officerId: "u11", day: 3, start: 10, end: 18, published: true, status: "assigned" },
  { id: "s35", venueId: "dok", officerId: "u7", day: 3, start: 18, end: 26, published: false, status: "draft",
    violations: [{ tier: "hard", code: "SIA_EXP", msg: "Aaron's SIA expired 3 days ago — cannot assign" }] },
  { id: "s36", venueId: "o2g", officerId: null, day: 3, start: 17, end: 23, published: false, status: "open" },
  { id: "s37", venueId: "rah", officerId: null, day: 3, start: 18, end: 23, published: false, status: "open" },
  { id: "s38", venueId: "shm", officerId: "u9", day: 3, start: 20, end: 28, published: false, status: "draft" },
  // Friday (BH)
  { id: "s40", venueId: "sba", officerId: "u1", day: 4, start: 14, end: 22, published: false, status: "draft" },
  { id: "s41", venueId: "vpk", officerId: "u3", day: 4, start: 9, end: 19, published: false, status: "draft",
    violations: [{ tier: "soft", code: "SIA", msg: "Marcus's SIA expires in 9 days" }, { tier: "soft", code: "BH", msg: "Bank holiday uplift will apply" }] },
  { id: "s42", venueId: "cwf", officerId: "u4", day: 4, start: 7, end: 15, published: false, status: "draft" },
  { id: "s43", venueId: "rah", officerId: "u6", day: 4, start: 18, end: 23, published: false, status: "draft" },
  { id: "s44", venueId: "khq", officerId: null, day: 4, start: 9, end: 17, published: false, status: "open" },
  { id: "s45", venueId: "shm", officerId: null, day: 4, start: 20, end: 28, published: false, status: "open" },
  { id: "s46", venueId: "wsf", officerId: null, day: 4, start: 10, end: 18, published: false, status: "open" },
  // Saturday
  { id: "s50", venueId: "vpk", officerId: "u3", day: 5, start: 10, end: 18, published: false, status: "draft" },
  { id: "s51", venueId: "vpk", officerId: "u8", day: 5, start: 10, end: 18, published: false, status: "draft",
    violations: [{ tier: "hard", code: "UNAVAIL", msg: "Danielle marked unavailable for Sat" }] },
  { id: "s52", venueId: "o2g", officerId: "u12", day: 5, start: 17, end: 27, published: false, status: "draft" },
  { id: "s53", venueId: "dok", officerId: "u7", day: 5, start: 18, end: 24, published: false, status: "draft" },
  { id: "s54", venueId: "sba", officerId: null, day: 5, start: 14, end: 22, published: false, status: "open" },
  // Sunday
  { id: "s60", venueId: "khq", officerId: "u10", day: 6, start: 9, end: 17, published: false, status: "draft" },
  { id: "s61", venueId: "dok", officerId: "u7", day: 6, start: 22, end: 26, published: false, status: "draft",
    violations: [{ tier: "soft", code: "REST", msg: "Less than 11h rest since previous shift" }] },
];

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

export const shiftsByDay = (day: number) => SHIFTS.filter((s) => s.day === day);

export const officerWeeklyHrs = (oid: string) =>
  SHIFTS.filter((s) => s.officerId === oid && s.status !== "open").reduce(
    (sum, s) => sum + (s.end - s.start),
    0,
  );

export const venueById = (id: string) => VENUES.find((v) => v.id === id);
export const officerById = (id: string | null) =>
  id ? OFFICERS.find((o) => o.id === id) : undefined;

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

export const WEEK_COUNTS = {
  total: SHIFTS.length,
  published: SHIFTS.filter((s) => s.published).length,
  draft: SHIFTS.filter((s) => !s.published && s.status === "draft").length,
  open: SHIFTS.filter((s) => s.status === "open").length,
  hardViols: SHIFTS.filter((s) => (s.violations || []).some((v) => v.tier === "hard")).length,
  softViols: SHIFTS.filter((s) => (s.violations || []).some((v) => v.tier === "soft")).length,
  siaExpired: OFFICERS.filter((o) => o.sia.daysLeft < 0).length,
  siaSoon: OFFICERS.filter((o) => o.sia.daysLeft >= 0 && o.sia.daysLeft <= 30).length,
};
