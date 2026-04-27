// AttendanceHeader — ported from project/attendance-shell.jsx ATopbar
// (lines 130-216). Breadcrumb + title + live indicator + actions, plus
// the tab strip with counts.
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button, Input } from "../../../design-system";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { ATT_STATS, NOW_LABEL, TIMESHEETS, TODAY_LABEL } from "../data/mocks";
import type { AttendanceTab } from "../AttendancePage";

interface TabSpec {
  id: AttendanceTab;
  label: string;
  icon: "clock" | "alert" | "file";
  count: number;
}

const TABS: TabSpec[] = [
  { id: "live", label: "Live operations", icon: "clock", count: ATT_STATS.on_duty },
  { id: "exceptions", label: "Exceptions", icon: "alert", count: ATT_STATS.exceptions },
  {
    id: "timesheets",
    label: "Timesheets",
    icon: "file",
    count: TIMESHEETS.filter((t) => t.status !== "approved").length,
  },
];

export interface AttendanceHeaderProps {
  view: AttendanceTab;
  onViewChange: (next: AttendanceTab) => void;
  livePulse?: boolean;
}

export function AttendanceHeader({ view, onViewChange, livePulse = true }: AttendanceHeaderProps) {
  const { palette } = useAccent();
  const readyCount = TIMESHEETS.filter((t) => t.status === "ready").length;

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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px 12px" }}>
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
            <span style={{ color: tokens.color.ink600 }}>Attendance</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
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
              Attendance
            </h1>
            <span style={{ fontSize: 13, color: tokens.color.ink600 }}>{TODAY_LABEL}</span>
          </div>
        </div>

        {view === "live" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: tokens.color.successSoft,
              border: `1px solid ${tokens.color.success}40`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: tokens.color.success,
                animation: livePulse ? "ms-pulse 1.4s ease-in-out infinite" : "none",
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                color: tokens.color.successInk,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              LIVE · {NOW_LABEL}
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
        </button>

        <Button variant="secondary" leading={<Icon name="download" size={14} />}>
          Export
        </Button>
        <Button variant="primary" accent={palette} leading={<Icon name="check" size={14} />}>
          Approve {readyCount} ready
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
                borderBottom: active ? `2px solid ${palette.primary}` : "2px solid transparent",
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
                {t.count}
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
            placeholder="Search officer or venue…"
            wrapperStyle={{ width: 240, padding: "6px 10px" }}
          />
        </div>
      </div>
    </header>
  );
}
