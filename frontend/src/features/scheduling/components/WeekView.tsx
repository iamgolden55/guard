// WeekView — 7-day grid, 06:00–26:00 vertical hours.
// Ported 1:1 from project/scheduling-app.jsx WeekView (lines 10-96).
import { tokens } from "../../../design-system/tokens";
import {
  fmtRange,
  officerById,
  shiftsByDay,
  venueById,
  WEEK,
  type Shift,
} from "../data/mocks";
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
        {WEEK.days.map((d, i) => (
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

        {WEEK.days.map((d, di) => {
          const dayShifts = shiftsByDay(di);
          return (
            <div
              key={di}
              style={{
                flex: 1,
                minWidth: DAY_W,
                borderRight: di < 6 ? `1px solid ${tokens.color.ink200}` : "none",
                position: "relative",
                background: d.today ? "rgba(255,250,246,0.5)" : "white",
              }}
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
                const draftPattern = !s.published && s.status !== "open";
                const bg =
                  s.status === "open"
                    ? "white"
                    : colorBy === "status"
                      ? s.published
                        ? "#0f766e"
                        : tokens.color.warn
                      : venue.color;
                const surnameInitial = officer?.name.split(" ")[1]?.[0] ?? "";
                return (
                  <button
                    key={s.id}
                    type="button"
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
                      cursor: "pointer",
                      backgroundImage: draftPattern
                        ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.18) 4px, rgba(255,255,255,0.18) 7px)"
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
                      {officer ? `${officer.name.split(" ")[0]} ${surnameInitial}.` : "Open"}
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
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
