// Active / Pending segmented control. Lives above the filter bar.
import { useAccent } from "../../../contexts/AccentContext";
import { tokens } from "../../../design-system/tokens";

export type StaffTabKey = "active" | "pending";

export interface StaffTabCounts {
  active: number;
  pending: number;
}

export interface StaffTabsProps {
  active: StaffTabKey;
  counts: StaffTabCounts;
  onChange: (key: StaffTabKey) => void;
}

const TABS: { key: StaffTabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending approval" },
];

export function StaffTabs({ active, counts, onChange }: StaffTabsProps) {
  const { palette } = useAccent();
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
      {TABS.map((t) => {
        const isActive = t.key === active;
        const count = counts[t.key];
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
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
