// PaperFrame — wraps a template with paper-effect shadow + grain.
// Ported 1:1 from project/invoice-document.jsx:45-78.
import type { ReactNode } from "react";

export interface PaperFrameProps {
  children: ReactNode;
  paperEffect?: boolean;
  scale?: number;
}

export function PaperFrame({ children, paperEffect = true, scale = 1 }: PaperFrameProps) {
  return (
    <div
      style={{
        position: "relative",
        background: "white",
        width: 760,
        minHeight: 1000,
        boxShadow: paperEffect
          ? "0 1px 1px rgba(32,31,30,0.04), 0 4px 8px rgba(32,31,30,0.06), 0 24px 48px -12px rgba(32,31,30,0.18), 0 48px 80px -24px rgba(32,31,30,0.12)"
          : "0 1px 2px rgba(32,31,30,0.06), 0 4px 12px rgba(32,31,30,0.08)",
        borderRadius: paperEffect ? 4 : 8,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        overflow: "hidden",
      }}
    >
      {paperEffect && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at 20% 0%, rgba(255,250,240,0.6), transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(245,240,235,0.5), transparent 60%)",
              mixBlendMode: "multiply",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.9), rgba(255,255,255,0))",
            }}
          />
        </>
      )}
      {children}
    </div>
  );
}
