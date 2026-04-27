// MonthView — 5×7 coverage heatmap.
// Ported 1:1 from project/scheduling-app.jsx MonthView (lines 101-171).
import { tokens } from "../../../design-system/tokens";
import { shiftsByDay, WEEK, type Shift } from "../data/mocks";

interface MonthCell {
  i: number;
  dayOffset: number;
  inWeek: boolean;
  dayShifts: Shift[];
  hasBH: boolean;
  published: number;
  draft: number;
  open: number;
  hard: number;
  date: Date;
}

export interface MonthViewProps {
  onOpenShift?: (s: Shift) => void;
}

export function MonthView({ onOpenShift: _onOpenShift }: MonthViewProps) {
  const cells: MonthCell[] = [];
  const monthStart = -14;
  for (let i = 0; i < 35; i++) {
    const dayOffset = monthStart + i;
    const inWeek = dayOffset >= 0 && dayOffset < 7;
    const dayShifts = inWeek ? shiftsByDay(dayOffset) : [];
    const dayInfo = inWeek ? WEEK.days[dayOffset] : undefined;
    const hasBH = !!(inWeek && dayInfo?.bankHoliday);
    const published = dayShifts.filter((s) => s.published).length;
    const draft = dayShifts.filter((s) => !s.published && s.status !== "open").length;
    const open = dayShifts.filter((s) => s.status === "open").length;
    const hard = dayShifts.filter((s) => (s.violations || []).some((v) => v.tier === "hard")).length;
    const date = new Date(2026, 3, 6 + i); // Apr 6 = Monday
    cells.push({ i, dayOffset, inWeek, dayShifts, hasBH, published, draft, open, hard, date });
  }

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
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.015em",
            color: tokens.color.ink900,
          }}
        >
          April 2026
        </div>
        <div style={{ fontSize: 12, color: tokens.color.ink600 }}>
          Coverage overview · click a day to drill in
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
        {cells.map((c) => {
          const coverage = c.dayShifts.length;
          const heat = Math.min(1, coverage / 9);
          return (
            <div
              key={c.i}
              style={{
                minHeight: 100,
                padding: "8px 10px",
                borderRight: (c.i + 1) % 7 !== 0 ? `1px solid ${tokens.color.ink200}` : "none",
                borderBottom: `1px solid ${tokens.color.ink200}`,
                background:
                  c.inWeek && c.dayOffset === 3
                    ? "#fffaf6"
                    : c.hasBH
                      ? "#eef2ff"
                      : c.inWeek
                        ? `rgba(203, 36, 49, ${heat * 0.12})`
                        : tokens.color.ink50,
                opacity: c.inWeek ? 1 : 0.55,
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
                    fontFamily: tokens.font.display,
                    fontWeight: 700,
                    fontSize: 14,
                    color: c.dayOffset === 3 ? tokens.color.danger : tokens.color.ink900,
                  }}
                >
                  {c.date.getDate()}
                </span>
                {c.hasBH && (
                  <span
                    style={{
                      fontSize: 8.5,
                      color: "#312e81",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    BH
                  </span>
                )}
              </div>
              {c.inWeek && coverage > 0 && (
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
                      shifts
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
