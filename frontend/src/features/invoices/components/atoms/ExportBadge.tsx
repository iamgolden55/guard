import { tokens } from "../../../../design-system/tokens";
import type { ExportStatus } from "../../data/mocks";

export interface ExportBadgeProps {
  status: ExportStatus;
}

const TONES: Record<NonNullable<ExportStatus>, { color: string; bg: string; label: string }> = {
  pending: { color: "#7a5500", bg: "#fff8e1", label: "Pending" },
  processing: { color: "#0b5c9b", bg: "#e7f1fb", label: "Processing" },
  completed: { color: tokens.color.successInk, bg: tokens.color.successSoft, label: "Synced to Xero" },
  failed: { color: tokens.color.dangerInk, bg: tokens.color.dangerSoft, label: "Failed" },
};

export function ExportBadge({ status }: ExportBadgeProps) {
  if (!status) {
    return (
      <span style={{ fontSize: 11.5, color: tokens.color.ink500, fontFamily: tokens.font.body }}>
        Not exported
      </span>
    );
  }
  const c = TONES[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: tokens.font.body,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 3, background: c.color }} />
      {c.label}
    </span>
  );
}
