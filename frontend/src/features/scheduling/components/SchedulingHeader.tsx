// SchedulingHeader — page-level breadcrumb + title + draft pill + actions.
// Ported 1:1 from project/scheduling-shell.jsx Topbar (lines 142-188).
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { useScheduling, weekCounts } from "../state/SchedulingState";

export interface SchedulingHeaderProps {
  onPublish: () => void;
  onNewShift: () => void;
}

export function SchedulingHeader({ onPublish, onNewShift }: SchedulingHeaderProps) {
  const { palette } = useAccent();
  const { shifts } = useScheduling();
  const counts = weekCounts(shifts);
  const draftCount = counts.draft;
  const hardCount = counts.hardViols;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 24px",
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        position: "sticky",
        top: 0,
        zIndex: tokens.z.sticky,
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
          <Link to="/dashboard" style={{ color: tokens.color.ink500, textDecoration: "none" }}>
            Operations
          </Link>
          <Icon name="chevron-right" size={11} />
          <span style={{ color: tokens.color.ink600 }}>Scheduling</span>
        </div>
        <h1
          style={{
            margin: "2px 0 0",
            fontFamily: tokens.font.display,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: tokens.color.ink900,
          }}
        >
          Scheduling
        </h1>
      </div>

      {draftCount > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            borderRadius: 8,
            background: tokens.color.warnSoft,
            border: "1px solid #fad48a",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: tokens.color.warn,
              animation: "ms-pulse 1.6s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: 12.5, color: tokens.color.warnInk, fontWeight: 600 }}>
            {draftCount} draft{draftCount === 1 ? "" : "s"} not yet visible to officers
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

      <Button variant="secondary" leading={<Icon name="copy" size={14} />}>
        Copy last week
      </Button>
      <Button variant="secondary" leading={<Icon name="plus" size={14} />} onClick={onNewShift}>
        New shift
      </Button>
      <Button
        variant="primary"
        accent={palette}
        leading={<Icon name="send" size={14} />}
        onClick={onPublish}
        disabled={hardCount > 0}
      >
        Publish week
      </Button>
    </header>
  );
}
