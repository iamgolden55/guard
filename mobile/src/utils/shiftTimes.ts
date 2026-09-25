/**
 * Date/time helpers for the manager shift forms (create + edit).
 *
 * Security shifts routinely cross midnight (18:00 → 01:00), so picking an
 * end *time* means "the next time the clock reads this after the start",
 * not "this time on whatever date the end happened to be on".
 */

/** End = first occurrence of `picked`'s clock time strictly after `start`. */
export const applyEndTimeOfDay = (start: Date, picked: Date): Date => {
  const end = new Date(start);
  end.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  return end;
};

/** Move `base` onto `picked`'s calendar day, keeping its clock time. */
export const applyDate = (base: Date, picked: Date): Date => {
  const next = new Date(base);
  next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return next;
};

/** Move `base` to `picked`'s clock time on the same day. */
export const applyTimeOfDay = (base: Date, picked: Date): Date => {
  const next = new Date(base);
  next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return next;
};

/** New end after the start moves, keeping the shift's length. */
export const shiftEndWithStart = (
  oldStart: Date,
  newStart: Date,
  end: Date,
): Date => new Date(end.getTime() + (newStart.getTime() - oldStart.getTime()));

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "7h · overnight", "8h 30m", or '' when the range is invalid. */
export const describeShiftSpan = (start: Date, end: Date): string => {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const length = m ? `${h}h ${m}m` : `${h}h`;
  return sameDay(start, end) ? length : `${length} · overnight`;
};
