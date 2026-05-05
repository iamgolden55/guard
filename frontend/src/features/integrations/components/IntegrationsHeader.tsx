// IntegrationsHeader — sticky 2-row header matching RecruitmentHeader.
// Row 1 = breadcrumb + title + connected chip + bell + Browse marketplace
// Row 2 = three tabs (Catalog / Connected / Activity) + search input
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button, Input } from "../../../design-system";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export type IntegrationsTab = "catalog" | "connected" | "activity";

interface TabSpec {
  id: IntegrationsTab;
  label: string;
  icon: IconName;
}

const TABS: TabSpec[] = [
  { id: "catalog", label: "Catalog", icon: "stack" },
  { id: "connected", label: "Connected", icon: "plug" },
  { id: "activity", label: "Activity", icon: "history" },
];

export interface IntegrationsHeaderProps {
  view: IntegrationsTab;
  onViewChange: (next: IntegrationsTab) => void;
  connectedCount: number;
  errorCount: number;
  catalogCount: number;
  activityCount: number;
  search: string;
  onSearchChange: (value: string) => void;
}

export function IntegrationsHeader({
  view,
  onViewChange,
  connectedCount,
  errorCount,
  catalogCount,
  activityCount,
  search,
  onSearchChange,
}: IntegrationsHeaderProps) {
  const { palette } = useAccent();

  const counts: Record<IntegrationsTab, number> = {
    catalog: catalogCount,
    connected: connectedCount,
    activity: activityCount,
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
              Settings
            </Link>
            <Icon name="chevron-right" size={11} />
            <span style={{ color: tokens.color.ink600 }}>Integrations</span>
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
              Integrations
            </h1>
            <span style={{ fontSize: 13, color: tokens.color.ink600 }}>
              {connectedCount} connected · {catalogCount} available
            </span>
          </div>
        </div>

        {errorCount > 0 && (
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
              {errorCount} {errorCount === 1 ? "ERROR" : "ERRORS"}
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
        </button>

        <Button variant="secondary" leading={<Icon name="external" size={14} />}>
          Browse marketplace
        </Button>
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
          <Input
            leading={<Icon name="search" size={14} />}
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            wrapperStyle={{ width: 280, padding: "6px 10px" }}
          />
        </div>
      </div>
    </header>
  );
}
