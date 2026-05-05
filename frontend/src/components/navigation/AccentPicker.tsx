// Radix dropdown that swaps the accent palette at runtime. The picker is
// the production replacement for the prototype's tweaks panel.
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAccent } from "../../contexts/AccentContext";
import { type AccentName, accents } from "../../design-system/accents";
import { tokens } from "../../design-system/tokens";

const LABELS: Record<AccentName, string> = {
  "brand-red": "Brand red",
  "deep-navy": "Deep navy",
  forest: "Forest",
  graphite: "Graphite",
};

export function AccentPicker() {
  const { accent, setAccent } = useAccent();
  const current = accents[accent];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Change accent"
          title="Change accent"
          style={{
            width: 28,
            height: 28,
            borderRadius: tokens.radius.pill,
            background: `linear-gradient(135deg, ${current.primary} 0%, ${current.dark} 100%)`,
            border: `1px solid ${tokens.color.ink200}`,
            cursor: "pointer",
            boxShadow: tokens.shadow.xs,
            flexShrink: 0,
          }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          style={{
            background: "white",
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            boxShadow: tokens.shadow.md,
            padding: 6,
            minWidth: 180,
            fontFamily: tokens.font.body,
            zIndex: tokens.z.overlay,
          }}
        >
          {(Object.keys(accents) as AccentName[]).map((name) => {
            const palette = accents[name];
            const active = name === accent;
            return (
              <DropdownMenu.Item
                key={name}
                onSelect={() => setAccent(name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: tokens.radius.sm,
                  fontSize: 13,
                  color: tokens.color.ink800,
                  background: active ? tokens.color.ink50 : "transparent",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background = tokens.color.ink50;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.dark} 100%)`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{LABELS[name]}</span>
                {active && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={tokens.color.ink600}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l4 4L19 7" />
                  </svg>
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
