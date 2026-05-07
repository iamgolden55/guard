// ComplianceHeader — same shape as RecruitmentHeader.
// Row 1 = breadcrumb + title + open chip + bell + Export + New profile
// Row 2 = four tabs (Overview / Violations / Working Hours / Profiles) + search
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button, Input } from "../../../design-system";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export type ComplianceTab = "overview" | "violations" | "working-hours" | "profiles";

interface TabSpec {
  id: ComplianceTab;
  label: string;
  icon: IconName;
}

const TABS: TabSpec[] = [
  { id: "overview", label: "Overview", icon: "squares-2x2" },
  { id: "violations", label: "Violations", icon: "warning" },
  { id: "working-hours", label: "Working hours", icon: "clock" },
  { id: "profiles", label: "Profiles", icon: "briefcase" },
];

export interface ComplianceStats {
  total: number;
  open: number;
  critical: number;
}

export interface ComplianceHeaderProps {
  view: ComplianceTab;
  onViewChange: (next: ComplianceTab) => void;
  stats: ComplianceStats;
  search: string;
  onSearchChange: (value: string) => void;
  onCreateProfile: () => void;
  onExport?: () => void;
  exportLabel?: string;
  exportDisabled?: boolean;
  showSearch: boolean;
  showCreateProfile: boolean;
}

export function ComplianceHeader({
  view,
  onViewChange,
  stats,
  search,
  onSearchChange,
  onCreateProfile,
  onExport,
  exportLabel,
  exportDisabled,
  showSearch,
  showCreateProfile,
}: ComplianceHeaderProps) {
  const { palette } = useAccent();

  const counts: Record<ComplianceTab, number> = {
    overview: stats.open,
    violations: stats.open,
    "working-hours": 0,
    profiles: 0,
  };

  const showCount: Record<ComplianceTab, boolean> = {
    overview: false,
    violations: true,
    "working-hours": false,
    profiles: false,
  };

  return (
    <header
      style={{
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        position: "sticky",
        top: 0,
        zIndex: tokens.z.sticky,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 24px 12px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: tokens.color.ink500,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <Link
              to="/dashboard"
              style={{ color: tokens.color.ink500, textDecoration: "none" }}
            >
              Operations
            </Link>
            <Icon name="chevron-right" size={11} />
            <span style={{ color: tokens.color.ink600 }}>Compliance</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginTop: 2,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: tokens.font.display,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: tokens.color.ink900,
              }}
            >
              Compliance
            </h1>
            <span style={{ fontSize: 13, color: tokens.color.ink600 }}>
              {stats.open} open · {stats.total} total
            </span>
          </div>
        </div>

        {stats.critical > 0 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: tokens.color.dangerSoft,
              border: `1px solid ${tokens.color.danger}40`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: tokens.color.danger,
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                color: tokens.color.dangerInk,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {stats.critical} CRITICAL
            </span>
          </div>
        )}

        <button
          type="button"
          aria-label="Notifications"
          style={{
            position: "relative",
            width: 38,
            height: 38,
            borderRadius: 8,
            background: tokens.color.ink100,
            border: "none",
            color: tokens.color.ink800,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Icon name="bell" size={18} />
          {stats.open > 0 && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 7,
                width: 7,
                height: 7,
                borderRadius: 4,
                background: palette.primary,
                border: "2px solid white",
              }}
            />
          )}
        </button>

        <Button
          variant="secondary"
          leading={<Icon name="download" size={14} />}
          onClick={onExport}
          disabled={!onExport || exportDisabled}
        >
          {exportLabel ?? "Export"}
        </Button>

        {showCreateProfile && (
          <Button
            variant="primary"
            accent={palette}
            leading={<Icon name="plus" size={14} />}
            onClick={onCreateProfile}
          >
            New profile
          </Button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "0 24px",
          borderTop: `1px solid ${tokens.color.ink100}`,
        }}
      >
        {TABS.map((t) => {
          const active = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onViewChange(t.id)}
              style={{
                padding: "13px 4px",
                marginRight: 28,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderBottom: active
                  ? `2px solid ${palette.primary}`
                  : "2px solid transparent",
                color: active ? palette.ink : tokens.color.ink600,
                fontFamily: tokens.font.body,
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                letterSpacing: "-0.005em",
                marginBottom: -1,
                position: "relative",
              }}
            >
              <Icon name={t.icon} size={15} />
              <span>{t.label}</span>
              {showCount[t.id] && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: active ? palette.soft : tokens.color.ink100,
                    color: active ? palette.ink : tokens.color.ink600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {counts[t.id]}
                </span>
              )}
            </button>
          );
        })}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 0",
          }}
        >
          {showSearch && (
            <Input
              leading={<Icon name="search" size={14} />}
              placeholder="Search by staff or violation type…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              wrapperStyle={{ width: 280, padding: "6px 10px" }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
