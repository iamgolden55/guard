// Violation engine — pure functions, no React, no side effects.
// Input: officer + target shift + the current shifts list.
// Output: ordered list of violations (hard before soft).
//
// This is deliberately runtime-only — it doesn't talk to the backend.
// In Phase 7.6 these checks become a TanStack mutation pre-flight that
// also calls complianceService.getStaffCompliance(staffId) for the
// authoritative WorkingHoursRegulation values.
import {
  officerWeeklyHrs,
  type SchedulingOfficer,
  type Shift,
  type Violation,
  UNAVAIL,
  WEEK,
} from "../data/mocks";

export interface AssignmentCheck {
  ok: boolean;
  hard: Violation[];
  soft: Violation[];
  /** Combined list, hard first, suitable for the drawer/toast. */
  all: Violation[];
}

const MIN_REST_HOURS = 11;

/**
 * Run the full violation check for assigning `officer` to `shift`.
 * `allShifts` is the current canvas state (so weekly hours include
 * pending assignments).
 */
export function checkAssignment(
  officer: SchedulingOfficer,
  shift: Shift,
  allShifts: Shift[],
): AssignmentCheck {
  const hard: Violation[] = [];
  const soft: Violation[] = [];

  // ---- HARD ----
  if (officer.sia.daysLeft < 0) {
    hard.push({
      tier: "hard",
      code: "SIA_EXP",
      msg: `${officer.name}'s SIA expired ${Math.abs(officer.sia.daysLeft)} days ago — cannot assign`,
    });
  }

  const unavail = UNAVAIL.find(
    (u) => u.officerId === officer.id && u.day === shift.day,
  );
  if (unavail) {
    hard.push({
      tier: "hard",
      code: unavail.type === "leave" ? "LEAVE" : "UNAVAIL",
      msg:
        unavail.type === "leave"
          ? `${officer.name} is on approved annual leave`
          : `${officer.name} is marked unavailable`,
    });
  }

  // Same-day conflict: officer already has another shift overlapping this window
  const conflicts = allShifts.filter(
    (s) =>
      s.id !== shift.id &&
      s.officerId === officer.id &&
      s.day === shift.day &&
      // overlap test
      s.start < shift.end &&
      s.end > shift.start,
  );
  if (conflicts.length > 0) {
    hard.push({
      tier: "hard",
      code: "CONFLICT",
      msg: `${officer.name} already has a shift overlapping this window`,
    });
  }

  // ---- SOFT ----

  // Weekly cap (48h WTR or officer.cap). Compute hours INCLUDING this shift,
  // assuming this shift would replace any existing assignment for the same id.
  const otherShifts = allShifts.filter((s) => s.id !== shift.id);
  const projected =
    otherShifts
      .filter((s) => s.officerId === officer.id && s.status !== "open")
      .reduce((sum, s) => sum + (s.end - s.start), 0) +
    (shift.end - shift.start);
  const cap = officer.cap;
  if (projected > cap) {
    soft.push({
      tier: "soft",
      code: officer.optOut ? "OT2" : "WTR",
      msg: `${projected.toFixed(1)}h projected this week → over ${cap}h cap${officer.optOut ? " (opt-out on file, OT tier 2 will apply)" : ""}`,
    });
  } else if (projected > cap * 0.9) {
    soft.push({
      tier: "soft",
      code: "OT1",
      msg: `${projected.toFixed(1)}h projected → close to ${cap}h cap`,
    });
  }

  // SIA expiring soon
  if (officer.sia.daysLeft >= 0 && officer.sia.daysLeft <= 30) {
    soft.push({
      tier: "soft",
      code: "SIA",
      msg: `${officer.name}'s SIA expires in ${officer.sia.daysLeft} days — renew before next week`,
    });
  }

  // Rest period — < 11h between this shift's start and any prior-day shift's end
  const priorDayShifts = allShifts.filter(
    (s) =>
      s.id !== shift.id &&
      s.officerId === officer.id &&
      s.day === shift.day - 1 &&
      s.end > 0,
  );
  for (const prior of priorDayShifts) {
    // prior shift may extend past midnight (end > 24); the gap to today's shift
    // is shift.start + 24 - prior.end if prior crosses midnight, else shift.start - (prior.end - 24).
    // Simpler: assume canonical hours — prior.end on day D-1 in absolute hours.
    // Today's shift.start is on day D so absolute hour = 24 + shift.start.
    const restHours = 24 + shift.start - prior.end;
    if (restHours < MIN_REST_HOURS && restHours > 0) {
      soft.push({
        tier: "soft",
        code: "REST",
        msg: `Less than 11h rest since previous shift (${restHours.toFixed(1)}h)`,
      });
      break;
    }
  }

  // Bank holiday uplift
  const dayInfo = WEEK.days[shift.day];
  if (dayInfo?.bankHoliday) {
    soft.push({
      tier: "soft",
      code: "BH",
      msg: "Bank holiday uplift will apply to this shift",
    });
  }

  return {
    ok: hard.length === 0,
    hard,
    soft,
    all: [...hard, ...soft],
  };
}

/**
 * Light-weight helper used by the LeftPanel + capacity bars.
 * Returns the projected weekly hours if the officer were assigned to `shift`.
 */
export function projectedWeeklyHrs(
  officer: SchedulingOfficer,
  shift: Shift,
  allShifts: Shift[],
): number {
  const others = allShifts.filter(
    (s) =>
      s.id !== shift.id && s.officerId === officer.id && s.status !== "open",
  );
  return (
    others.reduce((sum, s) => sum + (s.end - s.start), 0) + (shift.end - shift.start)
  );
}

// Re-export for convenience — keeps callers from importing both.
export { officerWeeklyHrs };
