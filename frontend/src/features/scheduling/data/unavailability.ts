// Real officer unavailability for the visible scheduling range.
//
// This used to come from `UNAVAIL` in data/mocks.ts — three hardcoded rows
// keyed on officer ids "u2", "u8" and "u10". Officer ids are built as
// `u${user.id}` (see adapters.officerFromApi), so on a live database those
// rows matched whichever real people happened to own user ids 2, 8 and 10:
// the grid showed them on "approved annual leave" every week, and the
// violation engine hard-blocked assigning them on those weekdays.
//
// Two endpoints carry the real thing, both scoped to the caller's company and
// both keyed by user id:
//   GET /api/v1/contractor-unavailability/   → self-declared unavailable dates
//   GET /api/v1/leave/requests/?status=approved → approved annual leave
//
// The leave list endpoint has no server-side date filter (its filterset is
// status/leave_type/staff_user/emergency), so the range overlap is applied
// here.
import api from "../../../services/api";
import leaveService from "../../../services/leaveService";
import { LeaveRequestStatus } from "../../../types/leave";
import type { Unavailability } from "./mocks";

interface ApiContractorUnavailability {
  id: number;
  staff_user: number;
  start_date: string; // yyyy-mm-dd
  end_date: string; // yyyy-mm-dd
  reason?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a yyyy-mm-dd date as local midnight (not UTC — `new Date("2026-04-23")`
 *  is UTC midnight, which lands on the previous day west of Greenwich). */
function parseIsoDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Expand a [start, end] inclusive date span into per-day offsets from
 * `anchorIso`, keeping only the days that land inside the visible range.
 */
function daysInRange(
  startIso: string,
  endIso: string,
  anchorIso: string,
  dayCount: number,
): number[] {
  const anchor = parseIsoDay(anchorIso);
  const start = parseIsoDay(startIso);
  const end = parseIsoDay(endIso ?? startIso) ?? start;
  if (!anchor || !start || !end) return [];

  const first = Math.round((start.getTime() - anchor.getTime()) / DAY_MS);
  const last = Math.round((end.getTime() - anchor.getTime()) / DAY_MS);
  const out: number[] = [];
  for (let d = Math.max(0, first); d <= Math.min(dayCount - 1, last); d++) {
    out.push(d);
  }
  return out;
}

export interface FetchUnavailabilityArgs {
  /** yyyy-mm-dd of day 0 in the current view. */
  anchorIso: string;
  /** Number of day columns in the current view (7 for a week, up to 42 month). */
  dayCount: number;
  /** yyyy-mm-dd of the last day in the current view. */
  endIso: string;
}

/**
 * Both sources are best-effort: a staff-role user can't read the whole
 * company's leave, and the scheduling grid is still useful without the
 * overlay. A rejected request degrades to "no known unavailability" rather
 * than failing the page.
 */
export async function fetchUnavailability({
  anchorIso,
  dayCount,
  endIso,
}: FetchUnavailabilityArgs): Promise<Unavailability[]> {
  const out: Unavailability[] = [];

  const [contractor, leave] = await Promise.allSettled([
    api.get<ApiContractorUnavailability[] | { results?: ApiContractorUnavailability[] }>(
      "/api/v1/contractor-unavailability/?page_size=500",
    ),
    leaveService.getLeaveRequests(
      { status: [LeaveRequestStatus.APPROVED] },
      1,
      500,
    ),
  ]);

  if (contractor.status === "fulfilled") {
    const body = contractor.value.data;
    const rows = Array.isArray(body) ? body : (body?.results ?? []);
    for (const row of rows) {
      if (row.staff_user == null) continue;
      for (const day of daysInRange(
        row.start_date,
        row.end_date,
        anchorIso,
        dayCount,
      )) {
        out.push({
          officerId: `u${row.staff_user}`,
          day,
          type: "unavailable",
          reason: row.reason?.trim() || "Marked unavailable",
        });
      }
    }
  }

  if (leave.status === "fulfilled") {
    const rows = leave.value?.results ?? [];
    for (const req of rows) {
      const userId = req.user?.id ?? (req as unknown as { staff_user?: number }).staff_user;
      if (userId == null) continue;
      // Cheap pre-filter before expanding — the endpoint returns every
      // approved request for the company, not just this week's.
      if (req.end_date < anchorIso || req.start_date > endIso) continue;
      for (const day of daysInRange(
        req.start_date,
        req.end_date,
        anchorIso,
        dayCount,
      )) {
        out.push({
          officerId: `u${userId}`,
          day,
          type: "leave",
          reason: req.leave_type?.name
            ? `Approved ${req.leave_type.name.toLowerCase()}`
            : "Approved leave",
        });
      }
    }
  }

  return out;
}

/** First match for an officer on a given day column, or undefined. */
export function unavailabilityFor(
  list: Unavailability[],
  officerId: string,
  day: number,
): Unavailability | undefined {
  return list.find((u) => u.officerId === officerId && u.day === day);
}
