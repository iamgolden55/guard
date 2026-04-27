// StatusFilter — chip strip above the invoice list.
// Ported 1:1 from project/invoice-list.jsx:69-108.
import { useAccent } from "../../../../contexts/AccentContext";
import { tokens } from "../../../../design-system/tokens";
import type { InvoiceStats } from "../../data/mocks";

export type StatusFilterValue =
  | "all"
  | "draft"
  | "sent"
  | "overdue"
  | "paid"
  | "rejected";

const OPTS: [StatusFilterValue, string, string][] = [
  ["all", "All", "#605e5c"],
  ["draft", "Drafts", "#605e5c"],
  ["sent", "Sent", "#0b5c9b"],
  ["overdue", "Overdue", "#8a1820"],
  ["paid", "Paid", "#0f5132"],
  ["rejected", "Rejected", "#8a4b0a"],
];

export interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (v: StatusFilterValue) => void;
  counts: InvoiceStats["counts"];
}

export function StatusFilter({ value, onChange, counts }: StatusFilterProps) {
  const { palette } = useAccent();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {OPTS.map(([id, label, fg]) => {
        const count = counts[id as keyof typeof counts] ?? counts.total;
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 9px",
              borderRadius: 6,
              background: active ? palette.primary : "white",
              border: `1px solid ${active ? palette.primary : tokens.color.ink200}`,
              color: active ? "white" : tokens.color.ink800,
              fontFamily: tokens.font.body,
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
              transition: "all .12s",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: active ? "rgba(255,255,255,0.8)" : fg,
              }}
            />
            {label}
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: active ? "rgba(255,255,255,0.85)" : tokens.color.ink500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
