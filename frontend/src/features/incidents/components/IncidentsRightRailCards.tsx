// IncidentsRightRailCards — sidebar summary on Open / Resolved tabs.
// Shows breakdowns derived from cached incidents list.
import { Card } from "../../../design-system/primitives/Card";
import { SectionHeader } from "../../../design-system";
import { tokens } from "../../../design-system/tokens";
import type { IncidentsStats } from "../hooks/useIncidentsData";

const SEVERITY_COLOR: Record<string, string> = {
  critical: tokens.color.danger,
  high: tokens.color.warn,
  medium: tokens.color.warn,
  low: tokens.color.info,
};

export function IncidentsRightRailCards({
  stats,
  isLoading,
}: {
  stats: IncidentsStats;
  isLoading: boolean;
}) {
  const total = stats.total;
  const resolutionRate =
    total > 0 ? Math.round((stats.resolved / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card padding={20}>
        <SectionHeader
          title="Resolution"
          subtitle={isLoading ? "Loading…" : `${resolutionRate}% resolved`}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ProgressRow
            label="Resolved"
            value={stats.resolved}
            total={total}
            color={tokens.color.success}
          />
          <ProgressRow
            label="Open"
            value={stats.open}
            total={total}
            color={tokens.color.warn}
          />
        </div>
      </Card>

      <Card padding={20}>
        <SectionHeader
          title="By severity"
          subtitle={
            isLoading
              ? "Loading…"
              : `${total} ${total === 1 ? "report" : "reports"}`
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <ProgressRow
              key={sev}
              label={sev}
              value={stats.bySeverity[sev] ?? 0}
              total={total}
              color={SEVERITY_COLOR[sev] ?? tokens.color.ink500}
            />
          ))}
        </div>
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
