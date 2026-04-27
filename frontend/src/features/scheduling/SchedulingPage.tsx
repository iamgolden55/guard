// SchedulingPage — composes header + week strip + canvas + drawer.
// Phase 7.5 wires @dnd-kit drag-drop: drag an officer card from the
// LeftPanel onto an open ShiftBlock to assign with violation pre-flight.
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { tokens } from "../../design-system/tokens";
import { Avatar } from "../../design-system/primitives/Avatar";
import { officerById, OFFICERS, type Shift } from "./data/mocks";
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
import { SchedulingToast } from "./components/SchedulingToast";
import { SchedulingProvider, useScheduling } from "./state/SchedulingState";
import { WEEK } from "./data/mocks";
import { checkAssignment } from "./lib/violations";

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
  return (
    <SchedulingProvider>
      <SchedulingShell />
    </SchedulingProvider>
  );
}

function SchedulingShell() {
  const { shifts, assignOfficer, showToast, toast, dismissToast } = useScheduling();

  const todayIdx = WEEK.days.findIndex((d) => d.today);
  const [currentDay, setCurrentDay] = useState<number>(todayIdx >= 0 ? todayIdx : 0);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [canvasAxis, setCanvasAxis] = useState<CanvasAxis>("venue");
  const [leftPanel, setLeftPanel] = useState<LeftPanelMode>(() => readMode("expanded"));
  const [drawerShift, setDrawerShift] = useState<Shift | null>(null);
  const [activeOfficerId, setActiveOfficerId] = useState<string | null>(null);

  const setLeftPanelPersist = (m: LeftPanelMode) => {
    setLeftPanel(m);
    try {
      localStorage.setItem(LEFT_PANEL_KEY, m);
    } catch {
      // ignore
    }
  };

  // Require a small drag distance before activating — lets click-to-open the
  // officer card work without triggering a phantom drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { officerId?: string } | undefined;
    if (data?.officerId) setActiveOfficerId(data.officerId);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveOfficerId(null);
    const officerId = (e.active.data.current as { officerId?: string } | undefined)?.officerId;
    const dropData = e.over?.data.current as { shiftId?: string; kind?: string } | undefined;
    if (!officerId || !dropData?.shiftId) return;

    const officer = OFFICERS.find((o) => o.id === officerId);
    const shift = shifts.find((s) => s.id === dropData.shiftId);
    if (!officer || !shift) return;
    if (shift.status !== "open") return;

    const result = checkAssignment(officer, shift, shifts);

    if (!result.ok) {
      showToast({
        tone: "danger",
        title: `Cannot assign ${officer.name}`,
        body: `${result.hard.length} hard block${result.hard.length === 1 ? "" : "s"} — resolve before assigning.`,
        violations: result.all,
      });
      return;
    }

    assignOfficer(shift.id, officer.id);

    if (result.soft.length > 0) {
      showToast({
        tone: "warning",
        title: `Assigned ${officer.name} (with warnings)`,
        body: `${result.soft.length} soft warning${result.soft.length === 1 ? "" : "s"} — admin can acknowledge.`,
        violations: result.soft,
      });
    } else {
      showToast({
        tone: "success",
        title: `Assigned ${officer.name}`,
        body: "Saved as draft — publish week when you're ready.",
      });
    }
  };

  const activeOfficer = activeOfficerId ? officerById(activeOfficerId) : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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

      <DragOverlay dropAnimation={null}>
        {activeOfficer && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px 8px 8px",
              borderRadius: 999,
              background: "white",
              border: `1px solid ${tokens.color.ink200}`,
              boxShadow: "0 12px 24px -6px rgba(32,31,30,0.25)",
              fontFamily: tokens.font.body,
              cursor: "grabbing",
            }}
          >
            <Avatar name={activeOfficer.name} hue={activeOfficer.hue} size={28} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: tokens.color.ink900,
                whiteSpace: "nowrap",
              }}
            >
              {activeOfficer.name}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: tokens.color.ink100,
                color: tokens.color.ink600,
                letterSpacing: "0.04em",
              }}
            >
              {activeOfficer.sia.level}
            </span>
          </div>
        )}
      </DragOverlay>

      {toast && <SchedulingToast toast={toast} onDismiss={dismissToast} />}
    </DndContext>
  );
}
