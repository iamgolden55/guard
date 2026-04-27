// SchedulingState — context holding the live mutable shifts list.
// Phase 7.5: drag-drop assignments mutate this state; the underlying
// project/scheduling-data.jsx SHIFTS array is the seed.
//
// Phase 7.6 swaps useReducer for TanStack Query mutations against
// schedulerService.assignStaffToShift / bulkCreateShifts and adds
// optimistic-update with rollback on error.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { SHIFTS as SEED_SHIFTS, type Shift, type Violation } from "../data/mocks";

// ============================================================
// Reducer
// ============================================================
type Action =
  | { type: "assign"; shiftId: string; officerId: string }
  | { type: "unassign"; shiftId: string }
  | { type: "move"; shiftId: string; patch: Partial<Pick<Shift, "officerId" | "venueId">> }
  | { type: "set"; shifts: Shift[] };

function reducer(state: Shift[], action: Action): Shift[] {
  switch (action.type) {
    case "set":
      return action.shifts;
    case "assign": {
      return state.map((s) =>
        s.id === action.shiftId
          ? {
              ...s,
              officerId: action.officerId,
              status: "assigned" as const,
              published: false, // dropped via DnD = draft, requires publish
              violations: undefined, // clear stale violations; the violation engine produces fresh ones at render
            }
          : s,
      );
    }
    case "unassign": {
      return state.map((s) =>
        s.id === action.shiftId ? { ...s, officerId: null, status: "open" as const } : s,
      );
    }
    case "move": {
      return state.map((s) =>
        s.id === action.shiftId
          ? {
              ...s,
              ...action.patch,
              published: false, // re-arrangement → draft, must republish
              violations: undefined,
            }
          : s,
      );
    }
    default:
      return state;
  }
}

// ============================================================
// Toast
// ============================================================
export type ToastTone = "info" | "success" | "warning" | "danger";

export interface SchedulingToast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  violations?: Violation[];
}

// ============================================================
// Context
// ============================================================
interface SchedulingContextValue {
  shifts: Shift[];
  assignOfficer: (shiftId: string, officerId: string) => void;
  unassign: (shiftId: string) => void;
  moveShift: (shiftId: string, patch: Partial<Pick<Shift, "officerId" | "venueId">>) => void;
  toast: SchedulingToast | null;
  showToast: (t: Omit<SchedulingToast, "id">) => void;
  dismissToast: () => void;
}

const SchedulingContext = createContext<SchedulingContextValue | null>(null);

export function SchedulingProvider({ children }: { children: ReactNode }) {
  const [shifts, dispatch] = useReducer(reducer, SEED_SHIFTS);
  const [toast, setToast] = useState<SchedulingToast | null>(null);

  const assignOfficer = useCallback((shiftId: string, officerId: string) => {
    dispatch({ type: "assign", shiftId, officerId });
  }, []);

  const unassign = useCallback((shiftId: string) => {
    dispatch({ type: "unassign", shiftId });
  }, []);

  const moveShift = useCallback(
    (shiftId: string, patch: Partial<Pick<Shift, "officerId" | "venueId">>) => {
      dispatch({ type: "move", shiftId, patch });
    },
    [],
  );

  const showToast = useCallback((t: Omit<SchedulingToast, "id">) => {
    const id = Date.now() + Math.random();
    setToast({ ...t, id });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo<SchedulingContextValue>(
    () => ({ shifts, assignOfficer, unassign, moveShift, toast, showToast, dismissToast }),
    [shifts, assignOfficer, unassign, moveShift, toast, showToast, dismissToast],
  );

  return <SchedulingContext.Provider value={value}>{children}</SchedulingContext.Provider>;
}

export function useScheduling(): SchedulingContextValue {
  const ctx = useContext(SchedulingContext);
  if (!ctx) throw new Error("useScheduling must be used inside SchedulingProvider");
  return ctx;
}

// ============================================================
// Stateless derived helpers (work on any shifts array)
// ============================================================
export function shiftsForDay(shifts: Shift[], day: number) {
  return shifts.filter((s) => s.day === day);
}

export function officerWeeklyHrs(shifts: Shift[], officerId: string): number {
  return shifts
    .filter((s) => s.officerId === officerId && s.status !== "open")
    .reduce((sum, s) => sum + (s.end - s.start), 0);
}

export interface WeekCounts {
  total: number;
  published: number;
  draft: number;
  open: number;
  hardViols: number;
  softViols: number;
}

export function weekCounts(shifts: Shift[]): WeekCounts {
  return {
    total: shifts.length,
    published: shifts.filter((s) => s.published).length,
    draft: shifts.filter((s) => !s.published && s.status === "draft").length,
    open: shifts.filter((s) => s.status === "open").length,
    hardViols: shifts.filter((s) => (s.violations || []).some((v) => v.tier === "hard")).length,
    softViols: shifts.filter((s) => (s.violations || []).some((v) => v.tier === "soft")).length,
  };
}
