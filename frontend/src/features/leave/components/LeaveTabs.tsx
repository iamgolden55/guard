import { useAccent } from "../../../contexts/AccentContext";
import { tokens } from "../../../design-system/tokens";

export type LeaveTabKey = "calendar" | "requests" | "approvals";

export interface LeaveTabsProps {
  active: LeaveTabKey;
  myRequestsCount: number;
  pendingCount: number;
  showApprovals: boolean;
  onChange: (key: LeaveTabKey) => void;
}

export function LeaveTabs({
  active,
  myRequestsCount,
  pendingCount,
  showApprovals,
  onChange,
}: LeaveTabsProps) {
  const { palette } = useAccent();
  const tabs: { key: LeaveTabKey; label: string; count?: number }[] = [
    { key: "calendar", label: "Calendar" },
    { key: "requests", label: "My requests", count: myRequestsCount },
  ];
  if (showApprovals) {
    tabs.push({ key: "approvals", label: "Approvals", count: pendingCount });
  }

  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: tokens.color.ink100,
        borderRadius: tokens.radius.lg,
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: tokens.radius.md,
              border: "none",
              background: isActive ? "white" : "transparent",
              color: isActive ? palette.primary : tokens.color.ink700,
              fontFamily: tokens.font.body,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: isActive ? tokens.shadow.xs : "none",
              transition: `background ${tokens.motion.fast}`,
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: tokens.font.mono,
                  background: isActive ? palette.soft : "white",
                  color: isActive ? palette.ink : tokens.color.ink600,
                  padding: "1px 7px",
                  borderRadius: 8,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
