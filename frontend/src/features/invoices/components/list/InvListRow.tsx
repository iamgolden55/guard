// InvListRow — single row in the left pane list.
// Ported 1:1 from project/invoice-list.jsx:111-168.
import { useAccent } from "../../../../contexts/AccentContext";
import { Avatar } from "../../../../design-system/primitives/Avatar";
import { tokens } from "../../../../design-system/tokens";
import {
  dateGBShort,
  daysFromToday,
  money,
  type InvoiceRecord,
} from "../../data/mocks";
import { InvStatusPill } from "../atoms/InvStatusPill";

export interface InvListRowProps {
  inv: InvoiceRecord;
  selected: boolean;
  onClick: () => void;
}

export function InvListRow({ inv, selected, onClick }: InvListRowProps) {
  const { palette } = useAccent();
  const overdueDays = inv.dueDate ? -daysFromToday(inv.dueDate) : 0;
  const isOverdue = inv.status === "overdue";
  const isDraft = inv.status === "draft";
  const partyName = inv.party.name;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        border: "none",
        cursor: "pointer",
        background: selected ? palette.soft : "white",
        borderLeft: `3px solid ${selected ? palette.primary : "transparent"}`,
        borderBottom: `1px solid ${tokens.color.ink100}`,
        fontFamily: tokens.font.body,
        transition: "background .12s",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = tokens.color.ink50;
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "white";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={partyName} hue={inv.party.hue} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: tokens.color.ink900,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 170,
              }}
            >
              {partyName}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: tokens.color.ink900,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {money(inv.total)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 3,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: tokens.color.ink500,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                letterSpacing: "0.02em",
              }}
            >
              {inv.id}
            </span>
            <span
              style={{
                fontSize: 11,
                color: isOverdue ? "#8a1820" : tokens.color.ink600,
                fontWeight: isOverdue ? 700 : 500,
              }}
            >
              {isDraft && `Draft · ${dateGBShort(inv.periodEnd)}`}
              {!isDraft &&
                (isOverdue
                  ? `${overdueDays}d overdue`
                  : inv.status === "paid"
                    ? `Paid ${dateGBShort(inv.paidDate)}`
                    : `Due ${dateGBShort(inv.dueDate)}`)}
            </span>
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 9,
        }}
      >
        <InvStatusPill status={inv.status} />
        <span style={{ fontSize: 11, color: tokens.color.ink500 }}>
          {inv.totalHours}h · {inv.items.length} {inv.items.length === 1 ? "line" : "lines"}
        </span>
      </div>
    </button>
  );
}
