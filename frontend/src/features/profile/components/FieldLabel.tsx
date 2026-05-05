import type { ReactNode } from "react";
import { tokens } from "../../../design-system/tokens";

export interface FieldLabelProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function FieldLabel({ label, required, hint, error, children }: FieldLabelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 600,
          fontSize: 12,
          color: tokens.color.ink700,
        }}
      >
        {label}
        {required && <span style={{ color: tokens.color.danger, marginLeft: 4 }}>*</span>}
      </span>
      {children}
      {hint && !error && (
        <span style={{ fontSize: 11, color: tokens.color.ink500 }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: tokens.color.dangerInk }}>{error}</span>
      )}
    </div>
  );
}
