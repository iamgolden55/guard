import { tokens } from "../../../../design-system/tokens";
import { STATUS_COLOR, type InvoiceStatus } from "../../data/mocks";

export interface InvStatusPillProps {
  status: InvoiceStatus;
  size?: "sm" | "lg";
}

export function InvStatusPill({ status, size = "sm" }: InvStatusPillProps) {
  const c = STATUS_COLOR[status];
  const padY = size === "lg" ? 5 : 2;
  const padX = size === "lg" ? 10 : 7;
  const fs = size === "lg" ? 11.5 : 10.5;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: `${padY}px ${padX}px`,
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: fs,
        fontWeight: 700,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        fontFamily: tokens.font.body,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          background: c.fg,
          opacity: 0.8,
        }}
      />
      {c.label}
    </span>
  );
}
