// WorkingHoursView — per-staff hours table with period picker.
import { format, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { ComplianceMetrics } from "../../../types/compliance";

type Period = "weekly" | "monthly" | "quarterly";

const HEADER_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: tokens.color.ink500,
  textAlign: "left",
  padding: "10px 14px",
  background: tokens.color.ink50,
  borderBottom: `1px solid ${tokens.color.ink200}`,
  whiteSpace: "nowrap",
};

const CELL_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink800,
  padding: "12px 14px",
  borderBottom: `1px solid ${tokens.color.ink100}`,
  verticalAlign: "middle",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM");
  } catch {
    return iso;
  }
}

function fmtNum(value: string | number | null | undefined, suffix = "") {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}${suffix}`;
}

export interface WorkingHoursViewProps {
  metrics: ComplianceMetrics[];
  isLoading: boolean;
  period: Period;
  onPeriodChange: (period: Period) => void;
}

export function WorkingHoursView({
  metrics,
  isLoading,
  period,
  onPeriodChange,
}: WorkingHoursViewProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 24,
        background: tokens.color.ink50,
      }}
    >
      <div
        style={{
          background: "white",
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.lg,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${tokens.color.ink100}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 14,
                color: tokens.color.ink900,
              }}
            >
              Working hours summary
            </div>
            <div
              style={{
                fontFamily: tokens.font.body,
                fontSize: 12,
                color: tokens.color.ink500,
                marginTop: 2,
              }}
            >
              {metrics.length} {metrics.length === 1 ? "staff record" : "staff records"}
            </div>
          </div>
          <PeriodToggle period={period} onChange={onPeriodChange} />
        </div>
        {isLoading ? (
          <Empty title="Loading metrics…" />
        ) : metrics.length === 0 ? (
          <Empty
            title="No metrics available"
            hint="Metrics roll up after staff complete shifts during the selected period."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 720,
              }}
            >
              <thead>
                <tr>
                  <th style={HEADER_STYLE}>Staff</th>
                  <th style={HEADER_STYLE}>Period</th>
                  <th style={{ ...HEADER_STYLE, textAlign: "right" }}>
                    Total
                  </th>
                  <th style={{ ...HEADER_STYLE, textAlign: "right" }}>
                    Regular
                  </th>
                  <th style={{ ...HEADER_STYLE, textAlign: "right" }}>
                    Overtime
                  </th>
                  <th style={{ ...HEADER_STYLE, textAlign: "right" }}>OT %</th>
                  <th style={{ ...HEADER_STYLE, textAlign: "right" }}>
                    Violations
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <MetricRow key={m.id} m={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const options: Array<{ id: Period; label: string }> = [
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Quarterly" },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        background: tokens.color.ink100,
        borderRadius: 8,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o.id === period;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              background: active ? "white" : "transparent",
              border: "none",
              fontFamily: tokens.font.body,
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              color: active ? tokens.color.ink900 : tokens.color.ink600,
              cursor: "pointer",
              boxShadow: active ? tokens.shadow.xs : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricRow({ m }: { m: ComplianceMetrics }) {
  const otPct = Number(m.overtime_percentage ?? 0);
  const otTone = otPct > 25 ? "danger" : otPct > 10 ? "warning" : "neutral";
  const name = m.user_data?.full_name || `User #${m.user}`;

  return (
    <tr>
      <td style={CELL_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={name} size={28} />
          <span style={{ color: tokens.color.ink900, fontWeight: 600 }}>
            {name}
          </span>
        </div>
      </td>
      <td style={{ ...CELL_STYLE, color: tokens.color.ink600, whiteSpace: "nowrap" }}>
        {fmtDate(m.period_start)} – {fmtDate(m.period_end)}
      </td>
      <td
        style={{
          ...CELL_STYLE,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtNum(m.total_hours_worked, "h")}
      </td>
      <td
        style={{
          ...CELL_STYLE,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: tokens.color.ink600,
        }}
      >
        {fmtNum(m.regular_hours, "h")}
      </td>
      <td
        style={{
          ...CELL_STYLE,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: otPct > 0 ? tokens.color.warnInk : tokens.color.ink600,
          fontWeight: otPct > 0 ? 600 : 400,
        }}
      >
        {fmtNum(m.overtime_hours, "h")}
      </td>
      <td style={{ ...CELL_STYLE, textAlign: "right" }}>
        <Pill tone={otTone}>{`${otPct.toFixed(1)}%`}</Pill>
      </td>
      <td
        style={{
          ...CELL_STYLE,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: m.violation_count > 0 ? tokens.color.dangerInk : tokens.color.ink600,
          fontWeight: m.violation_count > 0 ? 600 : 400,
        }}
      >
        {m.violation_count}
      </td>
    </tr>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "60px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          margin: "0 auto 12px",
          borderRadius: 22,
          background: tokens.color.ink100,
          display: "grid",
          placeItems: "center",
          color: tokens.color.ink500,
        }}
      >
        <Icon name="clock" size={20} />
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 14,
          color: tokens.color.ink800,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
