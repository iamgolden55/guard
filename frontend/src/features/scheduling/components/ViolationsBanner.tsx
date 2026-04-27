// ViolationsBanner — top-of-canvas banner summarising hard/soft blocks.
// Ported 1:1 from project/scheduling-shell.jsx:313-347.
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { SHIFTS } from "../data/mocks";

export function ViolationsBanner() {
  const hards = SHIFTS.filter((s) => (s.violations || []).some((v) => v.tier === "hard"));
  const softs = SHIFTS.filter((s) => (s.violations || []).some((v) => v.tier === "soft"));
  if (hards.length === 0 && softs.length === 0) return null;

  const hasHard = hards.length > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 18px",
        margin: "14px 24px 0",
        borderRadius: 10,
        background: hasHard ? tokens.color.dangerSoft : tokens.color.warnSoft,
        border: `1px solid ${hasHard ? "#fbd0d4" : "#fad48a"}`,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          flexShrink: 0,
          background: hasHard ? tokens.color.danger : tokens.color.warn,
          color: "white",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name={hasHard ? "shield-x" : "alert"} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: hasHard ? tokens.color.dangerInk : tokens.color.warnInk,
            lineHeight: 1.3,
          }}
        >
          {hasHard
            ? `${hards.length} hard block${hards.length === 1 ? "" : "s"} must be resolved before publishing`
            : `${softs.length} soft warning${softs.length === 1 ? "" : "s"} — publish allowed`}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: hasHard ? tokens.color.dangerInk : tokens.color.warnInk,
            opacity: 0.85,
            marginTop: 2,
          }}
        >
          {hasHard
            ? "Expired SIA licences and assignments during approved leave block publication."
            : "Overtime tiers, bank holiday uplift and rest-period warnings — admin can acknowledge."}
        </div>
      </div>
      <Button variant="ghost" size="sm">
        Review {hards.length + softs.length}
      </Button>
    </div>
  );
}
