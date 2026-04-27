// TimesheetsView — week table with day cells + summary strip + bulk select.
// Ported 1:1 from project/attendance-tabs.jsx:174-313.
import { useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  fmtH2,
  officerById,
  TIMESHEETS,
  WEEK_DAYS,
  type CellStatus,
  type DayCellData,
  type TimesheetRow,
  type TimesheetStatus,
} from "../data/mocks";

const STATUS_TONE: Record<
  TimesheetStatus,
  { bg: string; fg: string; label: string; dot: string }
> = {
  ready: { bg: tokens.color.successSoft, fg: tokens.color.successInk, label: "Ready", dot: tokens.color.success },
  review: { bg: tokens.color.warnSoft, fg: tokens.color.warnInk, label: "Review", dot: tokens.color.warn },
  blocked: { bg: tokens.color.dangerSoft, fg: tokens.color.dangerInk, label: "Blocked", dot: tokens.color.danger },
  approved: { bg: tokens.color.ink100, fg: tokens.color.ink600, label: "Approved", dot: tokens.color.ink500 },
};

const CELL_TONE: Record<CellStatus, { bg: string; fg: string; border: string }> = {
  ok: { bg: tokens.color.successSoft, fg: tokens.color.successInk, border: "#b8e0c2" },
  approved: { bg: tokens.color.successSoft, fg: tokens.color.successInk, border: "#b8e0c2" },
  pending: { bg: "#fffbe6", fg: tokens.color.warnInk, border: "#fde68a" },
  late: { bg: tokens.color.warnSoft, fg: tokens.color.warnInk, border: "#fad48a" },
  early: { bg: tokens.color.warnSoft, fg: tokens.color.warnInk, border: "#fad48a" },
  noshow: { bg: tokens.color.dangerSoft, fg: tokens.color.dangerInk, border: "#fbd0d4" },
  missing: { bg: tokens.color.dangerSoft, fg: tokens.color.dangerInk, border: "#fbd0d4" },
  geofence: { bg: "#f5f3ff", fg: "#5b21b6", border: "#ddd6fe" },
  absent: { bg: tokens.color.ink50, fg: tokens.color.ink500, border: tokens.color.ink200 },
  future: { bg: "transparent", fg: tokens.color.ink400, border: tokens.color.ink100 },
};

export type TimesheetDensity = "compact" | "comfortable";

export interface TimesheetsViewProps {
  density?: TimesheetDensity;
  hideApproved?: boolean;
  onSelect: (payload: { timesheet: TimesheetRow }) => void;
}

const GRID_COLS =
  "32px minmax(220px, 1.6fr) repeat(7, 1fr) 90px 90px 90px 110px 100px";

export function TimesheetsView({
  density = "comfortable",
  hideApproved = false,
  onSelect,
}: TimesheetsViewProps) {
  const { palette } = useAccent();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = hideApproved ? TIMESHEETS.filter((t) => t.status !== "approved") : TIMESHEETS;

  const totals = {
    sched: rows.reduce((a, r) => a + r.scheduled, 0),
    actual: rows.reduce((a, r) => a + r.actual, 0),
    flagged: rows.filter((r) => r.status !== "ready" && r.status !== "approved").length,
  };

  const padY = density === "compact" ? 8 : 12;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: tokens.color.ink50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "14px 24px 0",
          background: "white",
          borderBottom: `1px solid ${tokens.color.ink200}`,
        }}
      >
        <SummaryBlock label="Scheduled" value={fmtH2(totals.sched)} />
        <SummaryBlock label="Actual" value={fmtH2(totals.actual)} />
        <SummaryBlock
          label="Variance"
          value={`${totals.actual - totals.sched > 0 ? "+" : ""}${(totals.actual - totals.sched).toFixed(1)}h`}
          tone={totals.actual - totals.sched < -1 ? "warn" : "ok"}
        />
        <SummaryBlock label="Officers" value={String(rows.length)} />
        <SummaryBlock
          label="Need review"
          value={String(totals.flagged)}
          tone={totals.flagged > 0 ? "warn" : "ok"}
        />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0 14px" }}>
          <Button variant="secondary" size="sm" leading={<Icon name="filter" size={12} />}>
            Filter
          </Button>
          <Button
            variant="primary"
            size="sm"
            accent={palette}
            leading={<Icon name="check" size={12} />}
            disabled={selected.size === 0}
          >
            {selected.size > 0
              ? `Approve ${selected.size} selected`
              : "Select rows to approve"}
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 32px" }}>
        <div
          style={{
            background: "white",
            borderRadius: 10,
            border: `1px solid ${tokens.color.ink200}`,
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLS,
              background: tokens.color.ink50,
              borderBottom: `1px solid ${tokens.color.ink200}`,
              fontSize: 10.5,
              fontWeight: 700,
              color: tokens.color.ink500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "10px 14px",
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={selected.size === rows.length && rows.length > 0}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(rows.map((r) => r.oid)) : new Set())
              }
            />
            <div>Officer</div>
            {WEEK_DAYS.map((d) => (
              <div
                key={d.d}
                style={{
                  textAlign: "center",
                  color: d.today ? palette.primary : tokens.color.ink500,
                }}
              >
                {d.label} <span style={{ fontVariantNumeric: "tabular-nums" }}>{d.date}</span>
              </div>
            ))}
            <div style={{ textAlign: "right" }}>Sched</div>
            <div style={{ textAlign: "right" }}>Actual</div>
            <div style={{ textAlign: "right" }}>Var</div>
            <div style={{ textAlign: "center" }}>Flags</div>
            <div style={{ textAlign: "center" }}>Status</div>
          </div>

          {rows.map((t) => {
            const o = officerById(t.oid);
            const tone = STATUS_TONE[t.status];
            const checked = selected.has(t.oid);
            return (
              <div
                key={t.oid}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID_COLS,
                  padding: `${padY}px 14px`,
                  borderBottom: `1px solid ${tokens.color.ink100}`,
                  alignItems: "center",
                  cursor: "pointer",
                  background: checked ? "#fffaf6" : "white",
                }}
                onMouseEnter={(e) => {
                  if (!checked) e.currentTarget.style.background = tokens.color.ink50;
                }}
                onMouseLeave={(e) => {
                  if (!checked) e.currentTarget.style.background = "white";
                }}
                onClick={() => onSelect({ timesheet: t })}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const ns = new Set(selected);
                    if (e.target.checked) ns.add(t.oid);
                    else ns.delete(t.oid);
                    setSelected(ns);
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {o && <Avatar name={o.name} hue={o.hue} size={30} />}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: tokens.color.ink900,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {o?.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: tokens.color.ink500,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: 3,
                          background: tokens.color.ink100,
                          color: tokens.color.ink600,
                        }}
                      >
                        {o?.sia}
                      </span>
                      <span>{o?.role}</span>
                    </div>
                  </div>
                </div>

                {t.days.map((cell, i) => (
                  <DayCell key={i} cell={cell} today={!!WEEK_DAYS[i]?.today} />
                ))}

                <div
                  style={{
                    textAlign: "right",
                    fontSize: 12.5,
                    color: tokens.color.ink600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtH2(t.scheduled)}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.color.ink900,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtH2(t.actual)}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color:
                      Math.abs(t.variance) < 0.2
                        ? tokens.color.successInk
                        : t.variance < 0
                          ? tokens.color.warnInk
                          : "#5b21b6",
                  }}
                >
                  {t.variance > 0 ? "+" : ""}
                  {t.variance.toFixed(2)}h
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                  {t.flags.late > 0 && <FlagBadge label={t.flags.late} color={tokens.color.warn} title="Late check-ins" />}
                  {t.flags.early > 0 && <FlagBadge label={t.flags.early} color={tokens.color.warn} title="Early check-outs" />}
                  {t.flags.noshow > 0 && <FlagBadge label={t.flags.noshow} color={tokens.color.danger} title="No-shows" />}
                  {t.flags.missing > 0 && <FlagBadge label={t.flags.missing} color={tokens.color.danger} title="Missing check-out" />}
                  {t.flags.geofence > 0 && <FlagBadge label={t.flags.geofence} color="#6d28d9" title="Geofence" />}
                  {t.flags.late + t.flags.early + t.flags.noshow + t.flags.missing + t.flags.geofence === 0 && (
                    <span style={{ color: tokens.color.ink400, fontSize: 14 }}>—</span>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: tone.bg,
                      color: tone.fg,
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        background: tone.dot,
                      }}
                    />
                    {tone.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "16px 18px",
            background: "white",
            borderRadius: 10,
            border: `1px solid ${tokens.color.ink200}`,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Icon name="info" size={18} />
          <div style={{ flex: 1, fontSize: 13, color: tokens.color.ink600, lineHeight: 1.5 }}>
            <strong style={{ color: tokens.color.ink900 }}>Approval modes:</strong> click any
            row to approve a single shift, tick checkboxes to approve per-officer-per-week, or
            use the filter chips above to bulk-approve a filtered set. Blocked rows must have
            exceptions resolved first.
          </div>
          <Button variant="ghost" size="sm">
            Learn more
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div
      style={{
        paddingRight: 28,
        paddingBottom: 14,
        borderRight: `1px solid ${tokens.color.ink100}`,
        marginRight: 28,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: "-0.02em",
          color: tone === "warn" ? tokens.color.warn : tokens.color.ink900,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DayCell({ cell, today }: { cell: DayCellData; today: boolean }) {
  const tone = CELL_TONE[cell.status];
  if (cell.status === "future") {
    return (
      <div style={{ textAlign: "center", color: tokens.color.ink400, fontSize: 11 }}>
        {cell.sch ? `${cell.sch}h` : "·"}
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "4px 8px",
          minWidth: 50,
          borderRadius: 6,
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          color: tone.fg,
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          outline: today ? `2px solid ${tokens.color.primary}33` : "none",
        }}
      >
        <div>
          {cell.act > 0
            ? `${cell.act.toFixed(2)}h`
            : cell.status === "noshow"
              ? "NS"
              : cell.status === "missing"
                ? "—"
                : "·"}
        </div>
        {cell.act > 0 && Math.abs(cell.act - cell.sch) > 0.05 && (
          <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 1 }}>sch {cell.sch}h</div>
        )}
      </div>
    </div>
  );
}

function FlagBadge({ label, color, title }: { label: number; color: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-grid",
        placeItems: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 9,
        background: color,
        color: "white",
        fontSize: 10,
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {label}
    </span>
  );
}
