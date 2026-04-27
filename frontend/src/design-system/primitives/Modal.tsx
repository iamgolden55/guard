// MSModal — ported 1:1 from project/design-system.jsx:217-307.
// Mount/visible state machine for enter/exit animation. Escape to close.
// Body-scroll lock while open.
import { useEffect, useState, type ReactNode } from "react";
import { tokens } from "../tokens";
import { accents } from "../accents";
import { textStyles } from "./Text";

export type ModalSize = "sm" | "md" | "lg";
export type ModalTone = "default" | "danger";

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  tone?: ModalTone;
  children?: ReactNode;
  footer?: ReactNode;
  hideClose?: boolean;
}

const WIDTHS: Record<ModalSize, number> = { sm: 400, md: 520, lg: 720 };

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  tone = "default",
  children,
  footer,
  hideClose,
}: ModalProps) {
  const [mount, setMount] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMount(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMount(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mount) return null;

  const accent = tone === "danger" ? tokens.color.danger : accents["brand-red"].primary;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: tokens.z.modal,
        background: visible ? "rgba(32,31,30,0.55)" : "rgba(32,31,30,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        transition: `background ${tokens.motion.base}, backdrop-filter ${tokens.motion.base}`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(100%, ${WIDTHS[size]}px)`,
          background: "white",
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.color.ink200}`,
          boxShadow: tokens.shadow.lg,
          transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)",
          opacity: visible ? 1 : 0,
          transition: `transform ${tokens.motion.base}, opacity ${tokens.motion.base}`,
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ height: 3, background: accent }} />

        <div
          style={{
            padding: "20px 24px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            borderBottom: `1px solid ${tokens.color.ink200}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                ...textStyles.h3,
                fontSize: 17,
                marginBottom: description ? 4 : 0,
              }}
            >
              {title}
            </div>
            {description && (
              <div style={{ ...textStyles.mute, fontSize: 13 }}>{description}</div>
            )}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: tokens.radius.md,
                background: "transparent",
                color: tokens.color.ink600,
                border: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.color.ink100;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            ...textStyles.body,
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: "14px 24px",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              borderTop: `1px solid ${tokens.color.ink200}`,
              background: tokens.color.ink50,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
