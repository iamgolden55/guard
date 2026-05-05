// MonthView — 6×7 calendar of the focused month, with prev/next/today nav.
// Shifts are fetched for the full grid range (see useSchedulingData with
// viewMode="month") and grouped here by their absolute `date` field.
import { useMemo } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { Shift } from "../data/mocks";
import { useScheduling } from "../state/SchedulingState";

export interface MonthViewProps {
  onOpenShift?: (s: Shift) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Drill into Day view focused on the clicked date. */
  onSelectDate: (iso: string) => void;
}

interface CellSummary {
  date: string;
  inMonth: boolean;
  today: boolean;
  shifts: Shift[];
  published: number;
  draft: number;
  open: number;
  hard: number;
}

export function MonthView({ onPrev, onNext, onToday, onSelectDate }: MonthViewProps) {
  const { shifts, monthGrid } = useScheduling();

  const cells: CellSummary[] = useMemo(() => {
    const byDate = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!s.date) continue;
      const list = byDate.get(s.date);
      if (list) list.push(s);
      else byDate.set(s.date, [s]);
    }
    return monthGrid.cells.map((c) => {
      const dayShifts = byDate.get(c.date) ?? [];
      return {
        date: c.date,
        inMonth: c.inMonth,
        today: c.today,
        shifts: dayShifts,
        published: dayShifts.filter((s) => s.published).length,
        // Any unpublished shift counts as a draft from the admin's view —
        // includes open-but-unpublished. Mirrors weekCounts in SchedulingState.
        draft: dayShifts.filter((s) => !s.published).length,
        open: dayShifts.filter((s) => s.status === "open").length,
        hard: dayShifts.filter((s) => (s.violations || []).some((v) => v.tier === "hard")).length,
      };
    });
  }, [shifts, monthGrid]);

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
      <div
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${tokens.color.ink200}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Button
          variant="secondary"
          size="sm"
          leading={<Icon name="chevron-left" size={14} />}
          onClick={onPrev}
          aria-label="Previous month"
        >
          {""}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leading={<Icon name="chevron-right" size={14} />}
          onClick={onNext}
          aria-label="Next month"
        >
          {""}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToday}>
          Today
        </Button>
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.015em",
            color: tokens.color.ink900,
            marginLeft: 4,
          }}
        >
          {monthGrid.label}
        </div>
        <div style={{ fontSize: 12, color: tokens.color.ink600, marginLeft: "auto" }}>
          Coverage overview
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderTop: `1px solid ${tokens.color.ink200}`,
        }}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            style={{
              padding: "8px 12px",
              background: tokens.color.ink50,
              borderRight: `1px solid ${tokens.color.ink200}`,
              borderBottom: `1px solid ${tokens.color.ink200}`,
              fontSize: 10.5,
              fontWeight: 700,
              color: tokens.color.ink600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          const coverage = c.shifts.length;
          const heat = Math.min(1, coverage / 9);
          const dayNum = Number(c.date.slice(8, 10));
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => onSelectDate(c.date)}
              aria-label={`Open day ${c.date}`}
              style={{
                minHeight: 100,
                padding: "8px 10px",
                border: "none",
                borderRight: (i + 1) % 7 !== 0 ? `1px solid ${tokens.color.ink200}` : "none",
                borderBottom: `1px solid ${tokens.color.ink200}`,
                background: c.today
                  ? "#fffaf6"
                  : c.inMonth
                    ? `rgba(203, 36, 49, ${heat * 0.12})`
                    : tokens.color.ink50,
                opacity: c.inMonth ? 1 : 0.55,
                position: "relative",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "inherit",
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
                    fontFamily: tokens.font.display,
                    fontWeight: 700,
                    fontSize: 14,
                    color: c.today ? tokens.color.danger : tokens.color.ink900,
                  }}
                >
                  {dayNum}
                </span>
              </div>
              {coverage > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div
                    style={{
                      fontFamily: tokens.font.display,
                      fontWeight: 800,
                      fontSize: 18,
                      color: tokens.color.ink900,
                    }}
                  >
                    {coverage}
                    <span
                      style={{
                        fontSize: 10,
                        color: tokens.color.ink600,
                        fontWeight: 500,
                        marginLeft: 3,
                      }}
                    >
                      {coverage === 1 ? "shift" : "shifts"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, fontSize: 9.5, flexWrap: "wrap" }}>
                    {c.published > 0 && (
                      <span style={{ color: tokens.color.successInk, fontWeight: 700 }}>
                        ● {c.published} pub
                      </span>
                    )}
                    {c.draft > 0 && (
                      <span style={{ color: tokens.color.warnInk, fontWeight: 700 }}>
                        ● {c.draft} drf
                      </span>
                    )}
                    {c.open > 0 && (
                      <span style={{ color: tokens.color.ink600, fontWeight: 700 }}>
                        ○ {c.open} open
                      </span>
                    )}
                  </div>
                  {c.hard > 0 && (
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "white",
                        background: tokens.color.danger,
                        display: "inline-block",
                        padding: "1px 5px",
                        borderRadius: 3,
                        marginTop: 2,
                        alignSelf: "flex-start",
                      }}
                    >
                      {c.hard} blocked
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
