// StatusStamp — overlay stamp across the document. Ported 1:1 from
// project/invoice-document.jsx:8-42.
import type { InvoiceStatus } from "../../data/mocks";

interface Stamp {
  label: string;
  sub: string;
  color: string;
  angle: number;
}

const STAMPS: Partial<Record<InvoiceStatus, Stamp>> = {
  paid: { label: "PAID", sub: "Thank you", color: "#0f5132", angle: -14 },
  overdue: { label: "OVERDUE", sub: "Action required", color: "#8a1820", angle: -8 },
  rejected: { label: "VOIDED", sub: "On hold", color: "#8a4b0a", angle: -10 },
  draft: { label: "DRAFT", sub: "Not issued", color: "#605e5c", angle: -6 },
};

export interface StatusStampProps {
  status: InvoiceStatus;
}

export function StatusStamp({ status }: StatusStampProps) {
  const s = STAMPS[status];
  if (!s) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 110,
        right: 36,
        transform: `rotate(${s.angle}deg)`,
        pointerEvents: "none",
        userSelect: "none",
        padding: "8px 18px",
        border: `4px solid ${s.color}`,
        borderRadius: 6,
        color: s.color,
        opacity: 0.32,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        textAlign: "center",
        mixBlendMode: "multiply",
        boxShadow: `inset 0 0 0 1px ${s.color}`,
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: "0.08em",
          lineHeight: 1,
          marginBottom: 2,
        }}
      >
        {s.label}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {s.sub}
      </div>
    </div>
  );
}
