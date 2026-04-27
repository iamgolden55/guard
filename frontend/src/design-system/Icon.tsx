// ============================================================
// Icon registry — ported 1:1 from project/dashboard.jsx:166-196.
// stroke-width 1.8, viewBox 24x24, currentColor stroke.
// To extend: add a new entry to PATHS keyed by IconName.
// ============================================================
import type { ReactElement } from "react";

export type IconName =
  | "squares-2x2"
  | "calendar"
  | "clock"
  | "users"
  | "user-plus"
  | "sun"
  | "map-pin"
  | "shield"
  | "alert"
  | "receipt"
  | "banknote"
  | "plug"
  | "bell"
  | "search"
  | "plus"
  | "download"
  | "chevron-right"
  | "chevron-left"
  | "check"
  | "x"
  | "arrow-up"
  | "arrow-down"
  | "filter"
  | "more"
  | "menu"
  | "chevron-down"
  | "edit"
  | "eye"
  | "file"
  | "info"
  | "pause";

const PATHS: Record<IconName, ReactElement> = {
  "squares-2x2": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21.5 18.5c0-2.5-2-4.5-4.5-4.5" />
    </>
  ),
  "user-plus": (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M19 8v6M16 11h6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5M12 18v.01" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-3-2-3 2-2-2-3 2-3-2V3z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  banknote: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v.01M18 14v.01" />
    </>
  ),
  plug: (
    <>
      <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8z" />
      <path d="M12 17v5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0112 0v5l1.5 2H4.5L6 15v-5z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  check: <path d="M5 12l4 4L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  "arrow-up": <path d="M12 19V5M5 12l7-7 7 7" />,
  "arrow-down": <path d="M12 5v14M19 12l-7 7-7-7" />,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  edit: <path d="M4 20h4L20 8l-4-4L4 16v4z" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h8l4 4v14H7V3z" />
      <path d="M15 3v4h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
