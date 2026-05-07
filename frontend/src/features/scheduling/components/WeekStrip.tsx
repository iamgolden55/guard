// WeekStrip — week navigation + day chips + view-mode and axis segmented.
// Ported 1:1 from project/scheduling-shell.jsx WeekStrip (lines 193-308).
import type { ReactNode } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { shiftsForDay, useScheduling } from "../state/SchedulingState";
import type { CanvasAxis } from "./canvas/DayCanvas";

export type ViewMode = "day" | "week" | "month" | "roster";

export interface WeekStripProps {
  currentDay: number;
  setCurrentDay: (d: number) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  canvasAxis: CanvasAxis;
  setCanvasAxis: (a: CanvasAxis) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function WeekStrip({
  currentDay,
  setCurrentDay,
  viewMode,
  setViewMode,
  canvasAxis,
  setCanvasAxis,
  onPrev,
  onNext,
  onToday,
}: WeekStripProps) {
  const { palette } = useAccent();
  const { shifts, week } = useScheduling();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        padding: "14px 24px",
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 20,
          borderRight: `1px solid ${tokens.color.ink200}`,
        }}
      >
        <Button
          variant="secondary"
          size="sm"
          leading={<Icon name="chevron-left" size={14} />}
          onClick={onPrev}
          aria-label={viewMode === "month" ? "Previous month" : "Previous week"}
        >
          {""}
        </Button>
        <div style={{ minWidth: 180 }}>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 14.5,
              color: tokens.color.ink900,
              letterSpacing: "-0.01em",
            }}
          >
            {week.label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: tokens.color.ink500,
              marginTop: 1,
              fontFamily: tokens.font.mono,
            }}
          >
            {week.id}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leading={<Icon name="chevron-right" size={14} />}
          onClick={onNext}
          aria-label={viewMode === "month" ? "Next month" : "Next week"}
        >
          {""}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToday}>
          Today
        </Button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 6,
          paddingLeft: 20,
          paddingRight: 20,
          overflowX: "auto",
        }}
      >
        {week.days.map((d, i) => {
          const active = currentDay === i && viewMode === "day";
          const dayShifts = shiftsForDay(shifts, i);
          const hasHard = dayShifts.some((s) =>
            (s.violations || []).some((v) => v.tier === "hard"),
          );
          const hasSoft = dayShifts.some((s) =>
            (s.violations || []).some((v) => v.tier === "soft"),
          );
          const open = dayShifts.filter((s) => s.status === "open").length;
          const draft = dayShifts.filter((s) => !s.published && s.status !== "open").length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCurrentDay(i);
                setViewMode("day");
              }}
              style={{
                flex: "1 1 0",
                minWidth: 98,
                padding: "10px 10px",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                background: active
                  ? palette.soft
                  : d.today
                    ? "#fffaf6"
                    : "transparent",
                border: active
                  ? `1.5px solid ${palette.primary}`
                  : d.today
                    ? `1.5px solid ${palette.primary}44`
                    : "1.5px solid transparent",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: active ? palette.primary : tokens.color.ink600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {d.day}
                </span>
                {d.bankHoliday && (
                  <span
                    title={d.bankHoliday}
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "1px 4px",
                      borderRadius: 3,
                      background: "#eef2ff",
                      color: "#312e81",
                      letterSpacing: "0.04em",
                    }}
                  >
                    BH
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: tokens.font.display,
                  fontWeight: 800,
                  fontSize: 20,
                  color: active ? palette.dark : d.today ? palette.primary : tokens.color.ink900,
                  letterSpacing: "-0.02em",
                  marginTop: 2,
                }}
              >
                {d.dd}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginTop: 6,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    color: tokens.color.ink600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {dayShifts.length} shift{dayShifts.length === 1 ? "" : "s"}
                </span>
                {open > 0 && <Dot color={tokens.color.ink500} title={`${open} open`} />}
                {draft > 0 && <Dot color={tokens.color.warn} title={`${draft} draft`} />}
                {hasHard && <Dot color={tokens.color.danger} title="Hard block" />}
                {hasSoft && !hasHard && <Dot color={tokens.color.warn} title="Warning" />}
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingLeft: 20,
          borderLeft: `1px solid ${tokens.color.ink200}`,
        }}
      >
        <Segmented
          value={viewMode}
          setValue={(v) => setViewMode(v as ViewMode)}
          options={[
            ["day", "Day"],
            ["week", "Week"],
            ["month", "Month"],
            ["roster", "Roster"],
          ]}
        />
        {viewMode === "day" && (
          <Segmented
            value={canvasAxis}
            setValue={(v) => setCanvasAxis(v as CanvasAxis)}
            options={[
              [
                "venue",
                <span key="v" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <Icon name="map-pin" size={12} /> Venues
                </span>,
              ],
              [
                "officer",
                <span key="o" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <Icon name="users" size={12} /> Officers
                </span>,
              ],
            ]}
          />
        )}
      </div>
    </div>
  );
}

function Dot({ color, title }: { color: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

interface SegmentedProps {
  value: string;
  setValue: (v: string) => void;
  options: [string, ReactNode][];
}

function Segmented({ value, setValue, options }: SegmentedProps) {
  const { palette } = useAccent();
  return (
    <div
      style={{
        display: "inline-flex",
        background: tokens.color.ink100,
        borderRadius: 8,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map(([id, label]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setValue(id)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: active ? "white" : "transparent",
              color: active ? palette.primary : tokens.color.ink600,
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              boxShadow: active ? "0 1px 3px rgba(32,31,30,0.08)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
