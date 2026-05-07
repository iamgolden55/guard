import type { ReactNode } from "react";
import { tokens } from "../../../design-system/tokens";

export interface KeyValueGridItem {
  label: string;
  value: ReactNode;
}

export interface KeyValueGridProps {
  columns?: 1 | 2 | 3;
  items: KeyValueGridItem[];
}

export function KeyValueGrid({ columns = 2, items }: KeyValueGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "14px 24px",
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontWeight: 700,
              fontSize: 10.5,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: tokens.color.ink500,
              marginBottom: 4,
            }}
          >
            {it.label}
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13.5,
              color: tokens.color.ink900,
              wordBreak: "break-word",
            }}
          >
            {it.value || <span style={{ color: tokens.color.ink500 }}>—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
