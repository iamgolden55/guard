// FilterBar — chip filter + search + venue/week filters + bulk actions.
// Ported 1:1 from project/payroll-hero.jsx:165-221.
import { useAccent } from "../../../contexts/AccentContext";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export type PayrollFilter = "all" | "pending" | "paid" | "rejected" | "flagged";

export interface FilterCounts {
  all: number;
  pending: number;
  paid: number;
  rejected: number;
  flagged: number;
}

export interface FilterBarProps {
  filter: PayrollFilter;
  setFilter: (f: PayrollFilter) => void;
  search: string;
  setSearch: (v: string) => void;
  counts: FilterCounts;
  selected: number;
  onBulkExport: () => void;
}

const CHIPS: { id: PayrollFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "rejected", label: "Rejected" },
  { id: "flagged", label: "Needs attention" },
];

export function FilterBar({
  filter,
  setFilter,
  search,
  setSearch,
  counts,
  selected,
  onBulkExport,
}: FilterBarProps) {
  const { palette } = useAccent();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CHIPS.map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 12px",
                borderRadius: 999,
                background: active ? palette.primary : tokens.color.ink100,
                color: active ? "white" : tokens.color.ink800,
                border: "none",
                cursor: "pointer",
                fontFamily: tokens.font.body,
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {c.label}
              <span
                style={{
                  fontSize: 11,
                  fontFamily: tokens.font.mono,
                  background: active ? "rgba(255,255,255,0.22)" : "white",
                  color: active ? "white" : tokens.color.ink600,
                  padding: "0 6px",
                  borderRadius: 8,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {counts[c.id]}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ width: 1, height: 24, background: tokens.color.ink200 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: tokens.color.ink600,
          flex: 1,
          minWidth: 220,
        }}
      >
        <Icon name="search" size={14} />
        <input
          placeholder="Filter by officer, venue, role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            fontFamily: tokens.font.body,
            flex: 1,
            color: tokens.color.ink800,
          }}
        />
      </div>
      <Button variant="secondary" size="sm" leading={<Icon name="filter" size={13} />}>
        Venue
      </Button>
      <Button variant="secondary" size="sm" leading={<Icon name="calendar" size={13} />}>
        Week 17
      </Button>
      {selected > 0 && (
        <>
          <div style={{ width: 1, height: 24, background: tokens.color.ink200 }} />
          <div style={{ fontSize: 12.5, color: tokens.color.ink900, fontWeight: 600 }}>
            {selected} selected
          </div>
          <Button
            variant="primary"
            accent={palette}
            size="sm"
            leading={<Icon name="external" size={13} />}
            onClick={onBulkExport}
          >
            Export
          </Button>
          <Button variant="secondary" size="sm" leading={<Icon name="file" size={13} />}>
            Payslip PDFs
          </Button>
        </>
      )}
    </div>
  );
}
