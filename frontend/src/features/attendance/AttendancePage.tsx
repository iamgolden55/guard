// AttendancePage — composes header, view-switcher, and drawer.
// Tab state is local; deeplinking via ?tab= is a Phase 4.5 polish.
import { useEffect, useState } from "react";
import { AttendanceHeader } from "./components/AttendanceHeader";
import { AttendanceDrawer } from "./components/AttendanceDrawer";
import { LiveView } from "./components/live/LiveView";
import { ExceptionsView } from "./components/ExceptionsView";
import { TimesheetsView } from "./components/TimesheetsView";
import {
  SHIFTS_TODAY,
  type AttendanceShift,
  type TimesheetRow,
} from "./data/mocks";

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

export default function AttendancePage() {
  const [view, setView] = useState<AttendanceTab>("live");
  const [selectedShift, setSelectedShift] = useState<AttendanceShift | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leftRailOpen, setLeftRailOpen] = useState<boolean>(() => readBool(LEFT_RAIL_KEY, true));
  const [venueGridOpen, setVenueGridOpen] = useState<boolean>(() =>
    readBool(VENUE_GRID_KEY, true),
  );

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

  const handleSelectTimesheet = ({ timesheet }: { timesheet: TimesheetRow }) => {
    // Open the most-recent shift for that officer that isn't upcoming, or
    // any shift if none qualify.
    const shift =
      SHIFTS_TODAY.find((x) => x.oid === timesheet.oid && x.status !== "upcoming") ??
      SHIFTS_TODAY.find((x) => x.oid === timesheet.oid) ??
      null;
    if (shift) {
      setSelectedShift(shift);
      setDrawerOpen(true);
    }
  };

  return (
    <>
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
      {view === "timesheets" && <TimesheetsView onSelect={handleSelectTimesheet} />}
      <AttendanceDrawer
        open={drawerOpen}
        shift={selectedShift}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
