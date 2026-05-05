// Heatmap — 7 days × 24 hours. Ported 1:1 from project/dashboard.jsx
// Heatmap component (lines 424-487). Reused by Phase 4 (Attendance).
import { useState } from "react";
import { tokens } from "../tokens";

export interface HeatmapProps {
  /** 7 rows (days) × 24 cols (hours) of values 0..1. */
  data: number[][];
  /** Hex colour to interpolate from pale to. Defaults to accent.primary CSS var. */
  accentHex?: string;
  /** Cell size in px. Default 14. */
  cell?: number;
  /** Gap between cells in px. Default 3. */
  gap?: number;
  /** Day labels — 7 entries. Default English Mon-Sun. */
  days?: string[];
  /** When set, hover preview shows `{prefix} coverage X%` instead of plain percent. */
  hoverLabel?: string;
}

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hexToRgba(hex: string, alpha: number): string {
  const a = Number.parseInt(hex.slice(1, 3), 16);
  const b = Number.parseInt(hex.slice(3, 5), 16);
  const c = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${a},${b},${c},${alpha.toFixed(2)})`;
}

export function Heatmap({
  data,
  accentHex = tokens.color.primary,
  cell = 14,
  gap = 3,
  days = DEFAULT_DAYS,
}: HeatmapProps) {
  const [hover, setHover] = useState<{ d: number; h: number; v: number } | null>(null);

  const colorFor = (v: number) => hexToRgba(accentHex, 0.08 + v * 0.85);

  return (
    <div>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: tokens.color.ink600,
          marginBottom: 12,
        }}
      >
        <span>Low</span>
        {[0.1, 0.3, 0.55, 0.8, 1].map((v) => (
          <span
            key={v}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: colorFor(v),
            }}
          />
        ))}
        <span>High</span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {/* Day labels */}
        <div style={{ display: "flex", flexDirection: "column", gap, paddingTop: 22 }}>
          {days.map((d) => (
            <div
              key={d}
              style={{
                height: cell,
                fontSize: 10.5,
                color: tokens.color.ink500,
                fontWeight: 600,
                lineHeight: `${cell}px`,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {/* Hour axis */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(24, 1fr)",
              gap,
              marginBottom: 4,
            }}
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                style={{
                  fontSize: 9,
                  color: tokens.color.ink500,
                  textAlign: "center",
                  fontFamily: tokens.font.mono,
                  height: 14,
                }}
              >
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: "grid", gap, gridTemplateRows: `repeat(7, ${cell}px)` }}>
            {data.map((row, d) => (
              <div
                key={d}
                style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap }}
              >
                {row.map((v, h) => (
                  <div
                    key={h}
                    onMouseEnter={() => setHover({ d, h, v })}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      height: cell,
                      borderRadius: 3,
                      background: colorFor(v),
                      cursor: "pointer",
                      outline:
                        hover && hover.d === d && hover.h === h
                          ? `2px solid ${accentHex}`
                          : "none",
                      outlineOffset: 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          color: tokens.color.ink600,
          minHeight: 18,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {hover ? (
          <>
            <strong style={{ color: tokens.color.ink900 }}>
              {days[hover.d]} · {String(hover.h).padStart(2, "0")}:00
            </strong>{" "}
            — coverage {Math.round(hover.v * 100)}%
          </>
        ) : (
          <span>Hover a cell to inspect coverage</span>
        )}
      </div>
    </div>
  );
}
