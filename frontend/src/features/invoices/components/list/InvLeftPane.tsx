// InvLeftPane — search + filter chips + aging callout + list + footer.
// Ported 1:1 from project/invoice-list.jsx:171-273.
import { useAccent } from "../../../../contexts/AccentContext";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import {
  money,
  type InvoiceKind,
  type InvoiceRecord,
  type InvoiceStats,
} from "../../data/mocks";
import { AgingBars } from "../atoms/AgingBars";
import { InvListRow } from "./InvListRow";
import { StatusFilter, type StatusFilterValue } from "./StatusFilter";

export type AgingMode = "bars" | "off";

export interface InvLeftPaneProps {
  invoices: InvoiceRecord[];
  stats: InvoiceStats;
  statusFilter: StatusFilterValue;
  setStatusFilter: (v: StatusFilterValue) => void;
  search: string;
  setSearch: (v: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  ledger: InvoiceKind;
  agingMode?: AgingMode;
}

const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  overdue: 1,
  sent: 2,
  rejected: 3,
  paid: 4,
};

export function InvLeftPane({
  invoices,
  stats,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  selectedId,
  setSelectedId,
  ledger,
  agingMode = "bars",
}: InvLeftPaneProps) {
  const { palette } = useAccent();

  const filtered = invoices
    .filter((i) => (statusFilter === "all" ? true : i.status === statusFilter))
    .filter((i) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        i.id.toLowerCase().includes(q) ||
        i.party.name.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const oa = STATUS_ORDER[a.status] ?? 9;
      const ob = STATUS_ORDER[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      const da = new Date(a.issueDate || a.periodEnd).getTime();
      const db = new Date(b.issueDate || b.periodEnd).getTime();
      return db - da;
    });

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        borderRight: `1px solid ${tokens.color.ink200}`,
        background: "white",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 100px)",
        position: "sticky",
        top: 100,
      }}
    >
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${tokens.color.ink200}` }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: 9,
              color: tokens.color.ink500,
            }}
          >
            <Icon name="search" size={14} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${ledger === "client" ? "clients" : "officers"} or #…`}
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              borderRadius: 7,
              border: `1px solid ${tokens.color.ink200}`,
              background: tokens.color.ink50,
              fontFamily: tokens.font.body,
              fontSize: 13,
              color: tokens.color.ink900,
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.background = "white";
              e.target.style.borderColor = palette.primary;
            }}
            onBlur={(e) => {
              e.target.style.background = tokens.color.ink50;
              e.target.style.borderColor = tokens.color.ink200;
            }}
          />
        </div>
        <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={stats.counts} />
      </div>

      {ledger === "client" && stats.counts.overdue > 0 && agingMode !== "off" && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${tokens.color.ink200}`,
            background: "#fffaf7",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "#8a1820",
              }}
            >
              Aging · overdue
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter("overdue")}
              style={{
                fontSize: 11,
                color: "#8a1820",
                fontWeight: 600,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              view
            </button>
          </div>
          <AgingBars buckets={stats.buckets} totalOverdue={stats.totals.overdue} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: tokens.color.ink500,
              fontSize: 13,
            }}
          >
            No invoices match.
          </div>
        ) : (
          filtered.map((inv) => (
            <InvListRow
              key={inv.id}
              inv={inv}
              selected={inv.id === selectedId}
              onClick={() => setSelectedId(inv.id)}
            />
          ))
        )}
      </div>

      <div
        style={{
          borderTop: `1px solid ${tokens.color.ink200}`,
          padding: "12px 16px",
          background: tokens.color.ink50,
          fontFamily: tokens.font.body,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: tokens.color.ink600, fontWeight: 600 }}>
            Outstanding
          </span>
          <span
            style={{
              fontSize: 13,
              color: tokens.color.ink900,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {money(stats.totals.outstanding)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: tokens.color.ink600, fontWeight: 600 }}>
            Paid (last 30d)
          </span>
          <span
            style={{
              fontSize: 12,
              color: tokens.color.successInk,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {money(stats.totals.paid)}
          </span>
        </div>
      </div>
    </div>
  );
}
