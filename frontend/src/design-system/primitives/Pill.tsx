// MSPill — ported 1:1 from project/design-system.jsx:178-197.
import type { ReactNode } from "react";
import { tokens } from "../tokens";

export type PillTone = "neutral" | "positive" | "warning" | "danger" | "info";

export interface PillProps {
  tone?: PillTone;
  dot?: boolean;
  children: ReactNode;
}

const TONES: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: tokens.color.ink100, fg: tokens.color.ink800, dot: tokens.color.ink600 },
  positive: { bg: tokens.color.successSoft, fg: tokens.color.successInk, dot: tokens.color.success },
  warning: { bg: tokens.color.warnSoft, fg: tokens.color.warnInk, dot: tokens.color.warn },
  danger: { bg: tokens.color.dangerSoft, fg: tokens.color.dangerInk, dot: tokens.color.danger },
  info: { bg: tokens.color.infoSoft, fg: tokens.color.infoInk, dot: tokens.color.info },
};

export function Pill({ tone = "neutral", dot, children }: PillProps) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: tokens.radius.pill,
        fontFamily: tokens.font.body,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: 3, background: t.dot }} />
      )}
      {children}
    </span>
  );
}
