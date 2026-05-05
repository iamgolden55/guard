// SchedulingState — context holding the live mutable shifts list plus the
// read-only officer/venue/week catalogues sourced from the API.
//
// Phase 8.5 (pass 2): drag-drop assignments now flow through TanStack mutations
// against schedulerService. The local reducer is preserved for instant
// optimistic updates; on server error we rollback to the pre-mutation snapshot
// and refetch so server state wins.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import schedulerService, {
  type CreateShiftParams,
} from "../../../services/schedulerService";
import type { MonthGrid } from "../data/adapters";
import type {
  SchedulingOfficer,
  SchedulingVenue,
  SchedulingWeek,
  Shift,
  Violation,
} from "../data/mocks";

// ============================================================
// Reducer (local optimistic state)
// ============================================================
type Action =
  | { type: "assign"; shiftId: string; officerId: string }
  | { type: "unassign"; shiftId: string }
  | { type: "move"; shiftId: string; patch: Partial<Pick<Shift, "officerId" | "venueId" | "day">> }
  | { type: "publish"; shiftIds: string[] }
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
              published: false,
              violations: undefined,
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
              published: false,
              violations: undefined,
            }
          : s,
      );
    }
    case "publish": {
      const ids = new Set(action.shiftIds);
      return state.map((s) => (ids.has(s.id) ? { ...s, published: true } : s));
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
export interface ShiftFormInput {
  venueId: string;
  officerId: string | null;
  /** yyyy-mm-dd, the shift's start day in local time. */
  date: string;
  /** "HH:mm" 24h. */
  startTime: string;
  /** "HH:mm" 24h. May resolve to the next day if endTime <= startTime. */
  endTime: string;
  requiredRole?: string;
  breakMinutes?: number;
  notes?: string;
  /** Number of officers needed for this shift slot. When > 1, the create
   *  mutation fans out N Shift rows linked by a shared shift_group; the first
   *  row carries the chosen officer (if any) and the rest start as open. */
  officersNeeded?: number;
  /** Pay-rate mode (legacy 3-mode picker port).
   *  - 'static': leave hourly_rate=null so the rate hierarchy resolves at calc time
   *    (PayRate(staff,venue) → PayRate(staff,default) → SystemSettings → fallback)
   *  - 'special_event': set is_special_event=true; backend uses SystemSettings.special_event_pay_rate
   *  - 'custom': writes the explicit numeric `customPayRate` to Shift.hourly_rate */
  payRateType?: "static" | "special_event" | "custom";
  /** Required when payRateType === 'custom'. Hourly rate in £. */
  customPayRate?: number;
}

interface SchedulingContextValue {
  shifts: Shift[];
  officers: SchedulingOfficer[];
  venues: SchedulingVenue[];
  week: SchedulingWeek;
  monthGrid: MonthGrid;
  officerById: (id: string | null) => SchedulingOfficer | undefined;
  venueById: (id: string) => SchedulingVenue | undefined;
  assignOfficer: (shiftId: string, officerId: string) => void;
  unassign: (shiftId: string) => void;
  moveShift: (shiftId: string, patch: Partial<Pick<Shift, "officerId" | "venueId" | "day">>) => void;
  createShift: (input: ShiftFormInput) => Promise<unknown>;
  updateShiftFull: (id: string, input: ShiftFormInput) => Promise<unknown>;
  deleteShift: (id: string) => Promise<unknown>;
  copyLastWeek: () => Promise<unknown>;
  publishWeek: () => void;
  publishShift: (id: string) => void;
  isPublishing: boolean;
  isCopying: boolean;
  toast: SchedulingToast | null;
  showToast: (t: Omit<SchedulingToast, "id">) => void;
  dismissToast: () => void;
}

const SchedulingContext = createContext<SchedulingContextValue | null>(null);

interface SchedulingProviderProps {
  initialShifts: Shift[];
  officers: SchedulingOfficer[];
  venues: SchedulingVenue[];
  week: SchedulingWeek;
  monthGrid: MonthGrid;
  /** Range used as anchor when converting (day, decimal-hour) → ISO datetimes. */
  rangeAnchorIso: string; // yyyy-mm-dd
  /** Query key prefix to invalidate after mutations. */
  shiftsQueryKey: readonly unknown[];
  children: ReactNode;
}

// Convert (anchor + day-offset + decimal hour) → ISO datetime string the
// backend can parse. Anchored at LOCAL midnight so the round-trip matches the
// read-side adapter, which pulls hours via `Date#getHours()` (local time).
// e.g. shift display says "14:00" → server gets the UTC ISO equivalent of
// 14:00 in the user's timezone, and a refetch shows "14:00" again.
function dayHourToIso(anchor: string, day: number, hourDecimal: number): string {
  const [yyyy, mm, dd] = anchor.split("-").map(Number);
  const wholeHours = Math.floor(hourDecimal);
  const minutes = Math.round((hourDecimal - wholeHours) * 60);
  const base = new Date(yyyy ?? 1970, (mm ?? 1) - 1, dd ?? 1, 0, 0, 0, 0);
  const ms = base.getTime() + ((day * 24 + wholeHours) * 60 + minutes) * 60 * 1000;
  return new Date(ms).toISOString();
}

/** Combine a yyyy-mm-dd date + HH:mm time into an ISO datetime in local TZ. */
function localDateTimeToIso(dateIso: string, timeHHmm: string): string {
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
  ).toISOString();
}

/** Translate the form input shape to the API request body. End time spilling
 *  past midnight is handled by adding 1 day to the end-date if endTime <= startTime. */
function formInputToApi(input: ShiftFormInput): Record<string, unknown> {
  const start = localDateTimeToIso(input.date, input.startTime);
  const [eh, em] = input.endTime.split(":").map(Number);
  const [sh, sm] = input.startTime.split(":").map(Number);
  const endsNextDay =
    (eh ?? 0) * 60 + (em ?? 0) <= (sh ?? 0) * 60 + (sm ?? 0);
  let endDate = input.date;
  if (endsNextDay) {
    const [y, m, d] = input.date.split("-").map(Number);
    const next = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1);
    endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  }
  const end = localDateTimeToIso(endDate, input.endTime);
  const body: Record<string, unknown> = {
    venue: Number(input.venueId),
    start_time: start,
    end_time: end,
    is_published: false,
  };
  if (input.officerId) {
    body.staff_user = Number(input.officerId.replace(/^u/, ""));
    body.status = "scheduled";
  } else {
    body.staff_user = null;
    body.status = "open";
  }
  if (input.requiredRole) body.required_security_role = input.requiredRole;
  if (input.breakMinutes != null) body.break_duration = input.breakMinutes;
  if (input.notes) body.notes = input.notes;
  applyPayRate(body, input);
  return body;
}

/** Map the form's pay-rate mode → backend payload.
 *  - 'static' (default): omit hourly_rate so the rate hierarchy resolves later
 *    (`Shift.get_effective_hourly_rate` at backend/api/models.py:2280).
 *  - 'special_event': set is_special_event=true; backend's special-event rate kicks in.
 *  - 'custom': write the numeric customPayRate to hourly_rate. Not a special event. */
function applyPayRate(body: Record<string, unknown>, input: ShiftFormInput): void {
  const mode = input.payRateType ?? "static";
  if (mode === "special_event") {
    body.is_special_event = true;
  } else if (mode === "custom") {
    body.is_special_event = false;
    if (input.customPayRate != null && Number.isFinite(input.customPayRate)) {
      body.hourly_rate = input.customPayRate;
    }
  } else {
    body.is_special_event = false;
  }
}

export function SchedulingProvider({
  initialShifts,
  officers,
  venues,
  week,
  monthGrid,
  rangeAnchorIso,
  shiftsQueryKey,
  children,
}: SchedulingProviderProps) {
  const queryClient = useQueryClient();
  const [shifts, dispatch] = useReducer(reducer, initialShifts);
  const [toast, setToast] = useState<SchedulingToast | null>(null);
  const shiftsRef = useRef(shifts);
  shiftsRef.current = shifts;

  // Re-seed the reducer when the upstream query refetches.
  useEffect(() => {
    dispatch({ type: "set", shifts: initialShifts });
  }, [initialShifts]);

  const showToast = useCallback((t: Omit<SchedulingToast, "id">) => {
    const id = Date.now() + Math.random();
    setToast({ ...t, id });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const invalidateShifts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: shiftsQueryKey.slice(0, 2) });
  }, [queryClient, shiftsQueryKey]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const assignMutation = useMutation<
    unknown,
    Error,
    { shiftId: string; officerId: string },
    { prev: Shift[] }
  >({
    mutationFn: ({ shiftId, officerId }) => {
      const numericId = Number(shiftId);
      const staffId = Number(officerId.replace(/^u/, ""));
      return schedulerService.updateShift(numericId, {
        staff_user: staffId,
        status: "scheduled",
        is_published: false,
      });
    },
    onMutate: ({ shiftId, officerId }) => {
      const prev = shiftsRef.current;
      dispatch({ type: "assign", shiftId, officerId });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) dispatch({ type: "set", shifts: ctx.prev });
      showToast({
        tone: "danger",
        title: "Couldn't save assignment",
        body: "The server rejected the change. Please try again.",
      });
    },
    onSettled: () => invalidateShifts(),
  });

  const unassignMutation = useMutation<unknown, Error, { shiftId: string }, { prev: Shift[] }>({
    mutationFn: ({ shiftId }) =>
      schedulerService.updateShift(Number(shiftId), {
        staff_user: null,
        status: "open",
      }),
    onMutate: ({ shiftId }) => {
      const prev = shiftsRef.current;
      dispatch({ type: "unassign", shiftId });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) dispatch({ type: "set", shifts: ctx.prev });
      showToast({ tone: "danger", title: "Couldn't unassign", body: "Server rejected the change." });
    },
    onSettled: () => invalidateShifts(),
  });

  const moveMutation = useMutation<
    unknown,
    Error,
    {
      shiftId: string;
      patch: Partial<Pick<Shift, "officerId" | "venueId" | "day">>;
    },
    { prev: Shift[] }
  >({
    mutationFn: async ({ shiftId, patch }) => {
      const target = shiftsRef.current.find((s) => s.id === shiftId);
      if (!target) throw new Error("Shift not found in local state");
      const newDay = patch.day ?? target.day;
      const newOfficer = patch.officerId !== undefined ? patch.officerId : target.officerId;
      const newVenue = patch.venueId ?? target.venueId;
      const body: Record<string, unknown> = {};
      if (patch.venueId !== undefined) body.venue = Number(newVenue);
      if (patch.officerId !== undefined) {
        body.staff_user = newOfficer ? Number(newOfficer.replace(/^u/, "")) : null;
        body.status = newOfficer ? "scheduled" : "open";
      }
      if (patch.day !== undefined) {
        body.start_time = dayHourToIso(rangeAnchorIso, newDay, target.start);
        body.end_time = dayHourToIso(rangeAnchorIso, newDay, target.end);
      }
      body.is_published = false;
      return schedulerService.updateShift(Number(shiftId), body);
    },
    onMutate: ({ shiftId, patch }) => {
      const prev = shiftsRef.current;
      dispatch({ type: "move", shiftId, patch });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) dispatch({ type: "set", shifts: ctx.prev });
      showToast({ tone: "danger", title: "Couldn't move shift", body: "Server rejected the change." });
    },
    onSettled: () => invalidateShifts(),
  });

  const createMutation = useMutation<unknown, Error, ShiftFormInput>({
    mutationFn: async (input) => {
      const count = Math.max(1, Math.min(20, input.officersNeeded ?? 1));
      if (count === 1) {
        return schedulerService.createShift(
          formInputToApi(input) as unknown as CreateShiftParams,
        );
      }
      // Multi-officer slot: fan out N rows linked by a shared shift_group UUID.
      // First row carries the selected officer; the rest start as open seats so
      // staff can be dragged onto them or claim via the open-shift broadcast.
      const groupId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const baseBody = formInputToApi(input);
      const bodies: Record<string, unknown>[] = Array.from({ length: count }, (_, i) => {
        const body: Record<string, unknown> = { ...baseBody, shift_group: groupId };
        if (i > 0) {
          body.staff_user = null;
          body.status = "open";
        }
        return body;
      });
      const results = await Promise.all(
        bodies.map((b) =>
          schedulerService.createShift(b as unknown as CreateShiftParams),
        ),
      );
      return results;
    },
    onSuccess: (_data, vars) => {
      const count = Math.max(1, vars.officersNeeded ?? 1);
      showToast({
        tone: "success",
        title: count === 1 ? "Shift created" : `${count} shifts created`,
        body:
          count === 1
            ? "Saved as draft."
            : `Saved as drafts in one shift group — ${count - (vars.officerId ? 1 : 0)} open seat${
                count - (vars.officerId ? 1 : 0) === 1 ? "" : "s"
              } to fill.`,
      });
      invalidateShifts();
    },
    onError: (err) =>
      showToast({
        tone: "danger",
        title: "Couldn't create shift",
        body: err?.message ?? "Server rejected the request.",
      }),
  });

  const updateFullMutation = useMutation<
    unknown,
    Error,
    { id: string; input: ShiftFormInput }
  >({
    mutationFn: async ({ id, input }) => {
      const extraSeats = Math.max(0, Math.min(20, (input.officersNeeded ?? 1) - 1));
      const baseBody = formInputToApi(input);

      // If we're adding extra seats, ensure the edited row has a shift_group so
      // new rows can link to it. Reuse the existing group if present, else mint
      // a new UUID and PATCH it onto the existing shift.
      let groupId: string | undefined;
      if (extraSeats > 0) {
        const existing = shiftsRef.current.find((s) => s.id === id);
        groupId =
          existing?.shiftGroup ??
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        (baseBody as Record<string, unknown>).shift_group = groupId;
      }

      // PATCH the edited row first.
      await schedulerService.updateShift(
        Number(id),
        baseBody as unknown as CreateShiftParams,
      );

      // Then fan out the extra open seats linked to the same group.
      if (extraSeats > 0 && groupId) {
        const extras: Record<string, unknown>[] = Array.from({ length: extraSeats }, () => ({
          ...baseBody,
          shift_group: groupId,
          staff_user: null,
          status: "open",
        }));
        await Promise.all(
          extras.map((b) =>
            schedulerService.createShift(b as unknown as CreateShiftParams),
          ),
        );
      }
    },
    onSuccess: (_data, vars) => {
      const extra = Math.max(0, (vars.input.officersNeeded ?? 1) - 1);
      showToast({
        tone: "success",
        title: extra > 0 ? "Shift updated · seats added" : "Shift updated",
        body:
          extra > 0
            ? `Saved as draft and added ${extra} open seat${extra === 1 ? "" : "s"} to the same group.`
            : "Saved as draft.",
      });
      invalidateShifts();
    },
    onError: (err) =>
      showToast({
        tone: "danger",
        title: "Couldn't update shift",
        body: err?.message ?? "Server rejected the request.",
      }),
  });

  const deleteMutation = useMutation<unknown, Error, string, { prev: Shift[] }>({
    mutationFn: (id) => schedulerService.deleteShift(Number(id)),
    onMutate: (id) => {
      const prev = shiftsRef.current;
      dispatch({ type: "set", shifts: prev.filter((s) => s.id !== id) });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) dispatch({ type: "set", shifts: ctx.prev });
      showToast({ tone: "danger", title: "Couldn't delete shift" });
    },
    onSuccess: () => {
      showToast({ tone: "success", title: "Shift deleted" });
    },
    onSettled: () => invalidateShifts(),
  });

  const copyWeekMutation = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      // Compute previous week's Mon..Sun range from this week's start.
      const [y, m, d] = week.start.split("-").map(Number);
      const prevStart = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 7);
      const prevEnd = new Date(prevStart);
      prevEnd.setDate(prevEnd.getDate() + 6);
      const fmt = (dt: Date) =>
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

      const response = (await schedulerService.getResourceTimeline({
        start: `${fmt(prevStart)}T00:00:00Z`,
        end: `${fmt(prevEnd)}T23:59:59Z`,
        group_by: "venue",
      })) as { events?: Array<{ start: string; end: string; extendedProps?: Record<string, unknown> }> };

      const events = response?.events ?? [];
      if (events.length === 0) {
        throw new Error("No shifts in last week to copy.");
      }

      // POST clones with start/end shifted forward 7 days; everything as drafts.
      await Promise.all(
        events.map((e) => {
          const startDt = new Date(e.start);
          const endDt = new Date(e.end);
          startDt.setDate(startDt.getDate() + 7);
          endDt.setDate(endDt.getDate() + 7);
          const ext = (e.extendedProps ?? {}) as {
            venueId?: number;
            staffId?: number | null;
            requiredRole?: string;
            breakDuration?: number;
          };
          const body: Record<string, unknown> = {
            venue: ext.venueId,
            start_time: startDt.toISOString(),
            end_time: endDt.toISOString(),
            is_published: false,
          };
          if (ext.staffId != null) {
            body.staff_user = ext.staffId;
            body.status = "scheduled";
          } else {
            body.status = "open";
          }
          if (ext.requiredRole) body.required_security_role = ext.requiredRole;
          if (ext.breakDuration != null) body.break_duration = ext.breakDuration;
          return schedulerService.createShift(body as unknown as CreateShiftParams);
        }),
      );
      return events.length;
    },
    onSuccess: (count) => {
      showToast({
        tone: "success",
        title: "Copied last week",
        body: `${count} shift${count === 1 ? "" : "s"} cloned as drafts.`,
      });
      invalidateShifts();
    },
    onError: (err) =>
      showToast({
        tone: "warning",
        title: "Couldn't copy last week",
        body: err?.message ?? "Try again.",
      }),
  });

  const publishMutation = useMutation<unknown, Error, { shiftIds: string[] }, { prev: Shift[] }>({
    mutationFn: ({ shiftIds }) =>
      schedulerService.publishShifts({ shift_ids: shiftIds.map((id) => Number(id)) }),
    onMutate: ({ shiftIds }) => {
      const prev = shiftsRef.current;
      dispatch({ type: "publish", shiftIds });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) dispatch({ type: "set", shifts: ctx.prev });
      showToast({ tone: "danger", title: "Couldn't publish", body: "Server rejected the change." });
    },
    onSuccess: () => {
      showToast({ tone: "success", title: "Week published", body: "Officers will be notified." });
    },
    onSettled: () => invalidateShifts(),
  });

  const assignOfficer = useCallback(
    (shiftId: string, officerId: string) => assignMutation.mutate({ shiftId, officerId }),
    [assignMutation],
  );
  const unassign = useCallback(
    (shiftId: string) => unassignMutation.mutate({ shiftId }),
    [unassignMutation],
  );
  const moveShift = useCallback(
    (shiftId: string, patch: Partial<Pick<Shift, "officerId" | "venueId" | "day">>) =>
      moveMutation.mutate({ shiftId, patch }),
    [moveMutation],
  );
  const createShift = useCallback(
    (input: ShiftFormInput) => createMutation.mutateAsync(input),
    [createMutation],
  );
  const updateShiftFull = useCallback(
    (id: string, input: ShiftFormInput) => updateFullMutation.mutateAsync({ id, input }),
    [updateFullMutation],
  );
  const deleteShift = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );
  const copyLastWeek = useCallback(() => copyWeekMutation.mutateAsync(), [copyWeekMutation]);
  const publishShift = useCallback(
    (id: string) => publishMutation.mutate({ shiftIds: [id] }),
    [publishMutation],
  );
  const publishWeek = useCallback(() => {
    const draftIds = shiftsRef.current
      .filter((s) => !s.published && s.status !== "open")
      .map((s) => s.id);
    if (draftIds.length === 0) {
      showToast({ tone: "info", title: "Nothing to publish", body: "No drafts in the current view." });
      return;
    }
    publishMutation.mutate({ shiftIds: draftIds });
  }, [publishMutation, showToast]);

  const officerById = useCallback(
    (id: string | null) => (id ? officers.find((o) => o.id === id) : undefined),
    [officers],
  );

  const venueById = useCallback(
    (id: string) => venues.find((v) => v.id === id),
    [venues],
  );

  const value = useMemo<SchedulingContextValue>(
    () => ({
      shifts,
      officers,
      venues,
      week,
      monthGrid,
      officerById,
      venueById,
      assignOfficer,
      unassign,
      moveShift,
      createShift,
      updateShiftFull,
      deleteShift,
      copyLastWeek,
      publishWeek,
      publishShift,
      isPublishing: publishMutation.isPending,
      isCopying: copyWeekMutation.isPending,
      toast,
      showToast,
      dismissToast,
    }),
    [
      shifts,
      officers,
      venues,
      week,
      monthGrid,
      officerById,
      venueById,
      assignOfficer,
      unassign,
      moveShift,
      createShift,
      updateShiftFull,
      deleteShift,
      copyLastWeek,
      publishWeek,
      publishShift,
      publishMutation.isPending,
      copyWeekMutation.isPending,
      toast,
      showToast,
      dismissToast,
    ],
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
    // Any unpublished shift is a draft from the admin's perspective —
    // including open shifts that haven't been broadcast yet.
    draft: shifts.filter((s) => !s.published).length,
    open: shifts.filter((s) => s.status === "open").length,
    hardViols: shifts.filter((s) => (s.violations || []).some((v) => v.tier === "hard")).length,
    softViols: shifts.filter((s) => (s.violations || []).some((v) => v.tier === "soft")).length,
  };
}
