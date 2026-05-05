// VenuesHeader — Attendance-shaped two-row sticky header.
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button, Input } from "../../../design-system";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export type VenuesTab = "active" | "inactive" | "all";
export type VenuesViewMode = "list" | "cards" | "map";

interface TabSpec {
  id: VenuesTab;
  label: string;
  icon: IconName;
}

const TABS: TabSpec[] = [
  { id: "active", label: "Active", icon: "check" },
  { id: "inactive", label: "Inactive", icon: "pause" },
  { id: "all", label: "All venues", icon: "stack" },
];

const VIEW_MODES: { id: VenuesViewMode; label: string; icon: IconName }[] = [
  { id: "list", label: "List view", icon: "stack" },
  { id: "cards", label: "Card view", icon: "squares-2x2" },
  { id: "map", label: "Map view", icon: "map-pin" },
];

export interface VenuesHeaderProps {
  view: VenuesTab;
  onViewChange: (next: VenuesTab) => void;
  viewMode: VenuesViewMode;
  onViewModeChange: (next: VenuesViewMode) => void;
  counts: { all: number; active: number; inactive: number };
  search: string;
  onSearchChange: (value: string) => void;
  onNewVenue: () => void;
}

export function VenuesHeader({
  view,
  onViewChange,
  viewMode,
  onViewModeChange,
  counts,
  search,
  onSearchChange,
  onNewVenue,
}: VenuesHeaderProps) {
  const { palette } = useAccent();
  const tabCount: Record<VenuesTab, number> = {
    active: counts.active,
    inactive: counts.inactive,
    all: counts.all,
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
            <span style={{ color: tokens.color.ink600 }}>Venues</span>
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
              Venues
            </h1>
            <span style={{ fontSize: 13, color: tokens.color.ink600 }}>
              {counts.all} {counts.all === 1 ? "venue" : "venues"}
              {counts.inactive > 0 ? ` · ${counts.inactive} inactive` : ""}
            </span>
          </div>
        </div>

        <div
          aria-label="View mode"
          style={{
            display: "inline-flex",
            background: tokens.color.ink100,
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          {VIEW_MODES.map((m) => {
            const active = viewMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onViewModeChange(m.id)}
                aria-label={m.label}
                aria-pressed={active}
                title={m.label}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "none",
                  background: active ? "white" : "transparent",
                  color: active ? palette.primary : tokens.color.ink600,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: active ? tokens.shadow.xs : "none",
                  transition: `background ${tokens.motion.fast}, color ${tokens.motion.fast}`,
                }}
              >
                <Icon name={m.icon} size={15} />
              </button>
            );
          })}
        </div>

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

        <Button
          variant="primary"
          accent={palette}
          leading={<Icon name="plus" size={14} />}
          onClick={onNewVenue}
        >
          New venue
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
                {tabCount[t.id]}
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
            placeholder="Search venue or city…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            wrapperStyle={{ width: 280, padding: "6px 10px" }}
          />
        </div>
      </div>
    </header>
  );
}
