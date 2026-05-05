// DayCanvas — Gantt-style timeline for one day, rows = venues OR officers.
// Ported 1:1 from project/scheduling-canvas.jsx:214-340.
// Phase 7.6: rows are droppable so a ShiftBlock can be dragged onto them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import {
  fmtH,
  fmtHrs,
  HOURS_END,
  HOURS_START,
  UNAVAIL,
  type Shift,
} from "../../data/mocks";
import { officerWeeklyHrs, shiftsForDay, useScheduling } from "../../state/SchedulingState";
import { HOUR_W, HourHeader } from "./HourHeader";
import { OfficerRowHeader, VenueRowHeader } from "./RowHeaders";
import { ShiftBlock, type ColorBy } from "./ShiftBlock";

export type CanvasAxis = "venue" | "officer";

export interface DayCanvasProps {
  currentDay: number;
  canvasAxis?: CanvasAxis;
  colorBy?: ColorBy;
  onOpenShift: (shift: Shift) => void;
}

export function DayCanvas({
  currentDay,
  canvasAxis = "venue",
  colorBy = "venue",
  onOpenShift,
}: DayCanvasProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { shifts, officers, venues, week } = useScheduling();
  const day = week.days[currentDay];
  const dayShifts = shiftsForDay(shifts, currentDay);

  // Live "now" indicator — ticks every 60s so the red line tracks real time.
  // Only shown when the canvas day is today AND the current hour falls inside
  // the visible window (HOURS_START..HOURS_END). Outside that window — e.g.
  // 1 AM when the canvas starts at 5 AM — the line is hidden.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const liveHour = now.getHours() + now.getMinutes() / 60;
  const nowHour =
    day?.today && liveHour >= HOURS_START && liveHour < HOURS_END ? liveHour : null;

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = (8 - HOURS_START) * HOUR_W;
    }
  }, [currentDay, canvasAxis]);

  if (!day) return null;

  const rows =
    canvasAxis === "venue"
      ? venues.map((v) => ({
          key: v.id,
          unavail: undefined as { type: "leave" | "unavailable"; reason: string } | undefined,
          header: <VenueRowHeader v={v} />,
          shifts: packLanes(dayShifts.filter((s) => s.venueId === v.id)),
        }))
      : officers.map((o) => {
          const unavail = UNAVAIL.find((u) => u.officerId === o.id && u.day === currentDay);
          return {
            key: o.id,
            unavail: unavail
              ? { type: unavail.type, reason: unavail.reason }
              : undefined,
            header: (
              <OfficerRowHeader
                o={o}
                weeklyHrs={officerWeeklyHrs(shifts, o.id)}
                unavailToday={!!unavail}
              />
            ),
            shifts: packLanes(dayShifts.filter((s) => s.officerId === o.id)),
          };
        });

  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 12,
        overflow: "hidden",
        margin: "16px 24px",
        display: "flex",
        flexDirection: "column",
        minHeight: 400,
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${tokens.color.ink200}`,
          display: "flex",
          alignItems: "center",
          gap: 20,
          background: day.bankHoliday ? "#eef2ff" : "white",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 17,
              color: tokens.color.ink900,
              letterSpacing: "-0.015em",
            }}
          >
            {day.day} {day.dd} Apr 2026
            {day.today && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color: "white",
                  background: tokens.color.danger,
                  padding: "2px 6px",
                  borderRadius: 3,
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                }}
              >
                TODAY
              </span>
            )}
          </div>
          {day.bankHoliday && (
            <div
              style={{
                fontSize: 11.5,
                color: "#312e81",
                marginTop: 3,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="pin" size={11} /> {day.bankHoliday} · bank holiday uplift applies
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <DaySummary shifts={dayShifts} />
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: `1px solid ${tokens.color.ink200}`,
            background: "white",
          }}
        >
          <div
            style={{
              height: 41,
              borderBottom: `1px solid ${tokens.color.ink200}`,
              background: tokens.color.ink50,
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: tokens.color.ink600,
              }}
            >
              {canvasAxis === "venue" ? "Venue" : "Officer"}
            </span>
          </div>
          {rows.map((r) => (
            <div key={r.key}>{r.header}</div>
          ))}
        </div>

        <div
          ref={scrollerRef}
          style={{
            flex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              minWidth: (HOURS_END - HOURS_START) * HOUR_W,
              position: "relative",
            }}
          >
            <HourHeader currentHour={nowHour} />

            {rows.map((r) => (
              <DroppableRow
                key={r.key}
                rowKey={r.key}
                axis={canvasAxis}
                disabled={!!r.unavail}
                background={
                  r.unavail
                    ? "repeating-linear-gradient(135deg, #faf9f8, #faf9f8 8px, #f3f2f1 8px, #f3f2f1 10px)"
                    : "white"
                }
              >
                {Array.from({ length: HOURS_END - HOURS_START }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: i * HOUR_W,
                      width: 1,
                      background:
                        (i + HOURS_START) % 24 === 0 ? tokens.color.ink300 : tokens.color.ink100,
                    }}
                  />
                ))}
                {r.unavail && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 12,
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "white",
                      border: `1px dashed ${tokens.color.ink500}`,
                      fontSize: 11.5,
                      color: tokens.color.ink600,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Icon name={r.unavail.type === "leave" ? "sun" : "pause"} size={11} />
                    {r.unavail.reason}
                  </div>
                )}
                {r.shifts.map(({ shift, lane, totalLanes }) => (
                  <ShiftBlock
                    key={shift.id}
                    shift={shift}
                    lane={lane}
                    totalLanes={totalLanes}
                    onOpen={onOpenShift}
                    colorBy={colorBy}
                  />
                ))}
              </DroppableRow>
            ))}

            {nowHour != null && (
              <div
                style={{
                  position: "absolute",
                  top: 41,
                  bottom: 0,
                  left: (nowHour - HOURS_START) * HOUR_W,
                  width: 2,
                  background: tokens.color.danger,
                  pointerEvents: "none",
                  zIndex: 6,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    left: -4,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: tokens.color.danger,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: -18,
                    left: 8,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: tokens.color.danger,
                    color: "white",
                    fontSize: 10,
                    fontFamily: tokens.font.mono,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  Now · {fmtH(nowHour)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DroppableRowProps {
  rowKey: string;
  axis: CanvasAxis;
  disabled: boolean;
  background: string;
  children: ReactNode;
}

function DroppableRow({ rowKey, axis, disabled, background, children }: DroppableRowProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `row:${axis}:${rowKey}`,
    data: { kind: "row", axis, rowKey },
    disabled,
  });
  // Only highlight when an existing shift block is being dragged.
  const dragging = !!active;
  const draggingShift = (active?.data.current as { kind?: string } | undefined)?.kind === "shift-block";
  const showHover = isOver && draggingShift && !disabled;
  return (
    <div
      ref={setNodeRef}
      style={{
        position: "relative",
        height: 72,
        borderBottom: `1px solid ${tokens.color.ink100}`,
        background,
        outline: showHover ? `2px solid ${tokens.color.success}` : undefined,
        outlineOffset: showHover ? -2 : undefined,
        boxShadow: showHover ? `inset 0 0 0 9999px ${tokens.color.success}10` : undefined,
        transition: "box-shadow .12s ease",
        // Faint indicator while a shift drag is active so the user sees
        // available drop targets even before hovering.
        opacity: dragging && draggingShift && disabled ? 0.5 : 1,
      }}
    >
      {children}
    </div>
  );
}

function DaySummary({ shifts }: { shifts: Shift[] }) {
  const published = shifts.filter((s) => s.published).length;
  const draft = shifts.filter((s) => !s.published && s.status !== "open").length;
  const open = shifts.filter((s) => s.status === "open").length;
  const totalHrs = shifts.reduce((a, s) => a + (s.end - s.start), 0);
  const hard = shifts.filter((s) => (s.violations || []).some((v) => v.tier === "hard")).length;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <Stat label="Shifts" value={String(shifts.length)} />
      <Stat label="Hours" value={`${fmtHrs(totalHrs)}h`} />
      <Stat label="Published" value={String(published)} color="#0f766e" />
      {draft > 0 && <Stat label="Drafts" value={String(draft)} color={tokens.color.warn} />}
      {open > 0 && <Stat label="Open" value={String(open)} color={tokens.color.ink600} />}
      {hard > 0 && <Stat label="Blocked" value={String(hard)} color={tokens.color.danger} />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        background: tokens.color.ink50,
        border: `1px solid ${tokens.color.ink200}`,
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        fontFamily: tokens.font.body,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          color: tokens.color.ink600,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: color || tokens.color.ink900,
          fontFamily: tokens.font.display,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface PackedShift {
  shift: Shift;
  lane: number;
  totalLanes: number;
}

/**
 * Greedy interval scheduling — assigns each shift to the lowest-numbered lane
 * whose previous shift has already ended by this shift's start time. Used to
 * stack overlapping shifts (e.g. multi-officer slots at the same venue/time)
 * vertically inside a single canvas row.
 */
function packLanes(input: Shift[]): PackedShift[] {
  const sorted = [...input].sort((a, b) => a.start - b.start || b.end - a.end);
  const laneEnds: number[] = [];
  const placed: { shift: Shift; lane: number }[] = [];
  for (const s of sorted) {
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = s.end;
    placed.push({ shift: s, lane });
  }
  const totalLanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, totalLanes }));
}
