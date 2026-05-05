// OverviewView — KPI strip + recent violations list. Reads from the
// dashboard endpoint plus the cached violations list.
import type { CSSProperties, ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { useAccent } from "../../../contexts/AccentContext";
import { Card } from "../../../design-system/primitives/Card";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type {
  ComplianceDashboardMetrics,
  ComplianceViolation,
} from "../../../types/compliance";

const SEVERITY_TONE: Record<string, PillTone> = {
  info: "info",
  warning: "warning",
  minor: "info",
  major: "warning",
  critical: "danger",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM, HH:mm");
  } catch {
    return iso;
  }
}

export interface OverviewViewProps {
  dashboard: ComplianceDashboardMetrics | null;
  recentViolations: ComplianceViolation[];
  isLoading: boolean;
  onSelectViolation: (v: ComplianceViolation) => void;
}

export function OverviewView({
  dashboard,
  recentViolations,
  isLoading,
  onSelectViolation,
}: OverviewViewProps) {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <KPIGrid dashboard={dashboard} isLoading={isLoading} />
        <RecentViolations
          violations={recentViolations}
          isLoading={isLoading}
          onSelect={onSelectViolation}
        />
      </div>
    </div>
  );
}

function KPIGrid({
  dashboard,
  isLoading,
}: {
  dashboard: ComplianceDashboardMetrics | null;
  isLoading: boolean;
}) {
  const score =
    typeof dashboard?.overall_compliance_rate === "number"
      ? Math.round(dashboard.overall_compliance_rate)
      : null;

  const cards: Array<{
    label: string;
    value: ReactNode;
    icon: IconName;
    tone: "default" | "warn" | "danger" | "success";
    sub?: string;
  }> = [
    {
      label: "Compliance score",
      value: score !== null ? `${score}%` : "—",
      icon: "shield",
      tone: score !== null && score < 80 ? "warn" : "success",
      sub: "All staff, last 7 days",
    },
    {
      label: "Total violations",
      value: dashboard?.total_violations ?? 0,
      icon: "warning",
      tone: "default",
    },
    {
      label: "Critical",
      value: dashboard?.critical_violations ?? 0,
      icon: "shield-x",
      tone: (dashboard?.critical_violations ?? 0) > 0 ? "danger" : "default",
      sub: "Open critical breaches",
    },
    {
      label: "Resolved",
      value: dashboard?.resolved_violations ?? 0,
      icon: "check",
      tone: "success",
    },
    {
      label: "Avg resolution",
      value:
        typeof dashboard?.average_resolution_time_hours === "number"
          ? `${Math.round(dashboard.average_resolution_time_hours)}h`
          : "—",
      icon: "clock",
      tone: "default",
    },
    {
      label: "Trend",
      value: trendLabel(dashboard),
      icon: "history",
      tone: "default",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {cards.map((c) => (
        <KPICard key={c.label} {...c} isLoading={isLoading} />
      ))}
    </div>
  );
}

function trendLabel(d: ComplianceDashboardMetrics | null): string {
  const trend = d?.compliance_trend;
  if (!Array.isArray(trend) || trend.length < 2) return "—";
  const first = Number(trend[0]?.compliance_rate ?? 0);
  const last = Number(trend[trend.length - 1]?.compliance_rate ?? 0);
  const delta = last - first;
  if (Math.abs(delta) < 0.5) return "Stable";
  return delta > 0 ? `+${delta.toFixed(1)}pt` : `${delta.toFixed(1)}pt`;
}

function KPICard({
  label,
  value,
  icon,
  tone,
  sub,
  isLoading,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  tone: "default" | "warn" | "danger" | "success";
  sub?: string;
  isLoading: boolean;
}) {
  const TONE_STYLES: Record<typeof tone, { bg: string; fg: string }> = {
    default: { bg: tokens.color.ink100, fg: tokens.color.ink700 },
    warn: { bg: tokens.color.warnSoft, fg: tokens.color.warnInk },
    danger: { bg: tokens.color.dangerSoft, fg: tokens.color.dangerInk },
    success: { bg: tokens.color.successSoft, fg: tokens.color.successInk },
  };
  const t = TONE_STYLES[tone];
  return (
    <Card padding={18}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.body,
            fontWeight: 700,
            fontSize: 10.5,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tokens.color.ink500,
          }}
        >
          {label}
        </span>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: t.bg,
            color: t.fg,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name={icon} size={14} />
        </span>
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 24,
          color: tokens.color.ink900,
          letterSpacing: "-0.02em",
        }}
      >
        {isLoading ? <span style={{ opacity: 0.4 }}>—</span> : value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 11.5,
            color: tokens.color.ink500,
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}

function RecentViolations({
  violations,
  isLoading,
  onSelect,
}: {
  violations: ComplianceViolation[];
  isLoading: boolean;
  onSelect: (v: ComplianceViolation) => void;
}) {
  const { palette } = useAccent();
  return (
    <Card padding={0}>
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${tokens.color.ink100}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
            Recent violations
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 12,
              color: tokens.color.ink500,
              marginTop: 2,
            }}
          >
            Last 5 detected breaches
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            color: palette.ink,
            fontWeight: 600,
          }}
        >
          {violations.length} shown
        </span>
      </div>
      {isLoading ? (
        <RowMessage label="Loading violations…" />
      ) : violations.length === 0 ? (
        <RowMessage label="No violations detected — staff are within thresholds." />
      ) : (
        <div>
          {violations.slice(0, 5).map((v) => (
            <ViolationRow
              key={v.id}
              violation={v}
              onSelect={() => onSelect(v)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

const ROW_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  alignItems: "center",
  gap: 16,
  padding: "12px 20px",
  borderBottom: `1px solid ${tokens.color.ink100}`,
  cursor: "pointer",
  transition: `background ${tokens.motion.fast}`,
};

function ViolationRow({
  violation,
  onSelect,
}: {
  violation: ComplianceViolation;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={ROW_STYLE}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.color.ink50;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.font.body,
            fontWeight: 600,
            fontSize: 13,
            color: tokens.color.ink900,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {violation.user_data?.full_name || `User #${violation.user}`}
        </div>
        <div
          style={{
            fontSize: 12,
            color: tokens.color.ink500,
            marginTop: 2,
          }}
        >
          {violation.violation_type_display ?? violation.violation_type} ·{" "}
          {fmtDate(violation.period_start)}
        </div>
      </div>
      <Pill tone={SEVERITY_TONE[violation.severity] ?? "info"} dot>
        {violation.severity_display ?? violation.severity}
      </Pill>
      <Icon name="chevron-right" size={14} />
    </div>
  );
}

function RowMessage({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "26px 20px",
        textAlign: "center",
        fontSize: 12.5,
        color: tokens.color.ink500,
      }}
    >
      {label}
    </div>
  );
}
