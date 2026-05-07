// Adapters — translate live API payloads into the existing mock-shaped UI types
// so the rest of the scheduling feature (violation engine, drag-drop handlers,
// row renderers) keeps consuming the same shapes it always has.
//
// Three sources feed in:
//   1. /api/v1/shifts/resource_timeline/?start=…&end=…&group_by=venue
//      → events[] are flattened into Shift[] (decimal-hour day-relative form)
//   2. /api/v1/staff-profiles/?is_approved=true
//      → a small slice mapped onto SchedulingOfficer
//   3. /api/v1/venues/  (via venueService.getAllVenues)
//      → mapped onto SchedulingVenue with deterministic colour
//
// Anything the API doesn't carry (cap, optOut, hue) is derived deterministically
// from a stable id so colours and capacities stay consistent across renders.
import type { Venue } from "../../../types/venue";
import type {
  SchedulingDay,
  SchedulingOfficer,
  SchedulingVenue,
  SchedulingWeek,
  Shift,
  ShiftStatus,
} from "./mocks";

// ── Week helpers ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Mon-anchored week containing the given date. */
export function getWeekForDate(today: Date = new Date()): SchedulingWeek {
  const start = startOfDay(today);
  const dow = (start.getDay() + 6) % 7; // Mon=0..Sun=6
  start.setDate(start.getDate() - dow);
  const end = new Date(start.getTime() + 6 * DAY_MS);

  const todayIso = isoDate(startOfDay(today));
  const days: SchedulingDay[] = WEEKDAY_LABELS.map((label, i) => {
    const date = new Date(start.getTime() + i * DAY_MS);
    const iso = isoDate(date);
    return {
      d: i,
      date: iso,
      day: label,
      dd: String(date.getDate()).padStart(2, "0"),
      today: iso === todayIso || undefined,
    };
  });

  // ISO week number (Mon-anchored, simplified).
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((start.getTime() - yearStart.getTime()) / DAY_MS + yearStart.getDay() + 1) / 7);

  const monthStart = start.toLocaleString("en-GB", { month: "short", day: "2-digit" });
  return {
    id: `W${weekNo}-${start.getFullYear()}`,
    label: `Week ${weekNo} · w/c Mon ${monthStart} ${start.getFullYear()}`,
    start: isoDate(start),
    end: isoDate(end),
    days,
  };
}

/** ISO 8601 boundaries (UTC) for a SchedulingWeek — what the timeline endpoint expects. */
export function weekRangeIso(week: SchedulingWeek): { start: string; end: string } {
  // Use full-day boundaries so shifts spanning midnight are included.
  return {
    start: `${week.start}T00:00:00Z`,
    end: `${week.days[6]?.date ?? week.end}T23:59:59Z`,
  };
}

// ── Month grid (for the navigable Month view) ─────────────────────────────────

export interface MonthCell {
  date: string; // yyyy-mm-dd
  inMonth: boolean;
  today: boolean;
}

export interface MonthGrid {
  /** First-of-month date used for nav, e.g. "2026-04-01". */
  monthStart: string;
  label: string; // "April 2026"
  cells: MonthCell[]; // length 35 or 42 (5 or 6 weeks)
  rangeStart: string; // ISO day (yyyy-mm-dd) of the first cell
  rangeEnd: string;   // ISO day (yyyy-mm-dd) of the last cell
}

/** A 6-row × 7-col Mon-anchored grid covering the month containing `date`. */
export function getMonthGridForDate(date: Date = new Date()): MonthGrid {
  const monthFirst = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthLastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  // Anchor to Mon-of-week-1 of the displayed month.
  const dow = (monthFirst.getDay() + 6) % 7;
  const gridStart = new Date(monthFirst);
  gridStart.setDate(monthFirst.getDate() - dow);

  const todayIso = isoDate(startOfDay(new Date()));
  const cells: MonthCell[] = [];
  // Always render 6 weeks so the grid height is stable as months change.
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart.getTime() + i * DAY_MS);
    const iso = isoDate(cellDate);
    cells.push({
      date: iso,
      inMonth: cellDate.getMonth() === monthFirst.getMonth(),
      today: iso === todayIso,
    });
  }

  const rangeEndDate = new Date(gridStart.getTime() + 41 * DAY_MS);
  const label = monthFirst.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return {
    monthStart: isoDate(monthFirst),
    label,
    cells,
    rangeStart: isoDate(gridStart),
    rangeEnd: isoDate(rangeEndDate),
  };
}

/** Add `delta` months to `date`, anchored on the 1st. Used by Month-view nav. */
export function shiftMonth(date: Date, delta: number): Date {
  const out = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return out;
}

/** Add `deltaDays` to `date`. Used by week-view prev/next nav. */
export function shiftDays(date: Date, deltaDays: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + deltaDays);
  return out;
}

/** Last cell of a month grid (for ISO range boundary). */
export function monthGridRangeIso(grid: MonthGrid): { start: string; end: string } {
  return {
    start: `${grid.rangeStart}T00:00:00Z`,
    end: `${grid.rangeEnd}T23:59:59Z`,
  };
}

// ── Deterministic colours / hues from stable ids ──────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function hueFromId(id: string): number {
  return hashStr(id) % 360;
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// ── Venue ─────────────────────────────────────────────────────────────────────

export function venueFromApi(v: Venue): SchedulingVenue {
  const id = String(v.id ?? v.name);
  const hue = hueFromId(id);
  return {
    id,
    name: v.name,
    area: v.postal_code?.split(" ")[0] ?? v.city ?? "",
    hue,
    req: v.requires_capacity_monitoring
      ? "CCTV"
      : v.requires_fire_safety_checks
        ? "DS"
        : "SG",
    color: hslToHex(hue, 65, 38),
  };
}

// ── Officer (Staff Profile) ───────────────────────────────────────────────────

interface ApiSiaLicense {
  license_type?: string;
  licenseType?: string;
  level?: string;
  expiry_date?: string;
  expiryDate?: string;
  status?: string;
}

interface ApiStaffProfile {
  id: number;
  user?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    email?: string;
    security_roles?: string[] | null;
  };
  firstName?: string;
  lastName?: string;
  username?: string;
  role?: string;
  securityRoles?: string[] | null;
  security_roles?: string[] | null;
  siaLicenses?: ApiSiaLicense[];
  sia_licenses?: ApiSiaLicense[];
  is_approved?: boolean;
  isApproved?: boolean;
}

function fullName(p: ApiStaffProfile): string {
  const first = p.firstName ?? p.user?.first_name ?? "";
  const last = p.lastName ?? p.user?.last_name ?? "";
  const joined = `${first} ${last}`.trim();
  return joined || p.user?.username || p.username || "Unnamed";
}

function pickPrimaryLicense(p: ApiStaffProfile): ApiSiaLicense | undefined {
  const list = p.siaLicenses ?? p.sia_licenses ?? [];
  if (!list.length) return undefined;
  // Prefer valid ones, then most recently expiring.
  const valid = list.filter((l) => (l.status ?? "valid") === "valid");
  const pool = valid.length ? valid : list;
  return [...pool].sort((a, b) => {
    const ad = new Date(a.expiryDate ?? a.expiry_date ?? 0).getTime();
    const bd = new Date(b.expiryDate ?? b.expiry_date ?? 0).getTime();
    return bd - ad;
  })[0];
}

function daysUntil(iso: string | undefined): number {
  if (!iso) return 9999;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return 9999;
  return Math.floor((d - Date.now()) / DAY_MS);
}

function siaLevelCode(license: ApiSiaLicense | undefined): string {
  if (!license) return "—";
  const raw = (license.licenseType ?? license.license_type ?? license.level ?? "").toString().toLowerCase();
  if (raw.startsWith("door") || raw === "ds") return "DS";
  if (raw.startsWith("cctv")) return "CCTV";
  if (raw.startsWith("close") || raw === "cp") return "CP";
  if (raw.startsWith("security") || raw === "sg") return "SG";
  if (raw.startsWith("k9") || raw.includes("dog")) return "K9";
  if (raw.startsWith("vehicle") || raw === "vs") return "VS";
  return raw.toUpperCase().slice(0, 4) || "SG";
}

function roleLabel(p: ApiStaffProfile): string {
  const roles = p.securityRoles ?? p.security_roles ?? p.user?.security_roles ?? null;
  if (Array.isArray(roles) && roles.length) return roles[0];
  if (p.role) return p.role.replace(/_/g, " ");
  return "Officer";
}

export function officerFromApi(p: ApiStaffProfile): SchedulingOfficer {
  const id = `u${p.user?.id ?? p.id}`;
  const license = pickPrimaryLicense(p);
  const sia = {
    level: siaLevelCode(license),
    no: license?.licenseType ? "" : "",
    daysLeft: daysUntil(license?.expiryDate ?? license?.expiry_date),
  };
  return {
    id,
    name: fullName(p),
    role: roleLabel(p),
    sia,
    hue: hueFromId(id),
    weeklyHrs: 0, // Populated from shifts on the client side via officerWeeklyHrs.
    cap: 48, // Default WTR cap; server-side per-officer caps not yet exposed.
    optOut: false,
  };
}

// ── Shift (timeline event → mock-shaped) ──────────────────────────────────────

interface TimelineEvent {
  id: number | string;
  resourceId?: string;
  start: string;
  end: string | null;
  extendedProps?: {
    shiftId?: number;
    venueId?: number;
    venueName?: string;
    staffId?: number | null;
    staffName?: string;
    status?: string;
    isPublished?: boolean;
    requiredRole?: string;
    hourlyRate?: number | string | null;
    isSpecialEvent?: boolean;
    [k: string]: unknown;
  };
}

const STATUS_MAP: Record<string, ShiftStatus> = {
  open: "open",
  scheduled: "assigned",
  active: "in_progress",
  in_progress: "in_progress",
  completed: "completed",
  pending_approval: "assigned",
  approved: "assigned",
  draft: "draft",
};

// Terminal / historical statuses — the planning canvas hides these. They live
// on in the DB and are visible on Attendance / reports, but they aren't drafts
// and shouldn't be editable as if they were.
//
// Note: `no_show` is intentionally NOT in this set. A no-show is operationally
// significant — the manager needs to see it on today's schedule to take
// action (call the officer, dispatch backup, mark present, etc.). The
// auto-no-show flag from `detect_attendance_exceptions` is informational, not
// a reason to make the shift disappear.
const TERMINAL_STATUSES = new Set(["completed", "cancelled", "rejected"]);

function dayIndexFromIso(iso: string, weekStartIso: string): number {
  const start = new Date(`${weekStartIso}T00:00:00`).getTime();
  const ts = new Date(iso).getTime();
  return Math.floor((ts - start) / DAY_MS);
}

function decimalHours(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/**
 * Convert a timeline event into the mock-shaped Shift used by the UI.
 * `rangeStart` is the ISO yyyy-mm-dd anchor used to compute the `day` index;
 * for the week views this is `week.start`, for the month view it's the
 * first cell of the month grid.
 */
export function shiftFromTimelineEvent(
  event: TimelineEvent,
  rangeStart: string,
): Shift | null {
  if (!event.end) return null;
  const day = dayIndexFromIso(event.start, rangeStart);
  if (day < 0) return null;

  const start = decimalHours(event.start);
  let end = decimalHours(event.end);

  // If the shift spans midnight, project end-hour into the same day's frame
  // (e.g. 22:00 → 06:00 becomes 22 → 30).
  const endDay = dayIndexFromIso(event.end, rangeStart);
  if (endDay > day) {
    end += (endDay - day) * 24;
  } else if (end <= start) {
    end += 24;
  }

  const ext = event.extendedProps ?? {};
  const rawStatus = (ext.status ?? "scheduled").toLowerCase();
  if (TERMINAL_STATUSES.has(rawStatus)) return null;
  const status: ShiftStatus = STATUS_MAP[rawStatus] ?? "assigned";
  const published = ext.isPublished ?? rawStatus !== "draft";

  // Open shifts: server sets status="open" and clears staff_user_id.
  const isOpen = status === "open" || ext.staffId == null;

  // Absolute date of the shift's start (yyyy-mm-dd) — useful for views that
  // span multiple weeks, e.g. MonthView.
  const startDate = new Date(event.start);
  const dateIso = isoDate(startOfDay(startDate));

  return {
    id: String(ext.shiftId ?? event.id),
    venueId: ext.venueId != null ? String(ext.venueId) : "",
    officerId: isOpen || ext.staffId == null ? null : `u${ext.staffId}`,
    day,
    start,
    end,
    published,
    status: isOpen ? "open" : status,
    date: dateIso,
    shiftGroup: typeof ext.shiftGroup === "string" ? ext.shiftGroup : undefined,
    checkInTime: typeof ext.checkInTime === "string" ? ext.checkInTime : null,
    hourlyRate:
      ext.hourlyRate == null
        ? null
        : typeof ext.hourlyRate === "number"
          ? ext.hourlyRate
          : Number(ext.hourlyRate) || null,
    isSpecialEvent: ext.isSpecialEvent === true,
  };
}
