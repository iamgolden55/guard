const { useState, useEffect, useMemo, useRef } = React;

// ============================================================
// Mead Security — Admin Dashboard
// Uses design-system.jsx: MS_TOKENS, MS_ACCENTS, MSCard, MSButton,
// MSPill, MSAvatar, MSModal, MSInput, MSText, MSSectionHeader.
// ============================================================
// Bring design-system symbols into local scope for brevity
const T = window.MS_TOKENS;

// ---------- data ----------
const STAFF = [
  { id: 1, name: "James Okafor",   role: "Security Officer", venue: "Southbank Arena",     status: "on-shift",  license: "SIA-DS",  expiresIn: 124, hours: 38, rating: 4.8, avatarHue: 12 },
  { id: 2, name: "Priya Shah",     role: "Supervisor",       venue: "Westfield Stratford", status: "on-shift",  license: "SIA-DS",  expiresIn: 58,  hours: 42, rating: 4.9, avatarHue: 280 },
  { id: 3, name: "Marcus Bell",    role: "Control Room",     venue: "Canary Wharf Tower",  status: "break",     license: "SIA-CCTV", expiresIn: 9,   hours: 40, rating: 4.6, avatarHue: 160 },
  { id: 4, name: "Siobhan Clarke", role: "Security Officer", venue: "The O2",              status: "on-shift",  license: "SIA-DS",  expiresIn: 212, hours: 36, rating: 4.7, avatarHue: 32 },
  { id: 5, name: "Dmitri Novak",   role: "Security Officer", venue: "Kings Cross Station", status: "late",      license: "SIA-DS",  expiresIn: 90,  hours: 44, rating: 4.4, avatarHue: 200 },
  { id: 6, name: "Aisha Bello",    role: "Manager",          venue: "HQ — Operations",     status: "off-duty",  license: "SIA-SG",  expiresIn: 300, hours: 45, rating: 5.0, avatarHue: 340 },
  { id: 7, name: "Tom Reilly",     role: "Security Officer", venue: "Shoreditch Market",   status: "on-shift",  license: "SIA-DS",  expiresIn: 4,   hours: 32, rating: 4.3, avatarHue: 80 },
  { id: 8, name: "Elena Costa",    role: "Supervisor",       venue: "ExCeL London",        status: "on-shift",  license: "SIA-DS",  expiresIn: 175, hours: 41, rating: 4.8, avatarHue: 220 },
];

const VENUES = [
  { name: "Southbank Arena",     staffed: 14, required: 14, coverage: 100, incidents: 0 },
  { name: "Westfield Stratford", staffed: 22, required: 24, coverage: 92,  incidents: 1 },
  { name: "The O2",              staffed: 18, required: 20, coverage: 90,  incidents: 0 },
  { name: "Canary Wharf Tower",  staffed: 8,  required: 8,  coverage: 100, incidents: 0 },
  { name: "ExCeL London",        staffed: 26, required: 30, coverage: 87,  incidents: 2 },
  { name: "Kings Cross Station", staffed: 11, required: 14, coverage: 79,  incidents: 0 },
];

const APPROVALS = [
  { id: 1, type: "Shift swap",     who: "James Okafor → Tom Reilly",  when: "Thu 26 Apr, 22:00–06:00", venue: "Southbank Arena",     urgency: "high"   },
  { id: 2, type: "Overtime",       who: "Priya Shah",                  when: "+4h on Fri 27 Apr",       venue: "Westfield Stratford", urgency: "medium" },
  { id: 3, type: "Leave request",  who: "Siobhan Clarke",              when: "6–10 May",                venue: "The O2",              urgency: "low"    },
  { id: 4, type: "Expense claim",  who: "Dmitri Novak",                when: "£48.20 — Travel",         venue: "Kings Cross Station", urgency: "low"    },
];

const ACTIVITY = [
  { t: "2m",  kind: "check-in",   text: "Priya Shah checked in at Westfield Stratford" },
  { t: "7m",  kind: "incident",   text: "Minor incident logged — ExCeL London, zone B4" },
  { t: "14m", kind: "check-in",   text: "Elena Costa checked in at ExCeL London" },
  { t: "22m", kind: "approval",   text: "You approved 3 shift swaps for 26 Apr" },
  { t: "38m", kind: "license",    text: "SIA license for Marcus Bell expires in 9 days" },
  { t: "1h",  kind: "check-out",  text: "Siobhan Clarke checked out — 8h 12m logged" },
  { t: "2h",  kind: "invoice",    text: "Payroll run drafted for w/c 20 Apr — £84,210" },
];

// coverage heatmap — 7 days × 24 hours
const HEATMAP = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const base = Math.sin((h - 6) / 3.5) * 0.5 + 0.5;
    const dayWeight = d === 5 || d === 6 ? 1.15 : 1;
    const noise = (Math.sin(d * 7 + h * 2.3) + 1) / 2 * 0.25;
    return Math.max(0, Math.min(1, base * dayWeight + noise * 0.4 - 0.05));
  })
);
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// 14-day hours-delivered sparkline
const HOURS_SERIES = [312,298,340,355,301,412,448,388,360,395,420,465,478,502];

// ---------- tokens ----------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "accent": "brand-red",
  "layout": "bento",
  "sidebarCollapsed": false,
  "showSparklines": true
}/*EDITMODE-END*/;

const ACCENTS = {
  "brand-red":   { primary: "#cb2431", dark: "#991b25", soft: "#fde7e9", ink: "#5b0a10" },
  "deep-navy":   { primary: "#1e3a8a", dark: "#172554", soft: "#dbeafe", ink: "#0b1d47" },
  "forest":      { primary: "#15803d", dark: "#14532d", soft: "#dcfce7", ink: "#0a3d1f" },
  "graphite":    { primary: "#27272a", dark: "#09090b", soft: "#e4e4e7", ink: "#09090b" },
};

// ---------- small atoms ----------
const Avatar = ({ name, hue, size = 36 }) => {
  const initials = name.split(" ").map(s => s[0]).slice(0,2).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `linear-gradient(135deg, oklch(68% 0.14 ${hue}), oklch(52% 0.17 ${hue}))`,
      color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Plus Jakarta Sans, Inter, sans-serif", fontWeight: 700,
      fontSize: size * 0.38, letterSpacing: "-0.01em", flexShrink: 0,
      boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)"
    }}>{initials}</div>
  );
};

const Pill = ({ tone = "neutral", children, dot }) => {
  const tones = {
    neutral:  { bg: "#f3f2f1", fg: "#323130", dot: "#605e5c" },
    positive: { bg: "#e6f4ea", fg: "#0f5132", dot: "#0f9d58" },
    warning:  { bg: "#fff4e5", fg: "#7a4a00", dot: "#d97706" },
    danger:   { bg: "#fde7e9", fg: "#991b25", dot: "#cb2431" },
    info:     { bg: "#e7f0fa", fg: "#0b3a75", dot: "#2563eb" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: tones.bg, color: tones.fg,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 999, fontFamily: "Inter, sans-serif"
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: tones.dot }} />}
      {children}
    </span>
  );
};

const Spark = ({ data, color = "#cb2431", w = 120, h = 32 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polygon points={area} fill={color} fillOpacity="0.08" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length-1] - min) / (max - min || 1)) * (h - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
};

// ---------- status for staff ----------
const STATUS_TONES = {
  "on-shift": { tone: "positive", label: "On shift" },
  "break":    { tone: "info",     label: "On break" },
  "late":     { tone: "warning",  label: "Late"     },
  "off-duty": { tone: "neutral",  label: "Off duty" },
};

// ============================================================
// SIDEBAR
// ============================================================
const NAV = [
  { group: "Overview", items: [
    ["dashboard","Dashboard","squares-2x2", true],
    ["shifts","Scheduling","calendar"],
    ["attendance","Attendance","clock"],
  ]},
  { group: "People", items: [
    ["staff","Staff","users"],
    ["recruitment","Recruitment","user-plus"],
    ["leave","Leave","sun"],
  ]},
  { group: "Operations", items: [
    ["venues","Venues","map-pin"],
    ["compliance","Compliance","shield"],
    ["incidents","Incidents","alert"],
  ]},
  { group: "Finance", items: [
    ["invoices","Invoices","receipt"],
    ["payroll","Payroll","banknote"],
    ["integrations","Integrations","plug"],
  ]},
];

const Icon = ({ name, size = 18 }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    "squares-2x2": <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    "calendar":   <><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v4M16 3v4"/></>,
    "clock":      <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    "users":      <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><circle cx="17" cy="9" r="2.5"/><path d="M21.5 18.5c0-2.5-2-4.5-4.5-4.5"/></>,
    "user-plus":  <><circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M19 8v6M16 11h6"/></>,
    "sun":        <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    "map-pin":    <><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></>,
    "shield":     <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></>,
    "alert":      <><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/></>,
    "receipt":    <><path d="M5 3h14v18l-3-2-3 2-2-2-3 2-3-2V3z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    "banknote":   <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v.01M18 14v.01"/></>,
    "plug":       <><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8z"/><path d="M12 17v5"/></>,
    "bell":       <><path d="M6 10a6 6 0 0112 0v5l1.5 2H4.5L6 15v-5z"/><path d="M10 20a2 2 0 004 0"/></>,
    "search":     <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    "plus":       <><path d="M12 5v14M5 12h14"/></>,
    "download":   <><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></>,
    "chevron-right": <><path d="M9 6l6 6-6 6"/></>,
    "check":      <><path d="M5 12l4 4L19 7"/></>,
    "x":          <><path d="M6 6l12 12M18 6L6 18"/></>,
    "arrow-up":   <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    "arrow-down": <><path d="M12 5v14M19 12l-7 7-7-7"/></>,
    "filter":     <><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z"/></>,
    "more":       <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    "menu":       <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
};

const Sidebar = ({ collapsed, onToggle, accent, active, setActive }) => {
  const w = collapsed ? 76 : 244;
  return (
    <aside style={{
      width: w, flexShrink: 0, background: "white",
      borderRight: "1px solid #edebe9", height: "100vh",
      display: "flex", flexDirection: "column",
      position: "sticky", top: 0, transition: "width .25s ease",
      zIndex: 11
    }}>
      {/* Brand */}
      <div style={{
        padding: collapsed ? "22px 0 22px" : "22px 20px", display: "flex", alignItems: "center",
        gap: 10, justifyContent: collapsed ? "center" : "flex-start",
        position: "relative"
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `linear-gradient(135deg, ${accent.primary} 0%, ${accent.dark} 100%)`,
          display: "grid", placeItems: "center", boxShadow: "0 4px 10px -4px " + accent.primary + "66",
          flexShrink: 0
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/>
          </svg>
        </div>
        {!collapsed && (
          <div style={{ lineHeight: 1.1, flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em", color: "#201f1e" }}>Mead Security</div>
            <div style={{ fontSize: 11, color: "#a19f9d", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Operations</div>
          </div>
        )}
      </div>

      {/* Collapse toggle — floating button on the right edge */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          position: "absolute", top: 28, right: -12,
          width: 24, height: 24, borderRadius: 12,
          background: "white", border: "1px solid #edebe9",
          color: "#605e5c", cursor: "pointer",
          display: "grid", placeItems: "center",
          boxShadow: "0 2px 6px -2px rgba(32,31,30,0.12)",
          zIndex: 12, transition: "transform .2s, color .15s, background .15s"
        }}
        onMouseEnter={e => { e.currentTarget.style.color = accent.primary; e.currentTarget.style.background = accent.soft; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#605e5c"; e.currentTarget.style.background = "white"; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform .25s" }}>
          <path d="M9 6l6 6-6 6"/>
        </svg>
      </button>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: collapsed ? "4px 10px 16px" : "4px 12px 16px" }}>
        {NAV.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#a19f9d", padding: "10px 10px 6px" }}>{group.group}</div>
            )}
            {group.items.map(([id, label, icon]) => {
              const isActive = active === id;
              return (
                <button key={id} onClick={() => setActive(id)} title={collapsed ? label : undefined} style={{
                  display: "flex", alignItems: "center", width: "100%", gap: 12,
                  padding: collapsed ? "10px" : "9px 10px", borderRadius: 8,
                  background: isActive ? accent.soft : "transparent",
                  color: isActive ? accent.ink : "#323130",
                  border: "none", cursor: "pointer", marginBottom: 2,
                  fontFamily: "Inter, sans-serif", fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500, letterSpacing: "-0.005em",
                  justifyContent: collapsed ? "center" : "flex-start",
                  position: "relative", transition: "background .15s"
                }} onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#faf9f8"; }}
                   onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                  {isActive && (
                    <span style={{ position: "absolute", left: collapsed ? 4 : -4, top: 8, bottom: 8, width: 3, borderRadius: 2, background: accent.primary }} />
                  )}
                  <span style={{ color: isActive ? accent.primary : "#605e5c", display: "flex" }}>
                    <Icon name={icon} size={18} />
                  </span>
                  {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Current user */}
      <div style={{ borderTop: "1px solid #edebe9", padding: collapsed ? "12px" : "14px 12px", display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
        <Avatar name="You Admin" hue={356} size={34} />
        {!collapsed && (
          <div style={{ lineHeight: 1.15, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e", fontFamily: "Inter, sans-serif" }}>Alex Mead</div>
            <div style={{ fontSize: 11, color: "#a19f9d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Operations Director</div>
          </div>
        )}
      </div>
    </aside>
  );
};

// ============================================================
// TOPBAR
// ============================================================
const Topbar = ({ accent, onQuickAction }) => {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "16px 28px", background: "white",
      borderBottom: "1px solid #edebe9",
      position: "sticky", top: 0, zIndex: 10
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#a19f9d", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Dashboard · Admin</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#201f1e" }}>
          Good afternoon, Alex
        </h1>
      </div>

      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#f3f2f1", borderRadius: 8, padding: "8px 12px",
        minWidth: 280, color: "#605e5c"
      }}>
        <Icon name="search" size={16} />
        <input placeholder="Search staff, venues, shifts…" style={{
          border: "none", outline: "none", background: "transparent", fontSize: 13,
          fontFamily: "Inter, sans-serif", flex: 1, color: "#323130"
        }}/>
        <kbd style={{
          fontFamily: "SF Mono, monospace", fontSize: 10, color: "#605e5c",
          background: "white", border: "1px solid #edebe9", padding: "1px 5px",
          borderRadius: 4
        }}>⌘K</kbd>
      </div>

      {/* Notification */}
      <button style={iconButtonStyle}>
        <Icon name="bell" size={18} />
        <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 4, background: accent.primary, border: "2px solid white" }} />
      </button>

      {/* Primary CTA */}
      <button onClick={onQuickAction} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: accent.primary, color: "white",
        border: "none", padding: "9px 16px", borderRadius: 8,
        fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 600, fontSize: 13.5,
        cursor: "pointer", letterSpacing: "-0.005em",
        boxShadow: `0 6px 14px -6px ${accent.primary}aa`
      }}>
        <Icon name="plus" size={16} />
        New shift
      </button>
    </header>
  );
};

const iconButtonStyle = {
  position: "relative", width: 38, height: 38, borderRadius: 8,
  background: "#f3f2f1", border: "none", color: "#323130",
  display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0
};

// ============================================================
// KPI CARDS
// ============================================================
const KPI = ({ label, value, delta, deltaDir, sparkData, accent, showSpark }) => {
  const up = deltaDir === "up";
  const neutral = !deltaDir;
  return (
    <div style={cardStyle({ padding: 20 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: "#605e5c", fontWeight: 500, fontFamily: "Inter, sans-serif" }}>{label}</div>
        {delta && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11.5, fontWeight: 700,
            color: neutral ? "#605e5c" : up ? "#0f9d58" : "#cb2431",
            background: neutral ? "#f3f2f1" : up ? "#e6f4ea" : "#fde7e9",
            padding: "2px 7px", borderRadius: 999
          }}>
            {!neutral && <Icon name={up ? "arrow-up" : "arrow-down"} size={10} />}
            {delta}
          </span>
        )}
      </div>
      <div style={{
        fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700,
        fontSize: 30, letterSpacing: "-0.03em", color: "#201f1e", lineHeight: 1
      }}>{value}</div>
      {showSpark && sparkData && (
        <div style={{ marginTop: 12 }}>
          <Spark data={sparkData} color={accent.primary} w={200} h={36} />
        </div>
      )}
    </div>
  );
};

const cardStyle = ({ padding = 20 } = {}) => ({
  background: "white",
  borderRadius: 12,
  border: "1px solid #edebe9",
  padding,
  fontFamily: "Inter, sans-serif"
});

const sectionTitle = (title, subtitle, right) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
    <div>
      <h3 style={{ margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "-0.015em", color: "#201f1e" }}>{title}</h3>
      {subtitle && <div style={{ fontSize: 12.5, color: "#a19f9d", marginTop: 2 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

// ============================================================
// COVERAGE HEATMAP
// ============================================================
const Heatmap = ({ accent }) => {
  const [hover, setHover] = useState(null);
  const cell = 14, gap = 3;
  const colorFor = (v) => {
    // interpolate between pale and accent
    const a = parseInt(accent.primary.slice(1,3),16);
    const b = parseInt(accent.primary.slice(3,5),16);
    const c = parseInt(accent.primary.slice(5,7),16);
    const alpha = 0.08 + v * 0.85;
    return `rgba(${a},${b},${c},${alpha.toFixed(2)})`;
  };
  return (
    <div style={cardStyle({ padding: 20 })}>
      {sectionTitle("Coverage by day × hour", "Last 7 days · staffed vs required",
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#605e5c" }}>
          <span>Low</span>
          {[0.1,0.3,0.55,0.8,1].map(v => <span key={v} style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(v) }} />)}
          <span>High</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap, paddingTop: 22 }}>
          {DAYS.map(d => <div key={d} style={{ height: cell, fontSize: 10.5, color: "#a19f9d", fontWeight: 600, lineHeight: `${cell}px` }}>{d}</div>)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(24, 1fr)`, gap, marginBottom: 4 }}>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} style={{ fontSize: 9, color: "#a19f9d", textAlign: "center", fontFamily: "SF Mono, monospace", height: 14 }}>
                {h % 3 === 0 ? String(h).padStart(2,"0") : ""}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap, gridTemplateRows: `repeat(7, ${cell}px)` }}>
            {HEATMAP.map((row, d) => (
              <div key={d} style={{ display: "grid", gridTemplateColumns: `repeat(24, 1fr)`, gap }}>
                {row.map((v, h) => (
                  <div
                    key={h}
                    onMouseEnter={() => setHover({ d, h, v })}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      height: cell, borderRadius: 3, background: colorFor(v),
                      cursor: "pointer",
                      outline: hover && hover.d === d && hover.h === h ? `2px solid ${accent.primary}` : "none",
                      outlineOffset: 1
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 14, fontSize: 12, color: "#605e5c",
        minHeight: 18, fontVariantNumeric: "tabular-nums"
      }}>
        {hover
          ? <><strong style={{ color: "#201f1e" }}>{DAYS[hover.d]} · {String(hover.h).padStart(2,"0")}:00</strong> — coverage {Math.round(hover.v * 100)}%</>
          : <span>Hover a cell to inspect coverage</span>}
      </div>
    </div>
  );
};

// ============================================================
// VENUE LIST
// ============================================================
const VenueList = ({ accent }) => {
  return (
    <div style={cardStyle({ padding: 20 })}>
      {sectionTitle("Venue coverage", "Live staffing vs contracted requirement",
        <button style={linkButtonStyle(accent)}>View all <Icon name="chevron-right" size={12} /></button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {VENUES.map(v => {
          const under = v.staffed < v.required;
          const pct = v.coverage;
          return (
            <div key={v.name} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16,
              alignItems: "center", padding: "10px 4px",
              borderBottom: "1px solid #f3f2f1"
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                  {v.incidents > 0 && <Pill tone="warning" dot>{v.incidents} incident{v.incidents > 1 ? "s" : ""}</Pill>}
                </div>
                <div style={{ fontSize: 11.5, color: "#a19f9d", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {v.staffed} / {v.required} officers deployed
                </div>
              </div>
              <div style={{ width: 120 }}>
                <div style={{ height: 6, background: "#f3f2f1", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: under ? "linear-gradient(90deg,#f59e0b,#d97706)" : `linear-gradient(90deg, ${accent.primary}, ${accent.dark})`,
                    transition: "width .4s"
                  }} />
                </div>
              </div>
              <div style={{
                fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 14,
                color: under ? "#d97706" : "#0f9d58", width: 44, textAlign: "right"
              }}>{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const linkButtonStyle = (accent) => ({
  display: "inline-flex", alignItems: "center", gap: 4,
  background: "transparent", border: "none",
  color: accent.primary, fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 12.5,
  cursor: "pointer", padding: 0
});

// ============================================================
// APPROVALS QUEUE
// ============================================================
const Approvals = ({ accent }) => {
  const [items, setItems] = useState(APPROVALS);
  const act = (id, verb) => setItems(s => s.filter(x => x.id !== id));
  return (
    <div style={cardStyle({ padding: 20 })}>
      {sectionTitle(<span>Approvals <span style={{ color: "#a19f9d", fontWeight: 500 }}>· {items.length}</span></span>, "Awaiting your review",
        <button style={linkButtonStyle(accent)}>Inbox <Icon name="chevron-right" size={12} /></button>
      )}
      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#a19f9d", fontSize: 13 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
          All clear
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(a => {
          const tone = a.urgency === "high" ? "danger" : a.urgency === "medium" ? "warning" : "info";
          return (
            <div key={a.id} style={{
              display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
              padding: 12, borderRadius: 10, background: "#faf9f8",
              border: "1px solid #f3f2f1"
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Pill tone={tone}>{a.type}</Pill>
                  <span style={{ fontSize: 11.5, color: "#a19f9d" }}>{a.venue}</span>
                </div>
                <div style={{ fontSize: 13, color: "#201f1e", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.who}</div>
                <div style={{ fontSize: 12, color: "#605e5c", marginTop: 2 }}>{a.when}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => act(a.id, "deny")} style={actionBtnStyle(false, accent)} title="Decline">
                  <Icon name="x" size={14} />
                </button>
                <button onClick={() => act(a.id, "approve")} style={actionBtnStyle(true, accent)} title="Approve">
                  <Icon name="check" size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const actionBtnStyle = (primary, accent) => ({
  width: 30, height: 30, borderRadius: 8,
  border: primary ? "none" : "1px solid #edebe9",
  background: primary ? accent.primary : "white",
  color: primary ? "white" : "#605e5c",
  cursor: "pointer", display: "grid", placeItems: "center"
});

// ============================================================
// STAFF TABLE
// ============================================================
const StaffTable = ({ accent }) => {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return STAFF;
    if (filter === "active") return STAFF.filter(s => s.status === "on-shift" || s.status === "break");
    if (filter === "attention") return STAFF.filter(s => s.status === "late" || s.expiresIn < 30);
    return STAFF;
  }, [filter]);

  const tabs = [
    ["all", "All staff", STAFF.length],
    ["active", "On duty", STAFF.filter(s => s.status === "on-shift" || s.status === "break").length],
    ["attention", "Needs attention", STAFF.filter(s => s.status === "late" || s.expiresIn < 30).length],
  ];

  return (
    <div style={cardStyle({ padding: 0 })}>
      <div style={{ padding: "20px 20px 0" }}>
        {sectionTitle("Staff roster", "SIA-licensed personnel currently in the system",
          <div style={{ display: "flex", gap: 8 }}>
            <button style={ghostBtnStyle}><Icon name="filter" size={14} /> Filters</button>
            <button style={ghostBtnStyle}><Icon name="download" size={14} /> Export</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "0 20px", borderBottom: "1px solid #edebe9" }}>
        {tabs.map(([k, label, count]) => {
          const active = filter === k;
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: "10px 4px", marginRight: 18,
              fontFamily: "Inter, sans-serif", fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? accent.primary : "#605e5c",
              borderBottom: active ? `2px solid ${accent.primary}` : "2px solid transparent",
              marginBottom: -1
            }}>
              {label}
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 600,
                color: active ? accent.primary : "#a19f9d",
                background: active ? accent.soft : "#f3f2f1",
                padding: "1px 7px", borderRadius: 999
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr style={{ background: "#faf9f8" }}>
              {["Officer","Role","Assignment","Status","SIA License","Hours wk","Rating",""].map((h, i) => (
                <th key={i} style={{
                  textAlign: i === 6 || i === 5 ? "right" : "left",
                  padding: "10px 16px", fontSize: 10.5, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase", color: "#605e5c",
                  borderBottom: "1px solid #edebe9", whiteSpace: "nowrap"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const st = STATUS_TONES[s.status];
              const licTone = s.expiresIn < 14 ? "danger" : s.expiresIn < 60 ? "warning" : "neutral";
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid #f3f2f1", transition: "background .1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#faf9f8"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={s.name} hue={s.avatarHue} size={32} />
                      <div style={{ fontWeight: 600, color: "#201f1e", fontSize: 13.5 }}>{s.name}</div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: "#323130" }}>{s.role}</td>
                  <td style={{ ...tdStyle, color: "#605e5c" }}>{s.venue}</td>
                  <td style={tdStyle}><Pill tone={st.tone} dot>{st.label}</Pill></td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#323130" }}>{s.license}</span>
                      <Pill tone={licTone}>
                        {s.expiresIn < 14 ? `${s.expiresIn}d left` : s.expiresIn < 60 ? `${s.expiresIn}d` : "Valid"}
                      </Pill>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#201f1e" }}>{s.hours}h</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: accent.primary, fontSize: 13 }}>★</span>
                      <span style={{ fontWeight: 600, color: "#201f1e", fontSize: 13 }}>{s.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button style={{ ...ghostBtnStyle, padding: "5px 8px" }}><Icon name="more" size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const tdStyle = { padding: "12px 16px", fontSize: 13, color: "#323130" };
const ghostBtnStyle = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "white", border: "1px solid #edebe9",
  padding: "6px 12px", borderRadius: 7,
  fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500,
  color: "#323130", cursor: "pointer"
};

// ============================================================
// ACTIVITY FEED
// ============================================================
const ACTIVITY_COLORS = {
  "check-in":  { c: "#0f9d58", icon: "check" },
  "check-out": { c: "#605e5c", icon: "arrow-down" },
  "incident":  { c: "#cb2431", icon: "alert" },
  "approval":  { c: "#2563eb", icon: "check" },
  "license":   { c: "#d97706", icon: "shield" },
  "invoice":   { c: "#8764b8", icon: "receipt" },
};

const ActivityFeed = ({ accent }) => (
  <div style={cardStyle({ padding: 20 })}>
    {sectionTitle("Live activity", "Cross-venue stream",
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#0f9d58", fontWeight: 600 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: "#0f9d58", boxShadow: "0 0 0 0 #0f9d58", animation: "pulse 1.8s infinite" }} />
        Live
      </span>
    )}
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 1, background: "#edebe9" }} />
      {ACTIVITY.map((a, i) => {
        const meta = ACTIVITY_COLORS[a.kind] || ACTIVITY_COLORS["check-in"];
        return (
          <div key={i} style={{ display: "flex", gap: 14, padding: "8px 0", position: "relative" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16, flexShrink: 0,
              background: "white", border: `1.5px solid ${meta.c}33`,
              color: meta.c, display: "grid", placeItems: "center", zIndex: 1
            }}>
              <Icon name={meta.icon} size={13} />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
              <div style={{ fontSize: 13, color: "#201f1e", fontWeight: 500 }}>{a.text}</div>
              <div style={{ fontSize: 11.5, color: "#a19f9d", marginTop: 2 }}>{a.t} ago</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ============================================================
// COMPLIANCE TILE
// ============================================================
const Compliance = ({ accent }) => {
  const expiringSoon = STAFF.filter(s => s.expiresIn < 60).sort((a,b) => a.expiresIn - b.expiresIn);
  const total = STAFF.length;
  const valid = STAFF.filter(s => s.expiresIn >= 60).length;
  const pct = Math.round((valid / total) * 100);
  return (
    <div style={cardStyle({ padding: 20 })}>
      {sectionTitle("SIA compliance", `${valid} of ${total} officers in good standing`)}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* Ring */}
        <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f3f2f1" strokeWidth="10" />
            <circle
              cx="48" cy="48" r="40" fill="none" stroke={accent.primary} strokeWidth="10"
              strokeDasharray={`${(pct / 100) * 251.3} 251.3`}
              strokeDashoffset="0" strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "grid", placeItems: "center",
            fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 22,
            color: "#201f1e", letterSpacing: "-0.02em"
          }}>{pct}%</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#605e5c", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Expiring soon</div>
          {expiringSoon.slice(0, 3).map(s => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
              borderBottom: "1px dashed #f3f2f1"
            }}>
              <Avatar name={s.name} hue={s.avatarHue} size={22} />
              <div style={{ flex: 1, fontSize: 12.5, color: "#201f1e", fontWeight: 500, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
              <Pill tone={s.expiresIn < 14 ? "danger" : "warning"}>{s.expiresIn}d</Pill>
            </div>
          ))}
          {expiringSoon.length === 0 && <div style={{ fontSize: 12.5, color: "#a19f9d" }}>No expirations in the next 60 days</div>}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// DASHBOARD LAYOUT
// ============================================================
// ============================================================
// WELCOME BANNER
// ============================================================
const WelcomeBanner = ({ accent, onSchedule, onManage }) => {
  const now = new Date();
  const hours = now.getHours();
  const greeting = hours < 12 ? "Good morning" : hours < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{
      position: "relative",
      background: "white",
      border: "1px solid #edebe9",
      borderRadius: 14,
      padding: "26px 28px",
      overflow: "hidden",
      display: "grid",
      gridTemplateColumns: "1fr 360px",
      gap: 24,
      alignItems: "center",
      minHeight: 180,
    }}>
      {/* Subtle decorative accent */}
      <div style={{
        position: "absolute", top: -80, left: -80, width: 260, height: 260,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${accent.soft} 0%, transparent 70%)`,
        pointerEvents: "none", opacity: 0.8,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent.primary}, ${accent.dark})`,
        opacity: 0.9
      }} />

      {/* LEFT — copy + CTAs */}
      <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "4px 10px", borderRadius: 999, background: accent.soft, color: accent.ink, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: accent.primary, animation: "pulse 1.8s infinite" }} />
          {dateStr}
        </div>
        <h2 style={{
          margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif",
          fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em",
          color: "#201f1e", lineHeight: 1.15
        }}>
          {greeting}, Alex.
        </h2>
        <p style={{
          margin: "8px 0 18px", fontSize: 14, color: "#605e5c",
          maxWidth: 520, lineHeight: 1.55
        }}>
          You have <strong style={{ color: "#201f1e" }}>14 approvals</strong> awaiting review and <strong style={{ color: accent.primary }}>3 officers</strong> with SIA licences expiring this month. Everything else is on track.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onSchedule} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#201f1e", color: "white", border: "none",
            padding: "11px 18px", borderRadius: 9,
            fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 600, fontSize: 13.5,
            cursor: "pointer", letterSpacing: "-0.005em",
            boxShadow: "0 6px 14px -6px rgba(32,31,30,0.4)"
          }}>
            <Icon name="calendar" size={15} /> View schedule
          </button>
          <button onClick={onManage} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "white", color: "#201f1e",
            border: "1px solid #edebe9",
            padding: "11px 18px", borderRadius: 9,
            fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 600, fontSize: 13.5,
            cursor: "pointer", letterSpacing: "-0.005em"
          }}>
            <Icon name="users" size={15} /> Manage staff
          </button>
        </div>
      </div>

      {/* RIGHT — live snapshot cards */}
      <div style={{ position: "relative", height: 170, display: "none" }} className="banner-visual" />
      <div style={{ position: "relative", height: 170 }}>
        <BannerVisual accent={accent} />
      </div>
    </div>
  );
};

// Visual composition — three overlapping "live" cards
const BannerVisual = ({ accent }) => {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Card 3 — back */}
      <div style={{
        position: "absolute", right: 150, top: 18, width: 150, height: 132,
        background: "linear-gradient(165deg, #fef3f4 0%, #fde7e9 100%)",
        borderRadius: 12, border: "1px solid #fbd0d4",
        padding: 12, transform: "rotate(-6deg)",
        boxShadow: "0 8px 20px -10px rgba(203,36,49,0.25)",
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: accent.ink, letterSpacing: "0.08em", textTransform: "uppercase" }}>This Week</div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 4 }}>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 26, color: "#201f1e", letterSpacing: "-0.02em" }}>4,218</div>
        </div>
        <div style={{ fontSize: 10.5, color: "#605e5c", marginTop: 2 }}>hours delivered</div>
        <div style={{ marginTop: 10 }}>
          <Spark data={[40,45,42,58,52,62,68]} color={accent.primary} w={120} h={28} />
        </div>
      </div>

      {/* Card 2 — middle */}
      <div style={{
        position: "absolute", right: 80, top: 6, width: 156, height: 150,
        background: "white", borderRadius: 12, border: "1px solid #edebe9",
        padding: 14, transform: "rotate(-2deg)",
        boxShadow: "0 10px 24px -12px rgba(32,31,30,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "#0f9d58" }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0f5132", letterSpacing: "0.06em", textTransform: "uppercase" }}>Live</div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 24, color: "#201f1e", letterSpacing: "-0.02em" }}>127</div>
          <div style={{ fontSize: 10.5, color: "#605e5c" }}>officers on shift</div>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: -6 }}>
          {[
            { h: 12, n: "JO" }, { h: 280, n: "PS" }, { h: 160, n: "MB" }, { h: 32, n: "SC" },
          ].map((a, i) => (
            <div key={i} style={{
              width: 22, height: 22, borderRadius: 11,
              background: `linear-gradient(135deg, oklch(68% 0.14 ${a.h}), oklch(52% 0.17 ${a.h}))`,
              color: "white", display: "grid", placeItems: "center",
              fontSize: 9, fontWeight: 700, fontFamily: "Plus Jakarta Sans, sans-serif",
              border: "2px solid white", marginLeft: i === 0 ? 0 : -6,
              boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.1)"
            }}>{a.n}</div>
          ))}
          <div style={{
            width: 22, height: 22, borderRadius: 11, background: "#f3f2f1",
            color: "#605e5c", display: "grid", placeItems: "center",
            fontSize: 9, fontWeight: 700, border: "2px solid white", marginLeft: -6
          }}>+8</div>
        </div>
      </div>

      {/* Card 1 — front */}
      <div style={{
        position: "absolute", right: 0, top: 20, width: 172, height: 148,
        background: "white", borderRadius: 12,
        border: "1px solid #edebe9",
        padding: 0, transform: "rotate(3deg)",
        boxShadow: "0 14px 32px -14px rgba(32,31,30,0.22)",
        overflow: "hidden",
      }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${accent.primary}, ${accent.dark})` }} />
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#201f1e" }}>Mead Security Ltd</div>
          <div style={{ fontSize: 9.5, color: "#a19f9d", marginTop: 2 }}>Weekly payroll · w/c 20 Apr</div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
              <span style={{ color: "#605e5c" }}>Night Patrol</span>
              <span style={{ color: "#201f1e", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>£14,400</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
              <span style={{ color: "#605e5c" }}>Venue Cover</span>
              <span style={{ color: "#201f1e", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>£42,810</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
              <span style={{ color: "#605e5c" }}>Control Room</span>
              <span style={{ color: "#201f1e", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>£27,000</span>
            </div>
          </div>
          <div style={{
            marginTop: 10, paddingTop: 8, borderTop: "1px dashed #edebe9",
            display: "flex", justifyContent: "space-between", alignItems: "baseline"
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#201f1e", letterSpacing: "0.05em", textTransform: "uppercase" }}>Total</span>
            <span style={{
              fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 15,
              color: accent.primary, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums"
            }}>£84,210</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ tweaks, setTweaks }) => {
  const accent = ACCENTS[tweaks.accent] || ACCENTS["brand-red"];
  const [active, setActive] = useState("dashboard");
  const [newShiftOpen, setNewShiftOpen] = useState(false);
  const collapsed = tweaks.sidebarCollapsed;
  const toggleCollapse = () => setTweaks('sidebarCollapsed', !collapsed);

  const density = tweaks.density;
  const gap = density === "compact" ? 14 : density === "spacious" ? 24 : 18;

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: "#faf9f8",
      fontFamily: "Inter, sans-serif", color: "#201f1e"
    }}>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapse} accent={accent} active={active} setActive={setActive} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar accent={accent} onQuickAction={() => setNewShiftOpen(true)} />
        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap }}>
          {/* Welcome banner */}
          <WelcomeBanner
            accent={accent}
            onSchedule={() => setActive("schedule")}
            onManage={() => setActive("staff")}
          />
          {/* KPIs */}
          <div style={{ display: "grid", gap, gridTemplateColumns: "repeat(4, 1fr)" }}>
            <KPI label="Officers on shift" value="127" delta="+12"  deltaDir="up"   sparkData={HOURS_SERIES} accent={accent} showSpark={tweaks.showSparklines}/>
            <KPI label="Hours delivered today" value="1,084" delta="+4.2%" deltaDir="up"   sparkData={HOURS_SERIES.slice(2)} accent={accent} showSpark={tweaks.showSparklines}/>
            <KPI label="Open approvals"     value="14"  delta="3 urgent" accent={accent} showSpark={tweaks.showSparklines} sparkData={[4,6,9,8,11,13,14]} />
            <KPI label="Revenue this wk"    value="£84,210" delta="-1.8%" deltaDir="down" sparkData={[84,79,82,88,79,82,84]} accent={accent} showSpark={tweaks.showSparklines}/>
          </div>

          {tweaks.layout === "bento" ? (
            <>
              <div style={{ display: "grid", gap, gridTemplateColumns: "2fr 1fr" }}>
                <Heatmap accent={accent} />
                <Approvals accent={accent} />
              </div>

              <div style={{ display: "grid", gap, gridTemplateColumns: "1.2fr 1fr 1fr" }}>
                <VenueList accent={accent} />
                <Compliance accent={accent} />
                <ActivityFeed accent={accent} />
              </div>

              <StaffTable accent={accent} />
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap, gridTemplateColumns: "1fr" }}>
                <Heatmap accent={accent} />
              </div>
              <div style={{ display: "grid", gap, gridTemplateColumns: "1fr 1fr" }}>
                <Approvals accent={accent} />
                <Compliance accent={accent} />
              </div>
              <div style={{ display: "grid", gap, gridTemplateColumns: "1fr 1fr" }}>
                <VenueList accent={accent} />
                <ActivityFeed accent={accent} />
              </div>
              <StaffTable accent={accent} />
            </>
          )}

          <div style={{ textAlign: "center", fontSize: 11, color: "#a19f9d", padding: "20px 0 8px" }}>
            © Mead Security · Operations Console · v2.4
          </div>
        </main>
      </div>

      {/* Modal — design-system MSModal */}
      <window.MSModal
        open={newShiftOpen}
        onClose={() => setNewShiftOpen(false)}
        title="Schedule new shift"
        description="Assign an officer to a venue and time window."
        size="md"
        footer={(
          <>
            <window.MSButton variant="ghost" onClick={() => setNewShiftOpen(false)}>Cancel</window.MSButton>
            <window.MSButton variant="primary" accent={accent} onClick={() => setNewShiftOpen(false)}>Create shift</window.MSButton>
          </>
        )}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ ...window.MSText.label, marginBottom: 6 }}>Venue</div>
            <window.MSInput placeholder="Select a venue…" defaultValue="Southbank Arena" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ ...window.MSText.label, marginBottom: 6 }}>Start</div>
              <window.MSInput type="datetime-local" defaultValue="2026-04-26T22:00" />
            </div>
            <div>
              <div style={{ ...window.MSText.label, marginBottom: 6 }}>End</div>
              <window.MSInput type="datetime-local" defaultValue="2026-04-27T06:00" />
            </div>
          </div>
          <div>
            <div style={{ ...window.MSText.label, marginBottom: 6 }}>Officer</div>
            <window.MSInput placeholder="Search staff…" defaultValue="James Okafor" />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, background: "#faf9f8", borderRadius: 8, border: "1px solid #edebe9" }}>
            <window.MSPill tone="info" dot>Tip</window.MSPill>
            <span style={{ fontSize: 12.5, color: "#605e5c" }}>SIA licences are verified automatically before confirmation.</span>
          </div>
        </div>
      </window.MSModal>
    </div>
  );
};

// ============================================================
// ROOT
// ============================================================
const Root = () => {
  const [tweaks, setTweaks] = useTweaks(TWEAK_DEFAULTS);
  return (
    <>
      <Dashboard tweaks={tweaks} setTweaks={setTweaks} />
      <TweaksPanel title="Tweaks">
        <TweakSection title="Layout">
          <TweakToggle label="Collapse sidebar" value={tweaks.sidebarCollapsed}
            onChange={v => setTweaks('sidebarCollapsed', v)} />
          <TweakRadio label="Grid" value={tweaks.layout}
            onChange={v => setTweaks('layout', v)}
            options={[["bento","Bento"],["stacked","Stacked"]]} />
          <TweakRadio label="Density" value={tweaks.density}
            onChange={v => setTweaks('density', v)}
            options={[["compact","Compact"],["comfortable","Comfortable"],["spacious","Spacious"]]} />
        </TweakSection>
        <TweakSection title="Theme">
          <TweakRadio label="Accent" value={tweaks.accent}
            onChange={v => setTweaks('accent', v)}
            options={[["brand-red","Brand red"],["deep-navy","Navy"],["forest","Forest"],["graphite","Graphite"]]} />
          <TweakToggle label="Sparklines on KPIs" value={tweaks.showSparklines}
            onChange={v => setTweaks('showSparklines', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
