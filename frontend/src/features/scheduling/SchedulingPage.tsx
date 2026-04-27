// SchedulingPage — composes header + week strip + canvas + drawer.
// Ported from project/scheduling-app.jsx.
//
// Drag-drop interactions (drag officer onto cell to assign, drag a
// ShiftBlock between rows, edge-resize to change times) are Phase 7.5
// — the @dnd-kit library is already installed; the visual layer is the
// gate. The violation engine (lib/violations.ts) lands in the same pass.
import { useState } from "react";
import { tokens } from "../../design-system/tokens";
import { SchedulingHeader } from "./components/SchedulingHeader";
import { WeekStrip, type ViewMode } from "./components/WeekStrip";
import { ViolationsBanner } from "./components/ViolationsBanner";
import { OfficerLeftPanel, type LeftPanelMode } from "./components/OfficerLeftPanel";
import { DayCanvas, type CanvasAxis } from "./components/canvas/DayCanvas";
import { WeekView } from "./components/WeekView";
import { MonthView } from "./components/MonthView";
import { RosterView } from "./components/RosterView";
import { Legend } from "./components/Legend";
import { SchedulingDrawer } from "./components/SchedulingDrawer";
import { WEEK, type Shift } from "./data/mocks";

const LEFT_PANEL_KEY = "ms-scheduling-left-panel";

function readMode(fallback: LeftPanelMode): LeftPanelMode {
  try {
    const v = localStorage.getItem(LEFT_PANEL_KEY);
    if (v === "expanded" || v === "collapsed") return v;
  } catch {
    // ignore
  }
  return fallback;
}

export default function SchedulingPage() {
  const todayIdx = WEEK.days.findIndex((d) => d.today);
  const [currentDay, setCurrentDay] = useState<number>(todayIdx >= 0 ? todayIdx : 0);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [canvasAxis, setCanvasAxis] = useState<CanvasAxis>("venue");
  const [leftPanel, setLeftPanel] = useState<LeftPanelMode>(() => readMode("expanded"));
  const [drawerShift, setDrawerShift] = useState<Shift | null>(null);

  const setLeftPanelPersist = (m: LeftPanelMode) => {
    setLeftPanel(m);
    try {
      localStorage.setItem(LEFT_PANEL_KEY, m);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <SchedulingHeader onPublish={() => {}} onNewShift={() => {}} />
      <WeekStrip
        currentDay={currentDay}
        setCurrentDay={setCurrentDay}
        viewMode={viewMode}
        setViewMode={setViewMode}
        canvasAxis={canvasAxis}
        setCanvasAxis={setCanvasAxis}
      />

      <div style={{ display: "flex", flex: 1, minHeight: 0, background: tokens.color.ink50 }}>
        {viewMode === "day" && (
          <OfficerLeftPanel
            mode={leftPanel}
            setMode={setLeftPanelPersist}
            onOpenShift={setDrawerShift}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <ViolationsBanner />
          {viewMode === "day" && (
            <DayCanvas
              currentDay={currentDay}
              canvasAxis={canvasAxis}
              onOpenShift={setDrawerShift}
            />
          )}
          {viewMode === "week" && <WeekView onOpenShift={setDrawerShift} />}
          {viewMode === "month" && <MonthView onOpenShift={setDrawerShift} />}
          {viewMode === "roster" && <RosterView onOpenShift={setDrawerShift} />}
          <Legend />
          <div style={{ height: 40 }} />
        </div>
      </div>

      <SchedulingDrawer shift={drawerShift} onClose={() => setDrawerShift(null)} />
    </>
  );
}
