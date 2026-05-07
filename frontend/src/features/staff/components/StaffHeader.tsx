// Page-level header strip — mirrors PayrollHeader.tsx visual conventions.
// Lives at the top of FullScreenAppLayout (no AppLayout topbar above it).
import { Link } from "react-router-dom";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export interface StaffHeaderProps {
  activeCount: number;
  pendingCount: number;
  expiringSiaCount: number;
  onInvite: () => void;
}

export function StaffHeader({
  activeCount,
  pendingCount,
  expiringSiaCount,
  onInvite,
}: StaffHeaderProps) {
  return (
    <header
      style={{
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        position: "sticky",
        top: 0,
        zIndex: tokens.z.sticky,
        padding: "14px 28px 16px",
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
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
            People
          </Link>
          <Icon name="chevron-right" size={11} />
          <span style={{ color: tokens.color.ink600 }}>Staff</span>
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
            Staff
          </h1>
          <span
            style={{
              fontSize: 13,
              color: tokens.color.ink600,
              fontFamily: tokens.font.body,
            }}
          >
            {activeCount} active
            {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
            {expiringSiaCount > 0 ? ` · ${expiringSiaCount} SIA expiring` : ""}
          </span>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        leading={<Icon name="user-plus" size={14} />}
        onClick={onInvite}
      >
        Invite staff
      </Button>
    </header>
  );
}
