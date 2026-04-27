// SchedulingToast — bottom-center toast for drag-drop feedback.
// Tone-coloured tile + title + body + optional violation list.
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { SchedulingToast as ToastT, ToastTone } from "../state/SchedulingState";

const TONE_META: Record<
  ToastTone,
  { bg: string; fg: string; icon: IconName; tile: string }
> = {
  info: { bg: "#e7f1fb", fg: "#0b3a75", icon: "info", tile: "#2563eb" },
  success: { bg: tokens.color.successSoft, fg: tokens.color.successInk, icon: "check", tile: tokens.color.success },
  warning: { bg: tokens.color.warnSoft, fg: tokens.color.warnInk, icon: "alert", tile: tokens.color.warn },
  danger: { bg: tokens.color.dangerSoft, fg: tokens.color.dangerInk, icon: "shield-x", tile: tokens.color.danger },
};

export function SchedulingToast({ toast, onDismiss }: { toast: ToastT; onDismiss: () => void }) {
  const meta = TONE_META[toast.tone];
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: 360,
        maxWidth: 520,
        padding: "14px 16px",
        borderRadius: 12,
        background: "white",
        border: `1px solid ${meta.tile}33`,
        boxShadow: "0 12px 32px -8px rgba(32,31,30,0.32)",
        zIndex: tokens.z.toast,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        fontFamily: tokens.font.body,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: meta.tile,
          color: "white",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={meta.icon} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: tokens.color.ink900,
            letterSpacing: "-0.005em",
          }}
        >
          {toast.title}
        </div>
        {toast.body && (
          <div
            style={{
              fontSize: 12,
              color: tokens.color.ink600,
              marginTop: 3,
              lineHeight: 1.45,
            }}
          >
            {toast.body}
          </div>
        )}
        {toast.violations && toast.violations.length > 0 && (
          <ul
            style={{
              margin: "8px 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {toast.violations.map((v, i) => {
              const hard = v.tier === "hard";
              return (
                <li
                  key={i}
                  style={{
                    fontSize: 11.5,
                    color: hard ? tokens.color.dangerInk : tokens.color.warnInk,
                    background: hard ? tokens.color.dangerSoft : tokens.color.warnSoft,
                    border: `1px solid ${hard ? "#fbd0d4" : "#fad48a"}`,
                    borderRadius: 6,
                    padding: "5px 8px",
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "flex-start",
                  }}
                >
                  <Icon name={hard ? "shield-x" : "alert"} size={11} />
                  <span style={{ flex: 1 }}>
                    <strong>{v.code}</strong> · {v.msg}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: "transparent",
          border: "none",
          color: tokens.color.ink500,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
