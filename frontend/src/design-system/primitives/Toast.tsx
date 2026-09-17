// Toast — the bottom-centre pill that VenuesPage, RecruitmentPage,
// CompliancePage et al. had each re-declared inline. Same visual, one
// definition, plus a danger tone so a failed mutation doesn't look
// identical to a successful one.
import { tokens } from "../tokens";

export type ToastTone = "neutral" | "danger";

export interface ToastProps {
  message: string;
  tone?: ToastTone;
}

export function Toast({ message, tone = "neutral" }: ToastProps) {
  const danger = tone === "danger";
  return (
    <output
      aria-live="polite"
      style={{
        display: "block",
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "min(560px, calc(100vw - 32px))",
        padding: "12px 20px",
        borderRadius: 999,
        background: danger ? tokens.color.danger : tokens.color.ink900,
        color: "white",
        fontFamily: tokens.font.body,
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
        boxShadow: "0 12px 32px -8px rgba(32,31,30,0.4)",
        zIndex: tokens.z.toast,
      }}
    >
      {message}
    </output>
  );
}
