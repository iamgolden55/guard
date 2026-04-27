// AttendancePage — composes header, view-switcher, and drawer.
// Tab state is local; deeplinking via ?tab= is a Phase 4.5 polish.
import { useState } from "react";
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

export default function AttendancePage() {
  const [view, setView] = useState<AttendanceTab>("live");
  const [selectedShift, setSelectedShift] = useState<AttendanceShift | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      <AttendanceHeader view={view} onViewChange={setView} />
      {view === "live" && <LiveView onSelect={handleSelectShift} />}
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
