// RosterView — officers × days table.
// Ported 1:1 from project/scheduling-app.jsx RosterView (lines 176-246).
// Phase 7.7: each cell is droppable (drop a shift to change officer + day);
// each assigned shift is draggable.
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { fmtHrs, fmtRange, siaState, UNAVAIL, type Shift } from "../data/mocks";
import { officerWeeklyHrs, useScheduling } from "../state/SchedulingState";

export interface RosterViewProps {
  onOpenShift: (s: Shift) => void;
}

export function RosterView({ onOpenShift }: RosterViewProps) {
  const { shifts, officers, venueById, week } = useScheduling();
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
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px repeat(7, minmax(140px, 1fr))",
            minWidth: 980,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: tokens.color.ink50,
              borderBottom: `1px solid ${tokens.color.ink200}`,
              fontSize: 10.5,
              fontWeight: 700,
              color: tokens.color.ink600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Officer
          </div>
          {week.days.map((d, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                background: d.today ? "#fffaf6" : tokens.color.ink50,
                borderBottom: `1px solid ${tokens.color.ink200}`,
                borderLeft: `1px solid ${tokens.color.ink200}`,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: tokens.color.ink600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {d.day}
              </div>
              <div
                style={{
                  fontFamily: tokens.font.display,
                  fontWeight: 700,
                  fontSize: 14,
                  color: d.today ? tokens.color.danger : tokens.color.ink900,
                }}
              >
                {d.dd}
                {d.bankHoliday && (
                  <span
                    style={{
                      fontSize: 9,
                      marginLeft: 5,
                      color: "#312e81",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    BH
                  </span>
                )}
              </div>
            </div>
          ))}

          {officers.map((o) => {
            const sia = siaState(o.sia);
            const hrsWk = officerWeeklyHrs(shifts, o.id);
            return (
              <Fragment key={o.id}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${tokens.color.ink100}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Avatar name={o.name} hue={o.hue} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: tokens.color.ink900,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {o.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: tokens.color.ink500,
                        marginTop: 1,
                        display: "flex",
                        gap: 5,
                      }}
                    >
                      {sia && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "0 4px",
                            borderRadius: 2,
                            background:
                              sia.tone === "danger" ? tokens.color.dangerSoft : tokens.color.warnSoft,
                            color:
                              sia.tone === "danger" ? tokens.color.dangerInk : tokens.color.warnInk,
                          }}
                        >
                          {sia.short}
                        </span>
                      )}
                      <span>{fmtHrs(hrsWk)}h</span>
                    </div>
                  </div>
                </div>
                {week.days.map((d, di) => {
                  const cellShifts = shifts.filter(
                    (s) => s.officerId === o.id && s.day === di,
                  );
                  const unavail = UNAVAIL.find((u) => u.officerId === o.id && u.day === di);
                  return (
                    <DroppableCell
                      key={di}
                      officerId={o.id}
                      day={di}
                      isToday={!!d.today}
                      unavail={!!unavail}
                    >
                      {unavail ? (
                        <div
                          style={{
                            fontSize: 10,
                            color: tokens.color.ink600,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Icon name={unavail.type === "leave" ? "sun" : "pause"} size={10} />
                          {unavail.type === "leave" ? "Leave" : "N/A"}
                        </div>
                      ) : (
                        cellShifts.map((s) => {
                          const venue = venueById(s.venueId);
                          if (!venue) return null;
                          const hard = (s.violations || []).some((v) => v.tier === "hard");
                          const draftPattern = !s.published;
                          return (
                            <DraggableRosterShift
                              key={s.id}
                              shift={s}
                              onClick={() => onOpenShift(s)}
                              style={{
                                padding: "4px 6px",
                                borderRadius: 4,
                                background: venue.color,
                                color: "white",
                                border: hard
                                  ? `2px solid ${tokens.color.danger}`
                                  : !s.published
                                    ? `1px solid ${tokens.color.warn}`
                                    : "1px solid transparent",
                                textAlign: "left",
                                fontFamily: tokens.font.body,
                                backgroundImage: draftPattern
                                  ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 7px)"
                                  : undefined,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {venue.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  opacity: 0.85,
                                  fontFamily: tokens.font.mono,
                                }}
                              >
                                {fmtRange(s.start, s.end)}
                              </div>
                            </DraggableRosterShift>
                          );
                        })
                      )}
                    </DroppableCell>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface DroppableCellProps {
  officerId: string;
  day: number;
  isToday: boolean;
  unavail: boolean;
  children: ReactNode;
}

function DroppableCell({ officerId, day, isToday, unavail, children }: DroppableCellProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `cell:${officerId}:${day}`,
    data: { kind: "cell", officerId, day },
    disabled: unavail,
  });
  const draggingShift =
    (active?.data.current as { kind?: string } | undefined)?.kind === "shift-block";
  const showHover = isOver && draggingShift && !unavail;
  const dragActive = !!active && draggingShift;
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: "6px 8px",
        borderBottom: `1px solid ${tokens.color.ink100}`,
        borderLeft: `1px solid ${tokens.color.ink200}`,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minHeight: 52,
        background: unavail
          ? "repeating-linear-gradient(135deg, #faf9f8, #faf9f8 6px, #f3f2f1 6px, #f3f2f1 8px)"
          : showHover
            ? `${tokens.color.success}10`
            : isToday
              ? "rgba(255,250,246,0.4)"
              : "white",
        outline: showHover ? `2px solid ${tokens.color.success}` : undefined,
        outlineOffset: showHover ? -2 : undefined,
        opacity: dragActive && unavail ? 0.5 : 1,
        transition: "background .12s ease",
      }}
    >
      {children}
    </div>
  );
}

interface DraggableRosterShiftProps {
  shift: Shift;
  onClick: () => void;
  style: CSSProperties;
  children: ReactNode;
}

function DraggableRosterShift({ shift, onClick, style, children }: DraggableRosterShiftProps) {
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
