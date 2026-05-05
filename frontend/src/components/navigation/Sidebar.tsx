// Sidebar — ported 1:1 from project/dashboard.jsx:198-301.
// Adapted to React Router (paths instead of setActive callbacks).
// Collapsed/expanded state persisted to localStorage so reloads keep it.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccent } from "../../contexts/AccentContext";
import { useAuth } from "../../contexts/AuthContext";
import { Icon } from "../../design-system/Icon";
import { Avatar } from "../../design-system/primitives/Avatar";
import { tokens } from "../../design-system/tokens";
import { AccentPicker } from "./AccentPicker";
import { NAV } from "./nav-config";

const STORAGE_KEY = "ms-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export interface SidebarProps {
  /** When true, the sidebar is rendered as a fixed-position drawer (mobile). */
  drawer?: boolean;
  /** Called when a nav item is clicked; useful to close the mobile drawer. */
  onNavigate?: () => void;
}

export function Sidebar({ drawer = false, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState, logout } = useAuth();
  const { palette } = useAccent();

  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  // Drawer mode: always render expanded.
  const effectiveCollapsed = drawer ? false : collapsed;
  const w = effectiveCollapsed ? 76 : 244;

  const userName =
    authState.user?.firstName && authState.user?.lastName
      ? `${authState.user.firstName} ${authState.user.lastName}`
      : authState.user?.username || "Guest";
  const userRole =
    authState.currentMembership?.role || authState.user?.role || "";

  return (
    <aside
      style={{
        width: w,
        flexShrink: 0,
        background: "white",
        borderRight: `1px solid ${tokens.color.ink200}`,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: drawer ? "fixed" : "sticky",
        top: 0,
        left: 0,
        transition: "width 0.25s ease",
        zIndex: drawer ? tokens.z.modal : tokens.z.sticky + 1,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: effectiveCollapsed ? "22px 0 22px" : "22px 20px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: effectiveCollapsed ? "center" : "flex-start",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.dark} 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: `0 4px 10px -4px ${palette.primary}66`,
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
          </svg>
        </div>
        {!effectiveCollapsed && (
          <div style={{ lineHeight: 1.1, flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: "-0.02em",
                color: tokens.color.ink900,
              }}
            >
              Mead Security
            </div>
            <div
              style={{
                fontSize: 11,
                color: tokens.color.ink500,
                fontWeight: 500,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Operations
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle (desktop only) */}
      {!drawer && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={
            effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            position: "absolute",
            top: 28,
            right: -12,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: "white",
            border: `1px solid ${tokens.color.ink200}`,
            color: tokens.color.ink600,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            boxShadow: tokens.shadow.sm,
            zIndex: tokens.z.sticky + 2,
            transition: "transform .2s, color .15s, background .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = palette.primary;
            e.currentTarget.style.background = palette.soft;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = tokens.color.ink600;
            e.currentTarget.style.background = "white";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: effectiveCollapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform .25s",
            }}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: effectiveCollapsed ? "4px 10px 16px" : "4px 12px 16px",
        }}
      >
        {NAV.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            {!effectiveCollapsed && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: tokens.color.ink500,
                  padding: "10px 10px 6px",
                }}
              >
                {group.group}
              </div>
            )}
            {group.items.map((item) => {
              const isActive =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigate(item.path);
                    onNavigate?.();
                  }}
                  title={effectiveCollapsed ? item.label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    gap: 12,
                    padding: effectiveCollapsed ? "10px" : "9px 10px",
                    borderRadius: 8,
                    background: isActive ? palette.soft : "transparent",
                    color: isActive ? palette.ink : tokens.color.ink800,
                    border: "none",
                    cursor: "pointer",
                    marginBottom: 2,
                    fontFamily: tokens.font.body,
                    fontSize: 13.5,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: "-0.005em",
                    justifyContent: effectiveCollapsed
                      ? "center"
                      : "flex-start",
                    position: "relative",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = tokens.color.ink50;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        left: effectiveCollapsed ? 4 : -4,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: 2,
                        background: palette.primary,
                      }}
                    />
                  )}
                  <span
                    style={{
                      color: isActive ? palette.primary : tokens.color.ink600,
                      display: "flex",
                    }}
                  >
                    <Icon name={item.icon} size={18} />
                  </span>
                  {!effectiveCollapsed && (
                    <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User strip */}
      <div
        style={{
          borderTop: `1px solid ${tokens.color.ink200}`,
          padding: effectiveCollapsed ? "12px" : "14px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: effectiveCollapsed ? "center" : "flex-start",
        }}
      >
        <button
          type="button"
          onClick={() => {
            navigate("/profile");
            onNavigate?.();
          }}
          aria-label="Open my profile"
          title={
            effectiveCollapsed ? `${userName} — open profile` : "Open profile"
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "transparent",
            border: "none",
            padding: 4,
            margin: -4,
            borderRadius: 8,
            cursor: "pointer",
            flex: effectiveCollapsed ? "0 0 auto" : 1,
            minWidth: 0,
            textAlign: "left",
            transition: `background ${tokens.motion.fast}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.color.ink50;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Avatar name={userName} hue={356} size={34} />
          {!effectiveCollapsed && (
            <div style={{ lineHeight: 1.15, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: tokens.color.ink900,
                  fontFamily: tokens.font.body,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {userName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: tokens.color.ink500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textTransform: "capitalize",
                }}
              >
                {userRole}
              </div>
            </div>
          )}
        </button>
        {!effectiveCollapsed && (
          <>
            <AccentPicker />
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              aria-label="Sign out"
              title="Sign out"
              style={{
                width: 28,
                height: 28,
                borderRadius: tokens.radius.pill,
                background: tokens.color.ink100,
                color: tokens.color.ink600,
                border: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.color.dangerSoft;
                e.currentTarget.style.color = tokens.color.dangerInk;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = tokens.color.ink100;
                e.currentTarget.style.color = tokens.color.ink600;
              }}
            >
              <Icon name="x" size={14} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
