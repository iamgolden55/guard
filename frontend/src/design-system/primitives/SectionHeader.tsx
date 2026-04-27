// MSSectionHeader — ported 1:1 from project/design-system.jsx:116-124.
import type { CSSProperties, ReactNode } from "react";
import { textStyles } from "./Text";

export interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  style?: CSSProperties;
}

export function SectionHeader({ title, subtitle, right, style }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 16,
        gap: 12,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0, ...textStyles.h3 }}>{title}</h3>
        {subtitle && <div style={{ ...textStyles.mute, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}
