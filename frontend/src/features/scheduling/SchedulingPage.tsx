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
import { officerById, OFFICERS, venueById, VENUES, type Shift } from "./data/mocks";
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
  const { shifts, assignOfficer, moveShift, showToast, toast, dismissToast } = useScheduling();

  const todayIdx = WEEK.days.findIndex((d) => d.today);
  const [currentDay, setCurrentDay] = useState<number>(todayIdx >= 0 ? todayIdx : 0);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [canvasAxis, setCanvasAxis] = useState<CanvasAxis>("venue");
  const [leftPanel, setLeftPanel] = useState<LeftPanelMode>(() => readMode("expanded"));
  const [drawerShift, setDrawerShift] = useState<Shift | null>(null);
  const [activeOfficerId, setActiveOfficerId] = useState<string | null>(null);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);

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
    const data = e.active.data.current as
      | { officerId?: string; shiftId?: string; kind?: string }
      | undefined;
    if (data?.kind === "shift-block" && data.shiftId) {
      setActiveShiftId(data.shiftId);
    } else if (data?.officerId) {
      setActiveOfficerId(data.officerId);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeData = e.active.data.current as
      | { officerId?: string; shiftId?: string; kind?: string }
      | undefined;
    const overData = e.over?.data.current as
      | { kind?: string; shiftId?: string; axis?: "venue" | "officer"; rowKey?: string }
      | undefined;

    setActiveOfficerId(null);
    setActiveShiftId(null);

    if (!activeData) return;

    // Case A: officer card → open shift block (assignment)
    if (activeData.officerId && overData?.kind === "shift" && overData.shiftId) {
      const officer = OFFICERS.find((o) => o.id === activeData.officerId);
      const shift = shifts.find((s) => s.id === overData.shiftId);
      if (!officer || !shift || shift.status !== "open") return;

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
      return;
    }

    // Case B: shift block → row (reassign to a different venue or officer)
    if (
      activeData.kind === "shift-block" &&
      activeData.shiftId &&
      overData?.kind === "row" &&
      overData.rowKey
    ) {
      const shift = shifts.find((s) => s.id === activeData.shiftId);
      if (!shift) return;

      // No-op if dropped on the same row.
      const sameRow =
        (overData.axis === "venue" && shift.venueId === overData.rowKey) ||
        (overData.axis === "officer" && shift.officerId === overData.rowKey);
      if (sameRow) return;

      if (overData.axis === "venue") {
        const newVenue = venueById(overData.rowKey);
        if (!newVenue) return;
        // Officer-side check is unchanged; we simulate the move by passing
        // a synthetic "moved" shift to the validator.
        const officer = officerById(shift.officerId);
        if (officer) {
          const moved: Shift = { ...shift, venueId: newVenue.id };
          const result = checkAssignment(officer, moved, shifts);
          if (!result.ok) {
            showToast({
              tone: "danger",
              title: `Cannot move shift`,
              body: `${officer.name} → ${newVenue.name} blocked by ${result.hard.length} rule${result.hard.length === 1 ? "" : "s"}.`,
              violations: result.all,
            });
            return;
          }
          moveShift(shift.id, { venueId: newVenue.id });
          if (result.soft.length > 0) {
            showToast({
              tone: "warning",
              title: `Moved to ${newVenue.name} (with warnings)`,
              violations: result.soft,
            });
          } else {
            showToast({
              tone: "success",
              title: `Moved to ${newVenue.name}`,
              body: "Saved as draft.",
            });
          }
        } else {
          // No officer assigned — just move the venue, no officer-level checks.
          moveShift(shift.id, { venueId: newVenue.id });
          showToast({
            tone: "success",
            title: `Moved to ${newVenue.name}`,
            body: "Saved as draft.",
          });
        }
        return;
      }

      if (overData.axis === "officer") {
        const newOfficer = officerById(overData.rowKey);
        if (!newOfficer) return;
        const moved: Shift = { ...shift, officerId: newOfficer.id };
        const result = checkAssignment(newOfficer, moved, shifts);
        if (!result.ok) {
          showToast({
            tone: "danger",
            title: `Cannot reassign to ${newOfficer.name}`,
            body: `${result.hard.length} hard block${result.hard.length === 1 ? "" : "s"} — resolve before reassigning.`,
            violations: result.all,
          });
          return;
        }
        moveShift(shift.id, { officerId: newOfficer.id });
        if (result.soft.length > 0) {
          showToast({
            tone: "warning",
            title: `Reassigned to ${newOfficer.name} (with warnings)`,
            violations: result.soft,
          });
        } else {
          showToast({
            tone: "success",
            title: `Reassigned to ${newOfficer.name}`,
            body: "Saved as draft.",
          });
        }
        return;
      }
    }
  };

  const activeOfficer = activeOfficerId ? officerById(activeOfficerId) : undefined;
  const activeShift = activeShiftId ? shifts.find((s) => s.id === activeShiftId) : undefined;
  const activeShiftVenue = activeShift ? venueById(activeShift.venueId) : undefined;
  const activeShiftOfficer = activeShift ? officerById(activeShift.officerId) : undefined;
  void VENUES; // silence unused if VENUES isn't otherwise referenced

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

        {activeShift && activeShiftVenue && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 8,
              background: activeShiftVenue.color,
              color: "white",
              boxShadow: "0 12px 24px -6px rgba(32,31,30,0.25)",
              fontFamily: tokens.font.body,
              cursor: "grabbing",
              minWidth: 200,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeShiftOfficer?.name ?? "Open shift"}
            </span>
            <span
              style={{
                fontSize: 11,
                opacity: 0.85,
                fontFamily: tokens.font.mono,
              }}
            >
              {activeShiftVenue.name}
            </span>
          </div>
        )}
      </DragOverlay>

      {toast && <SchedulingToast toast={toast} onDismiss={dismissToast} />}
    </DndContext>
  );
}
