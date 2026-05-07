// HourHeader — sticky top of the day canvas, hour ruler 05:00 → 29:00.
// Ported 1:1 from project/scheduling-canvas.jsx:20-50.
import { tokens } from "../../../../design-system/tokens";
import { HOURS_END, HOURS_START } from "../../data/mocks";

export const HOUR_W = 60;

export interface HourHeaderProps {
  currentHour?: number | null;
}

export function HourHeader({ currentHour }: HourHeaderProps) {
  const hours: number[] = [];
  for (let h = HOURS_START; h <= HOURS_END; h++) hours.push(h);

  return (
    <div
      style={{
        display: "flex",
        position: "sticky",
        top: 0,
        zIndex: 4,
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        minWidth: (HOURS_END - HOURS_START) * HOUR_W,
      }}
    >
      {hours.slice(0, -1).map((h) => {
        const isNoon = h % 24 === 12;
        const isCurrent = currentHour != null && Math.floor(currentHour) === h;
        return (
          <div
            key={h}
            style={{
              width: HOUR_W,
              flexShrink: 0,
              borderRight: `1px solid ${tokens.color.ink100}`,
              padding: "10px 8px 8px",
              background: isCurrent ? "#fffaf6" : "transparent",
            }}
          >
            <div
              style={{
                fontFamily: tokens.font.mono,
                fontSize: 11,
                color: isNoon || h >= 24 ? tokens.color.ink600 : tokens.color.ink500,
                fontWeight: isNoon || isCurrent ? 700 : 500,
              }}
            >
              {String(h % 24).padStart(2, "0")}:00
              {h >= 24 && (
                <span style={{ marginLeft: 4, color: tokens.color.danger, fontSize: 9 }}>+1</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
