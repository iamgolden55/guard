// Topbar — ported 1:1 from project/dashboard.jsx:306-359.
// Time-based greeting + page eyebrow, search placeholder, notifications,
// primary CTA. Includes the mobile-drawer hamburger trigger.
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAccent } from "../../contexts/AccentContext";
import { Icon } from "../../design-system/Icon";
import { tokens } from "../../design-system/tokens";

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const ROUTE_TITLES: Record<string, { eyebrow: string; title?: string }> = {
  "/dashboard": { eyebrow: "Dashboard · Admin" },
  "/scheduling": { eyebrow: "Scheduling · Admin" },
  "/attendance": { eyebrow: "Attendance · Admin" },
  "/invoices": { eyebrow: "Invoices · Admin" },
  "/payroll": { eyebrow: "Payroll · Admin" },
  "/staff": { eyebrow: "People · Admin" },
  "/leave": { eyebrow: "Leave · Admin" },
  "/venues": { eyebrow: "Venues · Admin" },
  "/compliance": { eyebrow: "Compliance · Admin" },
  "/incidents": { eyebrow: "Incidents · Admin" },
  "/recruitment": { eyebrow: "Recruitment · Admin" },
  "/integrations": { eyebrow: "Integrations · Admin" },
};

const iconButtonStyle = {
  position: "relative" as const,
  width: 38,
  height: 38,
  borderRadius: 8,
  background: tokens.color.ink100,
  border: "none",
  color: tokens.color.ink800,
  display: "grid" as const,
  placeItems: "center" as const,
  cursor: "pointer",
  flexShrink: 0,
};

export interface TopbarProps {
  /** Mobile-only hamburger handler. When provided, the menu button renders. */
  onMenuClick?: () => void;
  onPrimaryAction?: () => void;
}

export function Topbar({ onMenuClick, onPrimaryAction }: TopbarProps) {
  const location = useLocation();
  const { authState } = useAuth();
  const { palette } = useAccent();

  const eyebrow = ROUTE_TITLES[location.pathname]?.eyebrow ?? "Mead Security";
  const firstName = authState.user?.firstName || authState.user?.username || "there";
  const greet = useMemo(() => `${greeting()}, ${firstName}`, [firstName]);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 28px",
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        position: "sticky",
        top: 0,
        zIndex: tokens.z.sticky,
      }}
    >
      {onMenuClick && (
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          style={iconButtonStyle}
          className="lg:hidden"
        >
          <Icon name="menu" size={20} />
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: tokens.color.ink500,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            margin: "2px 0 0",
            fontFamily: tokens.font.display,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: tokens.color.ink900,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {greet}
        </h1>
      </div>

      {/* Search */}
      <div
        className="hidden md:flex"
        style={{
          alignItems: "center",
          gap: 8,
          background: tokens.color.ink100,
          borderRadius: 8,
          padding: "8px 12px",
          minWidth: 280,
          color: tokens.color.ink600,
        }}
      >
        <Icon name="search" size={16} />
        <input
          placeholder="Search staff, venues, shifts…"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            fontFamily: tokens.font.body,
            flex: 1,
            color: tokens.color.ink800,
          }}
        />
        <kbd
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 10,
            color: tokens.color.ink600,
            background: "white",
            border: `1px solid ${tokens.color.ink200}`,
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Notifications */}
      <button type="button" aria-label="Notifications" style={iconButtonStyle}>
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

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onPrimaryAction}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: palette.primary,
          color: "white",
          border: "none",
          padding: "9px 16px",
          borderRadius: 8,
          fontFamily: tokens.font.display,
          fontWeight: 600,
          fontSize: 13.5,
          cursor: "pointer",
          letterSpacing: "-0.005em",
          boxShadow: `0 6px 14px -6px ${palette.primary}aa`,
        }}
      >
        <Icon name="plus" size={16} />
        <span className="hidden sm:inline">New shift</span>
      </button>
    </header>
  );
}
