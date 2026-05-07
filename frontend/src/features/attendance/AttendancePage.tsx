// AttendancePage — composes header, view-switcher, and drawer.
// Phase 4.5: real-API wiring via useAttendanceData + AttendanceContext.
import { useEffect, useState } from "react";
import { AttendanceProvider } from "./AttendanceContext";
import { AttendanceDrawer } from "./components/AttendanceDrawer";
import { AttendanceHeader } from "./components/AttendanceHeader";
import { ExceptionsView } from "./components/ExceptionsView";
import { TimesheetsView } from "./components/TimesheetsView";
import { LiveView } from "./components/live/LiveView";
import type { AttendanceShift, TimesheetRow } from "./data/mocks";
import { useAttendanceData } from "./hooks/useAttendanceData";

export type AttendanceTab = "live" | "exceptions" | "timesheets";

const LEFT_RAIL_KEY = "ms-attendance-left-rail";
const VENUE_GRID_KEY = "ms-attendance-venue-grid";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // ignore
  }
  return fallback;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayIsoFor(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + offset);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const [view, setView] = useState<AttendanceTab>("live");
  const [selectedShift, setSelectedShift] = useState<AttendanceShift | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftRailOpen, setLeftRailOpen] = useState<boolean>(() =>
    readBool(LEFT_RAIL_KEY, true),
  );
  const [venueGridOpen, setVenueGridOpen] = useState<boolean>(() =>
    readBool(VENUE_GRID_KEY, true),
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => todayIso());
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() =>
    mondayIsoFor(todayIso()),
  );

  const isToday = selectedDate === todayIso();
  const selectedShiftId = selectedShift ? Number(selectedShift.id) : null;
  const data = useAttendanceData({
    date: selectedDate,
    weekStart: selectedWeekStart,
    selectedShiftId,
    livePollMs: isToday ? 30_000 : null,
  });

  useEffect(() => {
    try {
      localStorage.setItem(LEFT_RAIL_KEY, leftRailOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [leftRailOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(VENUE_GRID_KEY, venueGridOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [venueGridOpen]);

  const handleSelectShift = (s: AttendanceShift) => {
    setSelectedShift(s);
    setDrawerOpen(true);
  };

  const handleSelectTimesheet = ({
    timesheet,
  }: { timesheet: TimesheetRow }) => {
    // Open the most-recent shift for that officer that isn't upcoming, or
    // any shift if none qualify.
    const shift =
      data.shifts.find(
        (x) => x.oid === timesheet.oid && x.status !== "upcoming",
      ) ??
      data.shifts.find((x) => x.oid === timesheet.oid) ??
      null;
    if (shift) {
      setSelectedShift(shift);
      setDrawerOpen(true);
    }
  };

  return (
    <AttendanceProvider
      data={data}
      selectedShiftId={selectedShiftId}
      setSelectedShiftId={(id) => {
        if (id === null) setSelectedShift(null);
      }}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedDate={selectedDate}
      setSelectedDate={(d) => {
        setSelectedDate(d);
        setSelectedWeekStart(mondayIsoFor(d));
      }}
      selectedWeekStart={selectedWeekStart}
      setSelectedWeekStart={setSelectedWeekStart}
    >
      <AttendanceHeader
        view={view}
        onViewChange={setView}
        leftRailOpen={leftRailOpen}
        venueGridOpen={venueGridOpen}
        onToggleLeftRail={() => setLeftRailOpen((v) => !v)}
        onToggleVenueGrid={() => setVenueGridOpen((v) => !v)}
      />
      {view === "live" && (
        <LiveView
          onSelect={handleSelectShift}
          leftRailOpen={leftRailOpen}
          venueGridOpen={venueGridOpen}
        />
      )}
      {view === "exceptions" && <ExceptionsView onSelect={handleSelectShift} />}
      {view === "timesheets" && (
        <TimesheetsView onSelect={handleSelectTimesheet} />
      )}
      <AttendanceDrawer
        open={drawerOpen}
        shift={selectedShift}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedShift(null);
        }}
      />
    </AttendanceProvider>
  );
}
