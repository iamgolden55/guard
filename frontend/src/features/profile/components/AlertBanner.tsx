import type { ReactNode } from "react";
import { tokens } from "../../../design-system/tokens";

export type AlertTone = "success" | "danger" | "info";

export interface AlertBannerProps {
  tone: AlertTone;
  children: ReactNode;
  onDismiss?: () => void;
}

const TONE: Record<AlertTone, { bg: string; fg: string; border: string }> = {
  success: {
    bg: tokens.color.successSoft,
    fg: tokens.color.successInk,
    border: `${tokens.color.success}33`,
  },
  danger: {
    bg: tokens.color.dangerSoft,
    fg: tokens.color.dangerInk,
    border: `${tokens.color.danger}33`,
  },
  info: {
    bg: tokens.color.infoSoft,
    fg: tokens.color.infoInk,
    border: `${tokens.color.info}33`,
  },
};

export function AlertBanner({ tone, children, onDismiss }: AlertBannerProps) {
  const t = TONE[tone];
  return (
    <div
      role="alert"
      style={{
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        borderRadius: tokens.radius.md,
        padding: "10px 14px",
        fontSize: 13,
        fontFamily: tokens.font.body,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            border: "none",
            background: "transparent",
            color: t.fg,
            cursor: "pointer",
            padding: 0,
            fontSize: 16,
            lineHeight: 1,
            opacity: 0.7,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
