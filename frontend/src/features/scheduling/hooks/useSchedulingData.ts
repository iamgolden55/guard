// Scheduling data layer — TanStack Query against three endpoints, adapted into
// the mock-shaped UI types so the rest of the feature is unchanged.
//
// Reads
//   ["scheduling", "shifts", rangeStart, rangeEnd]   resource_timeline?group_by=venue
//   ["scheduling", "officers"]                       staff-profiles?is_approved=true
//   ["scheduling", "venues"]                         getAllVenues()
//
// Range strategy
//   Week-anchored views (day, week, roster) → query a 7-day range, shift.day = 0..6
//   Month-anchored view                     → query the full month grid (≤42d),
//                                              shift.day relative to the grid start.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../services/api";
import schedulerService from "../../../services/schedulerService";
import venueService from "../../../services/venueService";
import {
  getMonthGridForDate,
  getWeekForDate,
  monthGridRangeIso,
  officerFromApi,
  shiftFromTimelineEvent,
  venueFromApi,
  weekRangeIso,
  type MonthGrid,
} from "../data/adapters";
import type { SchedulingOfficer, SchedulingVenue, SchedulingWeek, Shift } from "../data/mocks";

export type SchedulingViewMode = "day" | "week" | "month" | "roster";

interface TimelineResponse {
  resources: Array<Record<string, unknown>>;
  events: Array<{
    id: number | string;
    resourceId?: string;
    start: string;
    end: string | null;
    extendedProps?: Record<string, unknown>;
  }>;
  warnings: unknown[];
}

interface PaginatedStaff {
  results?: unknown[];
  count?: number;
}

export interface UseSchedulingDataArgs {
  viewDate: Date;
  viewMode: SchedulingViewMode;
}

export interface UseSchedulingData {
  week: SchedulingWeek;
  monthGrid: MonthGrid;
  shifts: Shift[];
  officers: SchedulingOfficer[];
  venues: SchedulingVenue[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  rangeAnchor: string;
  rangeIso: { start: string; end: string };
}

export function useSchedulingData({ viewDate, viewMode }: UseSchedulingDataArgs): UseSchedulingData {
  const week = useMemo(() => getWeekForDate(viewDate), [viewDate]);
  const monthGrid = useMemo(() => getMonthGridForDate(viewDate), [viewDate]);

  // Pick the API range based on the active view mode. Month view always queries
  // the full month grid (so shifts on padding days from the prev/next month
  // still appear); week-anchored views query the 7-day window.
  const isMonth = viewMode === "month";
  const rangeIso = useMemo(
    () => (isMonth ? monthGridRangeIso(monthGrid) : weekRangeIso(week)),
    [isMonth, monthGrid, week],
  );
  const rangeAnchor = isMonth ? monthGrid.rangeStart : week.start;

  const shiftsQuery = useQuery<TimelineResponse>({
    queryKey: ["scheduling", "shifts", rangeIso.start, rangeIso.end],
    queryFn: () =>
      schedulerService.getResourceTimeline({
        start: rangeIso.start,
        end: rangeIso.end,
        group_by: "venue",
      }) as unknown as Promise<TimelineResponse>,
    // Refetch when navigating back from Attendance — Mark-present /
    // Approve actions there mutate shift state but don't invalidate this
    // query's cache, so without this the calendar shows stale ribbons.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const officersQuery = useQuery<unknown[]>({
    queryKey: ["scheduling", "officers"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedStaff | unknown[]>(
        "/api/v1/staff-profiles/?is_approved=true&page_size=500",
      );
      if (Array.isArray(data)) return data;
      return Array.isArray(data?.results) ? data.results : [];
    },
  });

  const venuesQuery = useQuery({
    queryKey: ["scheduling", "venues"],
    queryFn: () => venueService.getAllVenues(),
  });

  const venues = useMemo<SchedulingVenue[]>(
    () => (venuesQuery.data ?? []).filter((v) => v.is_active).map(venueFromApi),
    [venuesQuery.data],
  );

  const officers = useMemo<SchedulingOfficer[]>(
    () =>
      (officersQuery.data ?? []).map((p) =>
        officerFromApi(p as Parameters<typeof officerFromApi>[0]),
      ),
    [officersQuery.data],
  );

  const shifts = useMemo<Shift[]>(() => {
    const events = shiftsQuery.data?.events ?? [];
    const adapted: Shift[] = [];
    for (const e of events) {
      const s = shiftFromTimelineEvent(
        e as Parameters<typeof shiftFromTimelineEvent>[0],
        rangeAnchor,
      );
      if (s) adapted.push(s);
    }
    return adapted;
  }, [shiftsQuery.data, rangeAnchor]);

  const refetch = () => {
    shiftsQuery.refetch();
    officersQuery.refetch();
    venuesQuery.refetch();
  };

  return {
    week,
    monthGrid,
    shifts,
    officers,
    venues,
    isLoading: shiftsQuery.isLoading || officersQuery.isLoading || venuesQuery.isLoading,
    isError: shiftsQuery.isError || officersQuery.isError || venuesQuery.isError,
    error: shiftsQuery.error ?? officersQuery.error ?? venuesQuery.error,
    refetch,
    rangeAnchor,
    rangeIso,
  };
}
