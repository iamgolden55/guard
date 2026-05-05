// AttendanceHeader — ported from project/attendance-shell.jsx ATopbar
// (lines 130-216). Breadcrumb + title + live indicator + actions, plus
// the tab strip with counts.
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button, Input } from "../../../design-system";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { useAttendance } from "../AttendanceContext";
import type { AttendanceTab } from "../AttendancePage";
import {
  exportExceptions,
  exportLive,
  exportTimesheets,
} from "../data/exporters";

interface TabSpec {
  id: AttendanceTab;
  label: string;
  icon: "clock" | "alert" | "file";
  count: number;
}

export interface AttendanceHeaderProps {
  view: AttendanceTab;
  onViewChange: (next: AttendanceTab) => void;
  livePulse?: boolean;
  /** Live-tab only: collapse the KPI/roster left rail and the venue board right rail. */
  leftRailOpen?: boolean;
  venueGridOpen?: boolean;
  onToggleLeftRail?: () => void;
  onToggleVenueGrid?: () => void;
}

export function AttendanceHeader({
  view,
  onViewChange,
  livePulse = true,
  leftRailOpen,
  venueGridOpen,
  onToggleLeftRail,
  onToggleVenueGrid,
}: AttendanceHeaderProps) {
  const { palette } = useAccent();
  const ctx = useAttendance();
  const {
    stats,
    timesheets,
    todayLabel,
    nowLabel,
    searchQuery,
    setSearchQuery,
    isToday,
    selectedDate,
    setSelectedDate,
    selectedWeekStart,
    setSelectedWeekStart,
  } = ctx;
  const readyCount = timesheets.filter((t) => t.status === "ready").length;
  const isWeekView = view === "timesheets";
  const handleExport = () => {
    const exporterCtx = {
      shifts: ctx.shifts,
      officers: ctx.officers,
      venues: ctx.venues,
      timesheets: ctx.timesheets,
      weekDays: ctx.weekDays,
      officerById: ctx.officerById,
      venueById: ctx.venueById,
    };
    if (view === "timesheets") exportTimesheets(exporterCtx);
    else if (view === "exceptions") exportExceptions(exporterCtx);
    else exportLive(exporterCtx);
  };
  const TABS: TabSpec[] = [
    {
      id: "live",
      label: "Live operations",
      icon: "clock",
      count: stats.on_duty,
    },
    {
      id: "exceptions",
      label: "Exceptions",
      icon: "alert",
      count: stats.exceptions,
    },
    {
      id: "timesheets",
      label: "Timesheets",
      icon: "file",
      count: timesheets.filter((t) => t.status !== "approved").length,
    },
  ];

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
            <span style={{ color: tokens.color.ink600 }}>Attendance</span>
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
              Attendance
            </h1>
            <span style={{ fontSize: 13, color: tokens.color.ink600 }}>
              {todayLabel}
            </span>
          </div>
        </div>

        <DateNavigator
          mode={isWeekView ? "week" : "day"}
          dayValue={selectedDate}
          weekValue={selectedWeekStart}
          onDayChange={setSelectedDate}
          onWeekChange={setSelectedWeekStart}
          accentInk={palette.ink}
        />

        {view === "live" && isToday && (
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
                animation: livePulse
                  ? "ms-pulse 1.4s ease-in-out infinite"
                  : "none",
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
              LIVE · {nowLabel}
            </span>
          </div>
        )}

        {view === "live" && onToggleLeftRail && (
          <PaneToggleButton
            side="left"
            open={leftRailOpen ?? true}
            onClick={onToggleLeftRail}
          />
        )}
        {view === "live" && onToggleVenueGrid && (
          <PaneToggleButton
            side="right"
            open={venueGridOpen ?? true}
            onClick={onToggleVenueGrid}
          />
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

        <Button
          variant="secondary"
          leading={<Icon name="download" size={14} />}
          onClick={handleExport}
        >
          Export
        </Button>
        <Button
          variant="primary"
          accent={palette}
          leading={
            <Icon name={readyCount === 0 ? "lock" : "check"} size={14} />
          }
          disabled={readyCount === 0}
          title={
            readyCount === 0
              ? "Nothing to approve — shifts auto-approve when officers check out cleanly. Manual approval is only for shifts that need review."
              : undefined
          }
        >
          {readyCount === 0
            ? "Nothing to approve"
            : `Approve ${readyCount} ready`}
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
    </header>
  );
}

interface PaneToggleButtonProps {
  side: "left" | "right";
  open: boolean;
  onClick: () => void;
}

function PaneToggleButton({ side, open, onClick }: PaneToggleButtonProps) {
  const label =
    side === "left"
      ? open
        ? "Hide KPI rail"
        : "Show KPI rail"
      : open
        ? "Hide venue board"
        : "Show venue board";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: open ? tokens.color.ink100 : "transparent",
        border: open ? "none" : `1px solid ${tokens.color.ink200}`,
        color: open ? tokens.color.ink800 : tokens.color.ink500,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background .15s, color .15s",
      }}
    >
      <Icon name={side === "left" ? "panel-left" : "panel-right"} size={17} />
    </button>
  );
}

interface DateNavigatorProps {
  mode: "day" | "week";
  dayValue: string;
  weekValue: string;
  onDayChange: (iso: string) => void;
  onWeekChange: (iso: string) => void;
  accentInk: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayIsoFor(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + offset);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function DateNavigator({
  mode,
  dayValue,
  weekValue,
  onDayChange,
  onWeekChange,
  accentInk,
}: DateNavigatorProps) {
  const isDay = mode === "day";
  const value = isDay ? dayValue : weekValue;
  const step = isDay ? 1 : 7;
  const onChange = isDay ? onDayChange : onWeekChange;
  const today = todayIso();
  const isAtToday = isDay ? value === today : value === mondayIsoFor(today);

  const handleNudge = (dir: -1 | 1) => onChange(shiftIso(value, dir * step));
  const handlePick = (iso: string) => {
    if (!iso) return;
    onChange(isDay ? iso : mondayIsoFor(iso));
  };
  const handleReset = () => onChange(isDay ? today : mondayIsoFor(today));

  const navBtn: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 6,
    background: "transparent",
    border: `1px solid ${tokens.color.ink200}`,
    color: tokens.color.ink700,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 6px",
        borderRadius: 8,
        background: tokens.color.ink50 ?? "#fafafa",
        border: `1px solid ${tokens.color.ink200}`,
      }}
    >
      <button
        type="button"
        onClick={() => handleNudge(-1)}
        aria-label={isDay ? "Previous day" : "Previous week"}
        title={isDay ? "Previous day" : "Previous week"}
        style={navBtn}
      >
        <Icon name="chevron-left" size={14} />
      </button>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 6,
          background: "white",
          border: `1px solid ${tokens.color.ink200}`,
          cursor: "pointer",
          fontFamily: tokens.font.body,
          fontSize: 12.5,
          color: tokens.color.ink800,
        }}
      >
        <Icon name="calendar" size={13} />
        <input
          type="date"
          value={value}
          onChange={(e) => handlePick(e.target.value)}
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: 12.5,
            color: tokens.color.ink800,
            fontFamily: tokens.font.body,
            padding: 0,
            cursor: "pointer",
          }}
          aria-label={isDay ? "Pick a date" : "Pick a week"}
        />
      </label>
      <button
        type="button"
        onClick={() => handleNudge(1)}
        aria-label={isDay ? "Next day" : "Next week"}
        title={isDay ? "Next day" : "Next week"}
        style={navBtn}
      >
        <Icon name="chevron-right" size={14} />
      </button>
      <button
        type="button"
        onClick={handleReset}
        disabled={isAtToday}
        title={isDay ? "Jump to today" : "Jump to this week"}
        style={{
          height: 30,
          padding: "0 12px",
          borderRadius: 6,
          background: isAtToday ? "transparent" : "white",
          border: `1px solid ${isAtToday ? tokens.color.ink200 : accentInk}40`,
          color: isAtToday ? tokens.color.ink400 : accentInk,
          fontFamily: tokens.font.body,
          fontSize: 12,
          fontWeight: 600,
          cursor: isAtToday ? "default" : "pointer",
          flexShrink: 0,
        }}
      >
        {isDay ? "Today" : "This week"}
      </button>
    </div>
  );
}
