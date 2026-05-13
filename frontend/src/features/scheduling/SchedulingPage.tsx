// SchedulingPage — composes header + week strip + canvas + drawer.
// Phase 7.5 wires @dnd-kit drag-drop. Phase 8.5 sources shifts/officers/venues
// from the API. Drag-drop and publish go through TanStack mutations against
// schedulerService (PATCH /shifts/{id}/, POST /shifts/publish/).
import { useCallback, useState } from "react";
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
import type { Shift } from "./data/mocks";
import { shiftDays, shiftMonth } from "./data/adapters";
import { SchedulingHeader } from "./components/SchedulingHeader";
import { WeekStrip, type ViewMode } from "./components/WeekStrip";
import { CoverageAlertBanner } from "./components/CoverageAlertBanner";
import { ViolationsBanner } from "./components/ViolationsBanner";
import { OfficerLeftPanel, type LeftPanelMode } from "./components/OfficerLeftPanel";
import { DayCanvas, type CanvasAxis } from "./components/canvas/DayCanvas";
import { WeekView } from "./components/WeekView";
import { MonthView } from "./components/MonthView";
import { RosterView } from "./components/RosterView";
import { Legend } from "./components/Legend";
import { SchedulingDrawer } from "./components/SchedulingDrawer";
import { NewShiftModal } from "./components/NewShiftModal";
import { BulkShiftWizard } from "./components/BulkShiftWizard";
import { SchedulingToast } from "./components/SchedulingToast";
import { SchedulingProvider, useScheduling } from "./state/SchedulingState";
import { useSchedulingData } from "./hooks/useSchedulingData";
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
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");

  const goPrev = useCallback(() => {
    setViewDate((d) => (viewMode === "month" ? shiftMonth(d, -1) : shiftDays(d, -7)));
  }, [viewMode]);
  const goNext = useCallback(() => {
    setViewDate((d) => (viewMode === "month" ? shiftMonth(d, 1) : shiftDays(d, 7)));
  }, [viewMode]);
  const goToday = useCallback(() => setViewDate(new Date()), []);
  const goToDate = useCallback((iso: string) => {
    // ISO is "YYYY-MM-DD"; build a local-midnight Date so getWeekForDate finds the right week.
    const [yyyy, mm, dd] = iso.split("-").map(Number);
    setViewDate(new Date(yyyy ?? 1970, (mm ?? 1) - 1, dd ?? 1));
    setViewMode("day");
  }, []);

  const {
    week,
    monthGrid,
    shifts,
    officers,
    venues,
    isLoading,
    isError,
    error,
    refetch,
    rangeAnchor,
    rangeIso,
  } = useSchedulingData({ viewDate, viewMode });

  if (isLoading) {
    return <SchedulingLoading />;
  }

  if (isError) {
    return <SchedulingError error={error} onRetry={refetch} />;
  }

  return (
    <SchedulingProvider
      initialShifts={shifts}
      officers={officers}
      venues={venues}
      week={week}
      monthGrid={monthGrid}
      rangeAnchorIso={rangeAnchor}
      shiftsQueryKey={["scheduling", "shifts", rangeIso.start, rangeIso.end]}
    >
      <SchedulingShell
        viewMode={viewMode}
        setViewMode={setViewMode}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onSelectDate={goToDate}
      />
    </SchedulingProvider>
  );
}

interface ShellProps {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDate: (iso: string) => void;
}

function SchedulingShell({
  viewMode,
  setViewMode,
  onPrev,
  onNext,
  onToday,
  onSelectDate,
}: ShellProps) {
  const {
    shifts,
    officers,
    week,
    officerById,
    venueById,
    assignOfficer,
    moveShift,
    deleteShift,
    copyLastWeek,
    publishWeek,
    isCopying,
    showToast,
    toast,
    dismissToast,
  } = useScheduling();

  const todayIdx = week.days.findIndex((d) => d.today);
  const [currentDay, setCurrentDay] = useState<number>(todayIdx >= 0 ? todayIdx : 0);
  const [canvasAxis, setCanvasAxis] = useState<CanvasAxis>("venue");
  const [leftPanel, setLeftPanel] = useState<LeftPanelMode>(() => readMode("expanded"));
  const [drawerShift, setDrawerShift] = useState<Shift | null>(null);
  const [activeOfficerId, setActiveOfficerId] = useState<string | null>(null);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const openCreateModal = useCallback(() => {
    setEditingShift(null);
    setModalOpen(true);
  }, []);
  const openBulkWizard = useCallback(() => setBulkOpen(true), []);
  const openCustomWizard = useCallback(() => setCustomOpen(true), []);
  const openEditModal = useCallback((shift: Shift) => {
    setEditingShift(shift);
    setModalOpen(true);
  }, []);
  const handleDeleteShift = useCallback(
    async (shift: Shift) => {
      const ok = window.confirm(
        `Delete this shift at ${venueById(shift.venueId)?.name ?? "this venue"}? This can't be undone.`,
      );
      if (!ok) return;
      try {
        await deleteShift(shift.id);
        setDrawerShift(null);
      } catch {
        // toast already surfaced by mutation onError
      }
    },
    [deleteShift, venueById],
  );

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
      | {
          kind?: string;
          shiftId?: string;
          axis?: "venue" | "officer";
          rowKey?: string;
          day?: number;
          officerId?: string;
        }
      | undefined;

    setActiveOfficerId(null);
    setActiveShiftId(null);

    if (!activeData) return;

    // Case A: officer card → open shift block (assignment)
    if (activeData.officerId && overData?.kind === "shift" && overData.shiftId) {
      const officer = officers.find((o) => o.id === activeData.officerId);
      const shift = shifts.find((s) => s.id === overData.shiftId);
      if (!officer || !shift || shift.status !== "open") return;

      const result = checkAssignment(officer, shift, shifts, week);

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
          const result = checkAssignment(officer, moved, shifts, week);
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
        const result = checkAssignment(newOfficer, moved, shifts, week);
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

    // Case C: shift block → day column (week view) — change shift's day.
    if (
      activeData.kind === "shift-block" &&
      activeData.shiftId &&
      overData?.kind === "weekday" &&
      typeof overData.day === "number"
    ) {
      const shift = shifts.find((s) => s.id === activeData.shiftId);
      if (!shift) return;
      if (shift.day === overData.day) return;
      const targetDay = overData.day;
      const dayLabel = week.days[targetDay]?.day ?? `Day ${targetDay + 1}`;

      const officer = officerById(shift.officerId);
      if (officer) {
        const moved: Shift = { ...shift, day: targetDay };
        const result = checkAssignment(officer, moved, shifts, week);
        if (!result.ok) {
          showToast({
            tone: "danger",
            title: `Cannot move to ${dayLabel}`,
            body: `Blocked by ${result.hard.length} rule${result.hard.length === 1 ? "" : "s"}.`,
            violations: result.all,
          });
          return;
        }
        moveShift(shift.id, { day: targetDay });
        if (result.soft.length > 0) {
          showToast({
            tone: "warning",
            title: `Moved to ${dayLabel} (with warnings)`,
            violations: result.soft,
          });
        } else {
          showToast({
            tone: "success",
            title: `Moved to ${dayLabel}`,
            body: "Saved as draft.",
          });
        }
      } else {
        moveShift(shift.id, { day: targetDay });
        showToast({
          tone: "success",
          title: `Moved to ${dayLabel}`,
          body: "Saved as draft.",
        });
      }
      return;
    }

    // Case D: shift block → roster cell — change officer + day in one drop.
    if (
      activeData.kind === "shift-block" &&
      activeData.shiftId &&
      overData?.kind === "cell" &&
      overData.officerId &&
      typeof overData.day === "number"
    ) {
      const shift = shifts.find((s) => s.id === activeData.shiftId);
      if (!shift) return;
      const targetDay = overData.day;
      const targetOfficerId = overData.officerId;
      if (shift.officerId === targetOfficerId && shift.day === targetDay) return;

      const newOfficer = officerById(targetOfficerId);
      if (!newOfficer) return;
      const dayLabel = week.days[targetDay]?.day ?? `Day ${targetDay + 1}`;
      const moved: Shift = {
        ...shift,
        officerId: newOfficer.id,
        day: targetDay,
      };
      const result = checkAssignment(newOfficer, moved, shifts, week);
      if (!result.ok) {
        showToast({
          tone: "danger",
          title: `Cannot move shift`,
          body: `${newOfficer.name} on ${dayLabel} blocked by ${result.hard.length} rule${result.hard.length === 1 ? "" : "s"}.`,
          violations: result.all,
        });
        return;
      }
      moveShift(shift.id, { officerId: newOfficer.id, day: targetDay });
      if (result.soft.length > 0) {
        showToast({
          tone: "warning",
          title: `Moved to ${newOfficer.name} · ${dayLabel} (with warnings)`,
          violations: result.soft,
        });
      } else {
        showToast({
          tone: "success",
          title: `Moved to ${newOfficer.name} · ${dayLabel}`,
          body: "Saved as draft.",
        });
      }
      return;
    }
  };

  const activeOfficer = activeOfficerId ? officerById(activeOfficerId) : undefined;
  const activeShift = activeShiftId ? shifts.find((s) => s.id === activeShiftId) : undefined;
  const activeShiftVenue = activeShift ? venueById(activeShift.venueId) : undefined;
  const activeShiftOfficer = activeShift ? officerById(activeShift.officerId) : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SchedulingHeader
        onPublish={publishWeek}
        onNewShift={openCreateModal}
        onBulkSchedule={openBulkWizard}
        onCustomShifts={openCustomWizard}
        onCopyLastWeek={copyLastWeek}
        isCopying={isCopying}
      />
      <WeekStrip
        currentDay={currentDay}
        setCurrentDay={setCurrentDay}
        viewMode={viewMode}
        setViewMode={setViewMode}
        canvasAxis={canvasAxis}
        setCanvasAxis={setCanvasAxis}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
      />

      <div style={{ display: "flex", flex: 1, minHeight: 0, background: tokens.color.ink50 }}>
        {viewMode === "day" && (
          <OfficerLeftPanel
            mode={leftPanel}
            setMode={setLeftPanelPersist}
            onOpenShift={setDrawerShift}
            onJumpToDay={setCurrentDay}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <CoverageAlertBanner onSelectShift={setDrawerShift} />
          <ViolationsBanner />
          {shifts.length === 0 ? (
            <EmptyScheduleState
              onCreate={openCreateModal}
              onCopyLastWeek={copyLastWeek}
              isCopying={isCopying}
            />
          ) : (
            <>
              {viewMode === "day" && (
                <DayCanvas
                  currentDay={currentDay}
                  canvasAxis={canvasAxis}
                  onOpenShift={setDrawerShift}
                />
              )}
              {viewMode === "week" && <WeekView onOpenShift={setDrawerShift} />}
              {viewMode === "month" && (
                <MonthView
                  onPrev={onPrev}
                  onNext={onNext}
                  onToday={onToday}
                  onSelectDate={onSelectDate}
                />
              )}
              {viewMode === "roster" && <RosterView onOpenShift={setDrawerShift} />}
              <Legend />
            </>
          )}
          <div style={{ height: 40 }} />
        </div>
      </div>

      <SchedulingDrawer
        shift={drawerShift}
        onClose={() => setDrawerShift(null)}
        onEdit={(s) => {
          setDrawerShift(null);
          openEditModal(s);
        }}
        onDelete={handleDeleteShift}
      />

      <NewShiftModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingShift={editingShift}
        defaultDate={week.days[currentDay]?.date}
      />

      <BulkShiftWizard open={bulkOpen} onClose={() => setBulkOpen(false)} />

      <BulkShiftWizard
        mode="custom"
        open={customOpen}
        onClose={() => setCustomOpen(false)}
      />

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

function SchedulingLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: 360,
        padding: "60px 24px",
        background: tokens.color.ink50,
        fontFamily: tokens.font.body,
        color: tokens.color.ink600,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 24,
            height: 24,
            margin: "0 auto 12px",
            border: `3px solid ${tokens.color.ink200}`,
            borderTopColor: tokens.color.ink600,
            borderRadius: "50%",
            animation: "ms-spin 0.9s linear infinite",
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600 }}>Loading week schedule…</div>
        <div style={{ fontSize: 11.5, marginTop: 4, color: tokens.color.ink500 }}>
          Fetching shifts, officers and venues
        </div>
      </div>
      <style>{"@keyframes ms-spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}

interface EmptyStateProps {
  onCreate: () => void;
  onCopyLastWeek: () => void;
  isCopying?: boolean;
}

function EmptyScheduleState({ onCreate, onCopyLastWeek, isCopying }: EmptyStateProps) {
  return (
    <div
      style={{
        margin: "32px 24px",
        padding: "40px 28px",
        background: "white",
        border: `1px dashed ${tokens.color.ink300}`,
        borderRadius: 12,
        textAlign: "center",
        fontFamily: tokens.font.body,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 6,
        }}
      >
        No shifts in this view
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: tokens.color.ink900,
          marginBottom: 8,
        }}
      >
        Build your week
      </div>
      <div
        style={{
          fontSize: 13,
          color: tokens.color.ink600,
          maxWidth: 520,
          margin: "0 auto 18px",
          lineHeight: 1.5,
        }}
      >
        Add shifts here, then drag staff onto open shifts to assign them. Hard
        blocks (expired SIA, leave, conflicts) reject the drop. When the week is
        ready, hit <strong>Publish week</strong> to notify everyone.
      </div>
      <div style={{ display: "inline-flex", gap: 10 }}>
        <button
          type="button"
          onClick={onCreate}
          style={{
            padding: "9px 16px",
            background: tokens.color.ink900,
            color: "white",
            border: "none",
            borderRadius: tokens.radius.md,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Create your first shift
        </button>
        <button
          type="button"
          onClick={onCopyLastWeek}
          disabled={isCopying}
          style={{
            padding: "9px 16px",
            background: "white",
            color: tokens.color.ink800,
            border: `1px solid ${tokens.color.ink300}`,
            borderRadius: tokens.radius.md,
            fontSize: 13,
            fontWeight: 600,
            cursor: isCopying ? "wait" : "pointer",
            opacity: isCopying ? 0.6 : 1,
          }}
        >
          {isCopying ? "Copying…" : "Copy last week"}
        </button>
      </div>
    </div>
  );
}

function SchedulingError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message =
    error instanceof Error ? error.message : "Could not load scheduling data.";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: 360,
        padding: "60px 24px",
        background: tokens.color.ink50,
        fontFamily: tokens.font.body,
        color: tokens.color.ink800,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: "20px 24px",
          background: "white",
          borderRadius: 10,
          border: `1px solid ${tokens.color.ink200}`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: tokens.color.dangerInk }}>
          Couldn't load the schedule
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginTop: 6,
            fontFamily: tokens.font.mono,
          }}
        >
          {message}
        </div>
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 14,
            padding: "8px 14px",
            borderRadius: 6,
            background: tokens.color.ink900,
            color: "white",
            border: "none",
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
