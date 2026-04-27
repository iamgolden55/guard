// DeltaBadge — small inline pill showing a metric delta. Used in KPI cards.
// Ported from project/dashboard.jsx:377-388.
import type { ReactNode } from "react";
import { tokens } from "../tokens";
import { Icon } from "../Icon";

export type DeltaDirection = "up" | "down" | "neutral";

export interface DeltaBadgeProps {
  children: ReactNode;
  direction?: DeltaDirection;
}

export function DeltaBadge({ children, direction = "neutral" }: DeltaBadgeProps) {
  const isNeutral = direction === "neutral";
  const isUp = direction === "up";

  const fg = isNeutral
    ? tokens.color.ink600
    : isUp
      ? tokens.color.success
      : tokens.color.danger;
  const bg = isNeutral
    ? tokens.color.ink100
    : isUp
      ? tokens.color.successSoft
      : tokens.color.dangerSoft;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11.5,
        fontWeight: 700,
        color: fg,
        background: bg,
        padding: "2px 7px",
        borderRadius: 999,
      }}
    >
      {!isNeutral && <Icon name={isUp ? "arrow-up" : "arrow-down"} size={10} />}
      {children}
    </span>
  );
}
