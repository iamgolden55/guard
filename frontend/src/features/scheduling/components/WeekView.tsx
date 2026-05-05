// WeekView — 7-day grid, 06:00–26:00 vertical hours.
// Ported 1:1 from project/scheduling-app.jsx WeekView (lines 10-96).
// Phase 7.7: each day column is droppable (move shift between days);
// each assigned shift block is draggable.
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { tokens } from "../../../design-system/tokens";
import { fmtRange, type Shift } from "../data/mocks";
import { shiftsForDay, useScheduling } from "../state/SchedulingState";
import type { ColorBy } from "./canvas/ShiftBlock";

const DAY_W = 170;
const HOUR_H = 24;
const START_H = 6;
const END_H = 26;

export interface WeekViewProps {
  colorBy?: ColorBy;
  onOpenShift: (s: Shift) => void;
}

export function WeekView({ colorBy = "venue", onOpenShift }: WeekViewProps) {
  const { shifts, officerById, venueById, week } = useScheduling();
  const hoursArr = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

  return (
    <div
      style={{
        margin: "16px 24px",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", borderBottom: `1px solid ${tokens.color.ink200}`, background: "white" }}>
        <div
          style={{
            width: 56,
            flexShrink: 0,
            background: tokens.color.ink50,
            borderRight: `1px solid ${tokens.color.ink200}`,
          }}
        />
        {week.days.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: DAY_W,
              padding: "12px 14px",
              borderRight: i < 6 ? `1px solid ${tokens.color.ink200}` : "none",
              background: d.today ? "#fffaf6" : d.bankHoliday ? "#eef2ff" : "white",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: tokens.color.ink600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {d.day}
            </div>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 800,
                fontSize: 20,
                color: d.today ? tokens.color.danger : tokens.color.ink900,
                letterSpacing: "-0.02em",
              }}
            >
              {d.dd}
            </div>
            {d.bankHoliday && (
              <div style={{ fontSize: 10, color: "#312e81", marginTop: 2, fontWeight: 600 }}>
                {d.bankHoliday}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ position: "relative", display: "flex", overflow: "auto", maxHeight: 620 }}>
        <div
          style={{
            width: 56,
            flexShrink: 0,
            background: tokens.color.ink50,
            borderRight: `1px solid ${tokens.color.ink200}`,
            position: "sticky",
            left: 0,
            zIndex: 2,
          }}
        >
          {hoursArr.map((h) => (
            <div
              key={h}
              style={{
                height: HOUR_H,
                borderBottom: `1px solid ${tokens.color.ink100}`,
                padding: "2px 6px",
                fontFamily: tokens.font.mono,
                fontSize: 10,
                color: tokens.color.ink500,
              }}
            >
              {String(h % 24).padStart(2, "0")}
            </div>
          ))}
        </div>

        {week.days.map((d, di) => {
          const dayShifts = shiftsForDay(shifts, di);
          return (
            <DroppableDayColumn
              key={di}
              day={di}
              isToday={!!d.today}
              isLast={di === 6}
            >
              {hoursArr.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_H, borderBottom: `1px solid ${tokens.color.ink100}` }}
                />
              ))}
              {dayShifts.map((s) => {
                const venue = venueById(s.venueId);
                const officer = officerById(s.officerId);
                if (!venue) return null;
                const hard = (s.violations || []).some((v) => v.tier === "hard");
                const soft = (s.violations || []).some((v) => v.tier === "soft");
                const top = (s.start - START_H) * HOUR_H + 2;
                const height = (s.end - s.start) * HOUR_H - 4;
                const draftPattern = !s.published;
                const draftStripeColor =
                  s.status === "open" ? "rgba(217, 119, 6, 0.18)" : "rgba(255, 255, 255, 0.22)";
                const bg =
                  s.status === "open"
                    ? "white"
                    : colorBy === "status"
                      ? s.published
                        ? "#0f766e"
                        : tokens.color.warn
                      : venue.color;
                const surnameInitial = officer?.name.split(" ")[1]?.[0] ?? "";
                const label = officer ? `${officer.name.split(" ")[0]} ${surnameInitial}.` : "Open";
                return (
                  <DraggableWeekShift
                    key={s.id}
                    shift={s}
                    onClick={() => onOpenShift(s)}
                    style={{
                      position: "absolute",
                      top,
                      height,
                      left: 3,
                      right: 3,
                      borderRadius: 5,
                      background: bg,
                      color: s.status === "open" ? tokens.color.ink900 : "white",
                      border:
                        s.status === "open"
                          ? `1.5px dashed ${tokens.color.ink500}`
                          : hard
                            ? `2px solid ${tokens.color.danger}`
                            : soft
                              ? `2px solid ${tokens.color.warn}`
                              : `1px solid ${s.published ? "transparent" : tokens.color.warn}`,
                      padding: "4px 6px",
                      textAlign: "left",
                      overflow: "hidden",
                      fontFamily: tokens.font.body,
                      backgroundImage: draftPattern
                        ? `repeating-linear-gradient(45deg, transparent, transparent 4px, ${draftStripeColor} 4px, ${draftStripeColor} 7px)`
                        : undefined,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {label}
                    </div>
                    {height > 28 && (
                      <div style={{ fontSize: 9.5, opacity: 0.85, fontFamily: tokens.font.mono }}>
                        {fmtRange(s.start, s.end)}
                      </div>
                    )}
                    {height > 44 && (
                      <div
                        style={{
                          fontSize: 9,
                          opacity: 0.75,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 1,
                        }}
                      >
                        {venue.name}
                      </div>
                    )}
                  </DraggableWeekShift>
                );
              })}
            </DroppableDayColumn>
          );
        })}
      </div>
    </div>
  );
}

interface DroppableDayColumnProps {
  day: number;
  isToday: boolean;
  isLast: boolean;
  children: ReactNode;
}

function DroppableDayColumn({ day, isToday, isLast, children }: DroppableDayColumnProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `weekday:${day}`,
    data: { kind: "weekday", day },
  });
  const draggingShift =
    (active?.data.current as { kind?: string } | undefined)?.kind === "shift-block";
  const showHover = isOver && draggingShift;
  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        minWidth: DAY_W,
        borderRight: !isLast ? `1px solid ${tokens.color.ink200}` : "none",
        position: "relative",
        background: showHover
          ? `${tokens.color.success}10`
          : isToday
            ? "rgba(255,250,246,0.5)"
            : "white",
        outline: showHover ? `2px solid ${tokens.color.success}` : undefined,
        outlineOffset: showHover ? -2 : undefined,
        transition: "background .12s ease",
      }}
    >
      {children}
    </div>
  );
}

interface DraggableWeekShiftProps {
  shift: Shift;
  onClick: () => void;
  style: React.CSSProperties;
  children: ReactNode;
}

function DraggableWeekShift({ shift, onClick, style, children }: DraggableWeekShiftProps) {
  const draggableEnabled = shift.officerId !== null && shift.status !== "completed";
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `shift-drag:${shift.id}`,
    data: { shiftId: shift.id, kind: "shift-block" },
    disabled: !draggableEnabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      {...(draggableEnabled ? listeners : {})}
      {...(draggableEnabled ? attributes : {})}
      style={{
        ...style,
        opacity: isDragging ? 0.45 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: draggableEnabled ? "none" : undefined,
        cursor: draggableEnabled ? (isDragging ? "grabbing" : "grab") : "pointer",
      }}
    >
      {children}
    </button>
  );
}
