import { Link } from "react-router-dom";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export interface LeaveHeaderProps {
  totalAvailable: number;
  totalPending: number;
  totalUsed: number;
  onRequestLeave: () => void;
}

function formatDays(value: number): string {
  // Render whole days as "5 days", halves as "5.5 days".
  const rounded = Math.round(value * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

export function LeaveHeader({
  totalAvailable,
  totalPending,
  totalUsed,
  onRequestLeave,
}: LeaveHeaderProps) {
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
          <span style={{ color: tokens.color.ink600 }}>Leave</span>
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
            Leave
          </h1>
          <span
            style={{
              fontSize: 13,
              color: tokens.color.ink600,
              fontFamily: tokens.font.body,
            }}
          >
            {formatDays(totalAvailable)} days available
            {totalPending > 0 ? ` · ${formatDays(totalPending)} pending` : ""}
            {totalUsed > 0 ? ` · ${formatDays(totalUsed)} used` : ""}
          </span>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        leading={<Icon name="plus" size={14} />}
        onClick={onRequestLeave}
      >
        Request leave
      </Button>
    </header>
  );
}
