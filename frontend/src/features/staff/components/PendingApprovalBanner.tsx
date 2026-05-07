import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export interface PendingApprovalBannerProps {
  count: number;
  onReview: () => void;
}

export function PendingApprovalBanner({
  count,
  onReview,
}: PendingApprovalBannerProps) {
  if (count <= 0) return null;
  return (
    <div
      style={{
        background: tokens.color.warnSoft,
        color: tokens.color.warnInk,
        border: `1px solid ${tokens.color.warn}33`,
        borderRadius: tokens.radius.lg,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: `${tokens.color.warn}22`,
          display: "grid",
          placeItems: "center",
          color: tokens.color.warn,
          flexShrink: 0,
        }}
      >
        <Icon name="alert" size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0, fontFamily: tokens.font.body }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {count} {count === 1 ? "staff member is" : "staff members are"} waiting
          for approval
        </div>
        <div style={{ fontSize: 12, color: tokens.color.ink600, marginTop: 2 }}>
          Review their profiles before they can be scheduled.
        </div>
      </div>
      <button
        type="button"
        onClick={onReview}
        style={{
          background: "white",
          color: tokens.color.warnInk,
          border: `1px solid ${tokens.color.warn}33`,
          borderRadius: tokens.radius.md,
          padding: "8px 14px",
          fontFamily: tokens.font.display,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Review pending →
      </button>
    </div>
  );
}
