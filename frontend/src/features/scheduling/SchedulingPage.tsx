// SchedulingPage — composes header + week strip + canvas + drawer.
// Ported from project/scheduling-app.jsx with Day view as the focus;
// Week / Month / Roster views render placeholders to be built in
// Phase 7.5 alongside @dnd-kit drag-drop and the violation engine.
import { useState } from "react";
import { useAccent } from "../../contexts/AccentContext";
import { Card } from "../../design-system/primitives/Card";
import { tokens } from "../../design-system/tokens";
import { SchedulingHeader } from "./components/SchedulingHeader";
import { WeekStrip, type ViewMode } from "./components/WeekStrip";
import { ViolationsBanner } from "./components/ViolationsBanner";
import { OfficerLeftPanel, type LeftPanelMode } from "./components/OfficerLeftPanel";
import { DayCanvas, type CanvasAxis } from "./components/canvas/DayCanvas";
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
  const { palette } = useAccent();
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
          {viewMode !== "day" && (
            <div style={{ padding: "24px 24px 0" }}>
              <Card padding={28} style={{ maxWidth: 720 }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: tokens.font.display,
                    fontSize: 18,
                    fontWeight: 700,
                    color: tokens.color.ink900,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {viewMode === "week" && "Week grid"}
                  {viewMode === "month" && "Month coverage heatmap"}
                  {viewMode === "roster" && "Officer roster"}
                </h2>
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: tokens.color.ink600,
                    lineHeight: 1.5,
                  }}
                >
                  Phase 7.5 — alongside @dnd-kit drag-drop and the violation engine.
                  Switch back to <strong style={{ color: palette.primary }}>Day</strong> to see
                  the full canvas.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>

      <SchedulingDrawer shift={drawerShift} onClose={() => setDrawerShift(null)} />
    </>
  );
}
