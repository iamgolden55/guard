// ComplianceRightRailCards — sidebar summary on Overview tab.
// Severity + type breakdowns derived from cached violations list.
import { Card } from "../../../design-system/primitives/Card";
import { SectionHeader } from "../../../design-system";
import { tokens } from "../../../design-system/tokens";
import type { ComplianceViolation } from "../../../types/compliance";

const SEVERITY_COLOR: Record<string, string> = {
  critical: tokens.color.danger,
  major: tokens.color.warn,
  minor: tokens.color.info,
  warning: tokens.color.warn,
  info: tokens.color.info,
};

export function ComplianceRightRailCards({
  violations,
  isLoading,
}: {
  violations: ComplianceViolation[];
  isLoading: boolean;
}) {
  const total = violations.length;

  const bySeverity: Record<string, number> = {};
  const byType: Record<string, { count: number; label: string }> = {};
  for (const v of violations) {
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
    const key = v.violation_type;
    if (!byType[key]) {
      byType[key] = {
        count: 0,
        label: v.violation_type_display ?? v.violation_type,
      };
    }
    byType[key].count += 1;
  }

  const severityRows = (
    ["critical", "major", "minor", "warning", "info"] as const
  )
    .filter((k) => (bySeverity[k] ?? 0) > 0)
    .map((k) => ({
      key: k,
      label: k,
      count: bySeverity[k] ?? 0,
      color: SEVERITY_COLOR[k] ?? tokens.color.ink500,
    }));

  const typeRows = Object.entries(byType)
    .map(([k, v]) => ({ key: k, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card padding={20}>
        <SectionHeader
          title="By severity"
          subtitle={
            isLoading
              ? "Loading…"
              : `${total} ${total === 1 ? "violation" : "violations"}`
          }
        />
        {severityRows.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {severityRows.map((r) => (
              <ProgressRow
                key={r.key}
                label={r.label}
                value={r.count}
                total={total}
                color={r.color}
              />
            ))}
          </div>
        )}
      </Card>

      <Card padding={20}>
        <SectionHeader
          title="By type"
          subtitle={isLoading ? "Loading…" : "Top 6 violation types"}
        />
        {typeRows.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {typeRows.map((r) => (
              <div
                key={r.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontFamily: tokens.font.body,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: tokens.color.ink800 }}>{r.label}</span>
                <span
                  style={{
                    color: tokens.color.ink600,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12,
            fontWeight: 600,
            color: tokens.color.ink800,
            textTransform: "capitalize",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12,
            color: tokens.color.ink600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value} <span style={{ color: tokens.color.ink400 }}>·</span> {pct}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: tokens.color.ink100,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: `width ${tokens.motion.base}`,
          }}
        />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div
      style={{
        fontFamily: tokens.font.body,
        fontSize: 12,
        color: tokens.color.ink500,
        padding: "10px 0",
      }}
    >
      No data yet.
    </div>
  );
}
