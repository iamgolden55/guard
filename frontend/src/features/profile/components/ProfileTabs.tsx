import { tokens } from "../../../design-system/tokens";
import { useAccent } from "../../../contexts/AccentContext";

export type ProfileTabKey =
  | "personal"
  | "contact"
  | "licenses"
  | "bank"
  | "security";

export interface ProfileTab {
  key: ProfileTabKey;
  label: string;
}

export interface ProfileTabsProps {
  tabs: ProfileTab[];
  active: ProfileTabKey;
  onChange: (key: ProfileTabKey) => void;
}

export function ProfileTabs({ tabs, active, onChange }: ProfileTabsProps) {
  const { palette } = useAccent();
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: 0,
        borderBottom: `1px solid ${tokens.color.ink200}`,
        overflowX: "auto",
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
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              fontFamily: tokens.font.body,
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? palette.primary : tokens.color.ink600,
              borderBottom: `2px solid ${isActive ? palette.primary : "transparent"}`,
              marginBottom: -1,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: `color ${tokens.motion.fast}, border-color ${tokens.motion.fast}`,
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = tokens.color.ink800;
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = tokens.color.ink600;
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
