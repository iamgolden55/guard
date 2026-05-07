// ============================================================
// Mead Security — Payroll Page
// ============================================================

const { useState: uS, useMemo: uM, useEffect: uE } = React;

// Tweak defaults
const PAYROLL_TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "brand-red",
  "sidebarCollapsed": false,
  "density": "comfortable",
  "showExportStrip": true,
  "showRightRail": true
}/*EDITMODE-END*/;

const fmtGBP = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtGBPshort = (n) => "£" + Math.round(n).toLocaleString("en-GB");

// ============================================================
// SHELL — Sidebar (replicated from dashboard for consistency)
// ============================================================
const NAV = [
  { group: "Overview", items: [
    ["dashboard","Dashboard","squares-2x2", "Dashboard.html"],
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
    ["payroll","Payroll","banknote", null, true],
    ["integrations","Integrations","plug"],
  ]},
];

const Sidebar = ({ collapsed, onToggle, accent, active, setActive }) => {
  const w = collapsed ? 76 : 244;
  return (
    <aside style={{
      width: w, flexShrink: 0, background: "white",
      borderRight: "1px solid #edebe9", height: "100vh",
      display: "flex", flexDirection: "column",
      position: "sticky", top: 0, transition: "width .25s ease", zIndex: 11
    }}>
      <div style={{
        padding: collapsed ? "22px 0 22px" : "22px 20px", display: "flex", alignItems: "center",
        gap: 10, justifyContent: collapsed ? "center" : "flex-start", position: "relative"
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `linear-gradient(135deg, ${accent.primary} 0%, ${accent.dark} 100%)`,
          display: "grid", placeItems: "center", boxShadow: "0 4px 10px -4px " + accent.primary + "66", flexShrink: 0
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

      <button onClick={onToggle} aria-label={collapsed ? "Expand" : "Collapse"} style={{
        position: "absolute", top: 28, right: -12, width: 24, height: 24, borderRadius: 12,
        background: "white", border: "1px solid #edebe9", color: "#605e5c", cursor: "pointer",
        display: "grid", placeItems: "center", boxShadow: "0 2px 6px -2px rgba(32,31,30,0.12)",
        zIndex: 12, transition: "transform .2s, color .15s, background .15s"
      }}
        onMouseEnter={e => { e.currentTarget.style.color = accent.primary; e.currentTarget.style.background = accent.soft; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#605e5c"; e.currentTarget.style.background = "white"; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform .25s" }}>
          <path d="M9 6l6 6-6 6"/>
        </svg>
      </button>

      <nav style={{ flex: 1, overflowY: "auto", padding: collapsed ? "4px 10px 16px" : "4px 12px 16px" }}>
        {NAV.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#a19f9d", padding: "10px 10px 6px" }}>{group.group}</div>
            )}
            {group.items.map(([id, label, icon, href, forceActive]) => {
              const isActive = forceActive || active === id;
              const content = (
                <>
                  {isActive && <span style={{ position: "absolute", left: collapsed ? 4 : -4, top: 8, bottom: 8, width: 3, borderRadius: 2, background: accent.primary }} />}
                  <span style={{ color: isActive ? accent.primary : "#605e5c", display: "flex" }}>
                    <PIcon name={icon} size={18} />
                  </span>
                  {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
                </>
              );
              const commonStyle = {
                display: "flex", alignItems: "center", width: "100%", gap: 12,
                padding: collapsed ? "10px" : "9px 10px", borderRadius: 8,
                background: isActive ? accent.soft : "transparent",
                color: isActive ? accent.ink : "#323130",
                border: "none", cursor: "pointer", marginBottom: 2,
                fontFamily: "Inter, sans-serif", fontSize: 13.5, textDecoration: "none",
                fontWeight: isActive ? 600 : 500, letterSpacing: "-0.005em",
                justifyContent: collapsed ? "center" : "flex-start",
                position: "relative", transition: "background .15s", boxSizing: "border-box"
              };
              if (href) {
                return <a key={id} href={href} title={collapsed ? label : undefined} style={commonStyle}>{content}</a>;
              }
              return (
                <button key={id} onClick={() => setActive(id)} title={collapsed ? label : undefined} style={commonStyle}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#faf9f8"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: "1px solid #edebe9", padding: collapsed ? "12px" : "14px 12px", display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
        <MSAvatar name="Alex Mead" hue={356} size={34} />
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
const Topbar = ({ accent, onOpenExport }) => (
  <header className="payroll-topbar" style={{
    display: "flex", alignItems: "center", gap: 12,
    padding: "16px 28px", background: "white",
    borderBottom: "1px solid #edebe9",
    position: "sticky", top: 0, zIndex: 10,
    flexWrap: "wrap"
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a19f9d", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <a href="Dashboard.html" style={{ color: "#a19f9d", textDecoration: "none" }}>Finance</a>
        <PIcon name="chevron-right" size={11} />
        <span style={{ color: "#605e5c" }}>Payroll</span>
      </div>
      <h1 style={{ margin: "2px 0 0", fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#201f1e" }}>
        Payroll
      </h1>
    </div>

    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "#f3f2f1", borderRadius: 8, padding: "8px 12px",
      minWidth: 280, color: "#605e5c"
    }}>
      <PIcon name="search" size={16} />
      <input placeholder="Search officer, run, venue…" style={{
        border: "none", outline: "none", background: "transparent", fontSize: 13,
        fontFamily: "Inter, sans-serif", flex: 1, color: "#323130"
      }}/>
      <kbd style={{
        fontFamily: "SF Mono, monospace", fontSize: 10, color: "#605e5c",
        background: "white", border: "1px solid #edebe9", padding: "1px 5px", borderRadius: 4
      }}>⌘K</kbd>
    </div>

    <button style={{
      position: "relative", width: 38, height: 38, borderRadius: 8,
      background: "#f3f2f1", border: "none", color: "#323130",
      display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0
    }}>
      <PIcon name="bell" size={18} />
      <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 4, background: accent.primary, border: "2px solid white" }} />
    </button>

    <MSButton variant="secondary" leading={<PIcon name="file" size={14} />}>Download payslips</MSButton>
    <MSButton variant="primary" accent={accent} leading={<PIcon name="external" size={14} />} onClick={onOpenExport}>
      Export to Xero
    </MSButton>
  </header>
);

Object.assign(window, { Sidebar, Topbar, NAV, PAYROLL_TWEAKS, fmtGBP, fmtGBPshort });
