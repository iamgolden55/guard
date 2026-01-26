/**
 * Types for Activity Heat Map component
 */

export interface HeatMapDayData {
  date: string;           // YYYY-MM-DD
  dayOfWeek: number;      // 0-6 (Sun-Sat)
  weekIndex: number;      // Column index (0 = oldest week)
  scheduled: number;
  completed: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface ActivityHeatMapData {
  days: HeatMapDayData[];
  summary: {
    totalScheduled: number;
    totalCompleted: number;
    completionRate: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
}
