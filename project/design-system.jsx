// ============================================================
// Mead Security — Design System
// Single source of truth for tokens + primitives.
// Shared via `window.MS` so every page pulls the same vocab.
// ============================================================

const MS_TOKENS = {
  // Color
  color: {
    // Brand (from frontend/index.css)
    primary:      "#cb2431",
    primaryDark:  "#991b25",
    primarySoft:  "#fde7e9",
    primaryInk:   "#5b0a10",

    // Ink scale (neutrals)
    ink0:   "#ffffff",
    ink50:  "#faf9f8",
    ink100: "#f3f2f1",
    ink200: "#edebe9",
    ink300: "#e1dfdd",
    ink400: "#c8c6c4",
    ink500: "#a19f9d",
    ink600: "#605e5c",
    ink700: "#3b3a39",
    ink800: "#323130",
    ink900: "#201f1e",

    // Semantic
    success:     "#0f9d58",
    successSoft: "#e6f4ea",
    successInk:  "#0f5132",
    warn:        "#d97706",
    warnSoft:    "#fff4e5",
    warnInk:     "#7a4a00",
    danger:      "#cb2431",
    dangerSoft:  "#fde7e9",
    dangerInk:   "#991b25",
    info:        "#2563eb",
    infoSoft:    "#e7f0fa",
    infoInk:     "#0b3a75",
  },

  // Typography
  font: {
    display: "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
    body:    "'Inter', system-ui, sans-serif",
    mono:    "'SF Mono', 'Fira Code', Consolas, monospace",
  },

  // 4px spacing scale
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48 },

  // Radii
  radius: { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 },

  // Elevation
  shadow: {
    xs: "0 1px 2px rgba(32,31,30,0.04)",
    sm: "0 2px 6px -2px rgba(32,31,30,0.08), 0 1px 2px rgba(32,31,30,0.04)",
    md: "0 10px 24px -8px rgba(32,31,30,0.14), 0 4px 8px -4px rgba(32,31,30,0.06)",
    lg: "0 24px 48px -16px rgba(32,31,30,0.22), 0 8px 16px -8px rgba(32,31,30,0.10)",
    focus: "0 0 0 3px rgba(203,36,49,0.22)",
  },

  // Motion
  motion: {
    fast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "320ms cubic-bezier(0.4, 0, 0.2, 1)",
  },

  // Z-index
  z: { base: 1, sticky: 10, overlay: 50, modal: 60, toast: 70 },
};

// Accent override palettes used by Tweaks — each inherits base tokens
// but remaps the brand-primary family so accent swaps cascade everywhere.
const MS_ACCENTS = {
  "brand-red": { primary: "#cb2431", dark: "#991b25", soft: "#fde7e9", ink: "#5b0a10" },
  "deep-navy": { primary: "#1e3a8a", dark: "#172554", soft: "#dbeafe", ink: "#0b1d47" },
  "forest":    { primary: "#15803d", dark: "#14532d", soft: "#dcfce7", ink: "#0a3d1f" },
  "graphite":  { primary: "#27272a", dark: "#09090b", soft: "#e4e4e7", ink: "#09090b" },
};

// ============================================================
// Primitives
// ============================================================

// --- Text ---
const MSText = {
  h1: { fontFamily: MS_TOKENS.font.display, fontWeight: 700, fontSize: 28, letterSpacing: "-0.025em", lineHeight: 1.15, color: MS_TOKENS.color.ink900 },
  h2: { fontFamily: MS_TOKENS.font.display, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em",  lineHeight: 1.2,  color: MS_TOKENS.color.ink900 },
  h3: { fontFamily: MS_TOKENS.font.display, fontWeight: 700, fontSize: 15, letterSpacing: "-0.015em", lineHeight: 1.3,  color: MS_TOKENS.color.ink900 },
  body: { fontFamily: MS_TOKENS.font.body, fontWeight: 400, fontSize: 13.5, lineHeight: 1.5, color: MS_TOKENS.color.ink800 },
  label: { fontFamily: MS_TOKENS.font.body, fontWeight: 600, fontSize: 12, color: MS_TOKENS.color.ink700 },
  mute:  { fontFamily: MS_TOKENS.font.body, fontWeight: 400, fontSize: 12, color: MS_TOKENS.color.ink500 },
  over:  { fontFamily: MS_TOKENS.font.body, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: MS_TOKENS.color.ink500 },
};

// --- Card ---
const MSCard = ({ children, padding = 20, style, elevation = "xs", interactive, ...rest }) => (
  <div {...rest} style={{
    background: "white",
    borderRadius: MS_TOKENS.radius.lg,
    border: `1px solid ${MS_TOKENS.color.ink200}`,
    padding,
    fontFamily: MS_TOKENS.font.body,
    boxShadow: MS_TOKENS.shadow[elevation],
    transition: interactive ? `box-shadow ${MS_TOKENS.motion.base}, transform ${MS_TOKENS.motion.base}` : undefined,
    ...style,
  }}>{children}</div>
);

// --- Section header used inside cards ---
const MSSectionHeader = ({ title, subtitle, right, style }) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16, gap: 12, ...style }}>
    <div style={{ minWidth: 0 }}>
      <h3 style={{ margin: 0, ...MSText.h3 }}>{title}</h3>
      {subtitle && <div style={{ ...MSText.mute, marginTop: 2 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

// --- Button ---
const MSButton = ({ variant = "secondary", size = "md", leading, trailing, children, style, accent = MS_ACCENTS["brand-red"], ...rest }) => {
  const sizes = {
    sm: { padding: "6px 10px", fontSize: 12,   gap: 6, iconSize: 14 },
    md: { padding: "9px 14px", fontSize: 13.5, gap: 8, iconSize: 16 },
    lg: { padding: "12px 18px", fontSize: 14.5, gap: 8, iconSize: 18 },
  }[size];

  const variants = {
    primary: {
      background: accent.primary, color: "white", border: "1px solid transparent",
      boxShadow: `0 4px 10px -4px ${accent.primary}aa`,
    },
    secondary: {
      background: "white", color: MS_TOKENS.color.ink900,
      border: `1px solid ${MS_TOKENS.color.ink200}`,
      boxShadow: MS_TOKENS.shadow.xs,
    },
    ghost: {
      background: "transparent", color: MS_TOKENS.color.ink800, border: "1px solid transparent",
    },
    danger: {
      background: MS_TOKENS.color.danger, color: "white", border: "1px solid transparent",
    },
    icon: {
      background: MS_TOKENS.color.ink100, color: MS_TOKENS.color.ink800,
      border: "1px solid transparent", padding: 0,
      width: size === "sm" ? 28 : size === "lg" ? 40 : 34,
      height: size === "sm" ? 28 : size === "lg" ? 40 : 34,
    },
  }[variant];

  return (
    <button {...rest} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      gap: sizes.gap, borderRadius: MS_TOKENS.radius.md,
      fontFamily: MS_TOKENS.font.display, fontWeight: 600, letterSpacing: "-0.005em",
      cursor: "pointer", whiteSpace: "nowrap",
      transition: `background ${MS_TOKENS.motion.fast}, box-shadow ${MS_TOKENS.motion.fast}, transform ${MS_TOKENS.motion.fast}`,
      padding: variant === "icon" ? 0 : sizes.padding,
      fontSize: sizes.fontSize,
      ...variants,
      ...style,
    }}>
      {leading}
      {children}
      {trailing}
    </button>
  );
};

// --- Pill (badge) ---
const MSPill = ({ tone = "neutral", dot, children }) => {
  const tones = {
    neutral:  { bg: MS_TOKENS.color.ink100, fg: MS_TOKENS.color.ink800, dot: MS_TOKENS.color.ink600 },
    positive: { bg: MS_TOKENS.color.successSoft, fg: MS_TOKENS.color.successInk, dot: MS_TOKENS.color.success },
    warning:  { bg: MS_TOKENS.color.warnSoft, fg: MS_TOKENS.color.warnInk, dot: MS_TOKENS.color.warn },
    danger:   { bg: MS_TOKENS.color.dangerSoft, fg: MS_TOKENS.color.dangerInk, dot: MS_TOKENS.color.danger },
    info:     { bg: MS_TOKENS.color.infoSoft, fg: MS_TOKENS.color.infoInk, dot: MS_TOKENS.color.info },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: tones.bg, color: tones.fg,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: MS_TOKENS.radius.pill, fontFamily: MS_TOKENS.font.body,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: tones.dot }} />}
      {children}
    </span>
  );
};

// --- Avatar ---
const MSAvatar = ({ name, hue = 356, size = 36 }) => {
  const initials = (name || "?").split(" ").map(s => s[0]).slice(0, 2).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `linear-gradient(135deg, oklch(68% 0.14 ${hue}), oklch(52% 0.17 ${hue}))`,
      color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: MS_TOKENS.font.display, fontWeight: 700,
      fontSize: size * 0.38, letterSpacing: "-0.01em", flexShrink: 0,
      boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)"
    }}>{initials}</div>
  );
};

// --- Modal ---
// Standard pattern: backdrop + centered panel + header / body / footer slots.
// Props: open, onClose, title, description, size ("sm"|"md"|"lg"), tone ("default"|"danger"), children, footer
const MSModal = ({ open, onClose, title, description, size = "md", tone = "default", children, footer, hideClose }) => {
  const [mount, setMount] = React.useState(open);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) { setMount(true); requestAnimationFrame(() => setVisible(true)); }
    else { setVisible(false); const t = setTimeout(() => setMount(false), 200); return () => clearTimeout(t); }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!mount) return null;

  const widths = { sm: 400, md: 520, lg: 720 };
  const accent = tone === "danger" ? MS_TOKENS.color.danger : MS_ACCENTS["brand-red"].primary;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: MS_TOKENS.z.modal,
        background: visible ? "rgba(32,31,30,0.55)" : "rgba(32,31,30,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0)",
        display: "grid", placeItems: "center", padding: 24,
        transition: `background ${MS_TOKENS.motion.base}, backdrop-filter ${MS_TOKENS.motion.base}`,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, " + widths[size] + "px)",
          background: "white", borderRadius: MS_TOKENS.radius.xl,
          border: `1px solid ${MS_TOKENS.color.ink200}`,
          boxShadow: MS_TOKENS.shadow.lg,
          transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)",
          opacity: visible ? 1 : 0,
          transition: `transform ${MS_TOKENS.motion.base}, opacity ${MS_TOKENS.motion.base}`,
          maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
        {/* Accent rail */}
        <div style={{ height: 3, background: accent }} />

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", gap: 12,
          borderBottom: `1px solid ${MS_TOKENS.color.ink200}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...MSText.h3, fontSize: 17, marginBottom: description ? 4 : 0 }}>{title}</div>
            {description && <div style={{ ...MSText.mute, fontSize: 13 }}>{description}</div>}
          </div>
          {!hideClose && (
            <button onClick={onClose} aria-label="Close" style={{
              width: 32, height: 32, borderRadius: MS_TOKENS.radius.md,
              background: "transparent", color: MS_TOKENS.color.ink600,
              border: "none", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
            }}
              onMouseEnter={e => e.currentTarget.style.background = MS_TOKENS.color.ink100}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, ...MSText.body }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: "14px 24px", display: "flex", justifyContent: "flex-end", gap: 8,
            borderTop: `1px solid ${MS_TOKENS.color.ink200}`, background: MS_TOKENS.color.ink50,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Input ---
const MSInput = ({ leading, trailing, style, ...rest }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    background: "white", border: `1px solid ${MS_TOKENS.color.ink200}`,
    borderRadius: MS_TOKENS.radius.md, padding: "8px 12px",
    transition: `border-color ${MS_TOKENS.motion.fast}, box-shadow ${MS_TOKENS.motion.fast}`,
    ...style,
  }}>
    {leading}
    <input {...rest} style={{
      border: "none", outline: "none", background: "transparent",
      fontSize: 13.5, fontFamily: MS_TOKENS.font.body,
      flex: 1, color: MS_TOKENS.color.ink900,
    }}/>
    {trailing}
  </div>
);

// Expose globally so component files (and future pages) can import.
Object.assign(window, {
  MS_TOKENS, MS_ACCENTS,
  MSText, MSCard, MSSectionHeader, MSButton, MSPill, MSAvatar, MSModal, MSInput,
});
