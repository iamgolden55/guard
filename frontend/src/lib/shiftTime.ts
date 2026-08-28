/**
 * Shift time helpers.
 *
 * Shifts routinely run past midnight, but the UI collects times as bare
 * "HH:mm" strings with no date attached. Every surface that turns those back
 * into timestamps therefore has to decide for itself whether the end belongs
 * to the next calendar day — and each one that reinvented the rule got it
 * slightly differently, or forgot it entirely. The Attendance editor forgot,
 * so recording an 18:00 → 03:00 shift produced a check-out nine hours before
 * the check-in and the save was rejected outright.
 */

/** Minutes since local midnight for an "HH:mm" string. NaN-safe. */
function minutesOfDay(timeHHmm: string): number {
  const [h, m] = timeHHmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Does a shift running `startHHmm` → `endHHmm` cross midnight?
 *
 * Equal times count as crossing: 20:00 → 20:00 is a 24-hour shift, not a
 * zero-length one. Callers that consider identical times invalid should
 * reject them before asking.
 */
export function crossesMidnight(startHHmm: string, endHHmm: string): boolean {
  return minutesOfDay(endHHmm) <= minutesOfDay(startHHmm);
}

/** Advance a yyyy-mm-dd date string by one day, rolling month and year. */
export function addOneDay(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  // Day overflow in the Date constructor handles 31 Dec → 1 Jan. Built from
  // local parts rather than parsing the string, which Date treats as UTC and
  // would shift by the timezone offset.
  const next = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1);
  return toDateIso(next);
}

/** Format a Date as yyyy-mm-dd in local time. */
export function toDateIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Combine a yyyy-mm-dd date + "HH:mm" time into a Date in the local zone. */
export function localDateTime(dateIso: string, timeHHmm: string): Date {
  const [yyyy, mm, dd] = dateIso.split("-").map(Number);
  const [hh, mins] = timeHHmm.split(":").map(Number);
  return new Date(
    yyyy ?? 1970,
    (mm ?? 1) - 1,
    dd ?? 1,
    hh ?? 0,
    mins ?? 0,
    0,
    0,
  );
}

/** Combine a yyyy-mm-dd date + "HH:mm" time into an ISO datetime, local TZ. */
export function localDateTimeToIso(dateIso: string, timeHHmm: string): string {
  return localDateTime(dateIso, timeHHmm).toISOString();
}

/**
 * Resolve a start/end time pair anchored to a start date into two Dates,
 * pushing the end onto the next day when the pair crosses midnight.
 */
export function resolveShiftRange(
  startDateIso: string,
  startHHmm: string,
  endHHmm: string,
): { start: Date; end: Date; endsNextDay: boolean } {
  const endsNextDay = crossesMidnight(startHHmm, endHHmm);
  const endDateIso = endsNextDay ? addOneDay(startDateIso) : startDateIso;
  return {
    start: localDateTime(startDateIso, startHHmm),
    end: localDateTime(endDateIso, endHHmm),
    endsNextDay,
  };
}
