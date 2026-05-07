// ============================================================
// Attendance — Shell (sidebar reused, topbar with tab nav)
// ============================================================

const ATT_TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "brand-red",
  "sidebarCollapsed": false,
  "view": "live",
  "density": "comfortable",
  "showPhotos": true,
  "groupBy": "venue",
  "hideApproved": false,
  "livePulse": true,
  "ribbonStyle": "river"
}/*EDITMODE-END*/;

const A_NAV = [
  { group: "Overview", items: [
    ["dashboard","Dashboard","squares-2x2", "Dashboard.html"],
    ["shifts","Scheduling","calendar", "Scheduling.html"],
    ["attendance","Attendance","clock", null, true],
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
    ["payroll","Payroll","banknote", "Payroll.html"],
    ["integrations","Integrations","plug"],
  ]},
];

// Reuses Sidebar pattern from scheduling but reads A_NAV.
const ASidebar = ({ collapsed, onToggle, accent }) => {
  const w = collapsed ? 76 : 244;
  return (
    <aside style={{
      width: w, flexShrink: 0, background: "white",
      borderRight: "1px solid #edebe9", height: "100vh",
      display: "flex", flexDirection: "column",
      position: "sticky", top: 0, transition: "width .25s ease", zIndex: 11
    }}>
      <div style={{
        padding: collapsed ? "22px 0" : "22px 20px", display: "flex", alignItems: "center",
        gap: 10, justifyContent: collapsed ? "center" : "flex-start", position: "relative"
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `linear-gradient(135deg, ${accent.primary}, ${accent.dark})`,
          display: "grid", placeItems: "center", boxShadow: `0 4px 10px -4px ${accent.primary}66`, flexShrink: 0
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

      <button onClick={onToggle} aria-label="Collapse" style={{
        position: "absolute", top: 28, right: -12, width: 24, height: 24, borderRadius: 12,
        background: "white", border: "1px solid #edebe9", color: "#605e5c", cursor: "pointer",
        display: "grid", placeItems: "center", boxShadow: "0 2px 6px -2px rgba(32,31,30,0.12)", zIndex: 12
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(0)" : "rotate(180deg)", transition: "transform .25s" }}>
          <path d="M9 6l6 6-6 6"/></svg>
      </button>

      <nav style={{ flex: 1, overflowY: "auto", padding: collapsed ? "4px 10px 16px" : "4px 12px 16px" }}>
        {A_NAV.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#a19f9d", padding: "10px 10px 6px" }}>{group.group}</div>
            )}
            {group.items.map(([id, label, icon, href, isActive]) => {
              const content = (
                <>
                  {isActive && <span style={{ position: "absolute", left: collapsed ? 4 : -4, top: 8, bottom: 8, width: 3, borderRadius: 2, background: accent.primary }} />}
                  <span style={{ color: isActive ? accent.primary : "#605e5c", display: "flex" }}>
                    <SIcon name={icon} size={18} />
                  </span>
                  {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
                </>
              );
              const style = {
                display: "flex", alignItems: "center", width: "100%", gap: 12,
                padding: collapsed ? "10px" : "9px 10px", borderRadius: 8,
                background: isActive ? accent.soft : "transparent",
                color: isActive ? accent.ink : "#323130",
                border: "none", cursor: "pointer", marginBottom: 2,
                fontFamily: "Inter, sans-serif", fontSize: 13.5, textDecoration: "none",
                fontWeight: isActive ? 600 : 500,
                justifyContent: collapsed ? "center" : "flex-start",
                position: "relative"
              };
              if (href) return <a key={id} href={href} title={collapsed ? label : undefined} style={style}>{content}</a>;
              return <button key={id} title={collapsed ? label : undefined} style={style}>{content}</button>;
            })}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: "1px solid #edebe9", padding: collapsed ? "12px" : "14px 12px", display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
        <MSAvatar name="Maya Chen" hue={210} size={34} />
        {!collapsed && (
          <div style={{ lineHeight: 1.15, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e", fontFamily: "Inter, sans-serif" }}>Maya Chen</div>
            <div style={{ fontSize: 11, color: "#a19f9d" }}>Operations Manager</div>
          </div>
        )}
      </div>
    </aside>
  );
};

// ============================================================
// TOPBAR with tabs + scope + actions
// ============================================================
const ATopbar = ({ accent, view, setView, livePulse, dateLabel }) => {
  const tabs = [
    ["live",        "Live operations", "clock",  ATT_STATS.on_duty],
    ["exceptions",  "Exceptions",      "alert",  ATT_STATS.exceptions],
    ["timesheets",  "Timesheets",      "file",   TIMESHEETS.filter(t=>t.status!=="approved").length],
  ];

  return (
    <header style={{ background: "white", borderBottom: "1px solid #edebe9", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px 12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a19f9d", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <a href="Dashboard.html" style={{ color: "#a19f9d", textDecoration: "none" }}>Operations</a>
            <SIcon name="chevron-right" size={11} />
            <span style={{ color: "#605e5c" }}>Attendance</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
            <h1 style={{ margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#201f1e" }}>
              Attendance
            </h1>
            <span style={{ fontSize: 13, color: "#605e5c" }}>{dateLabel}</span>
          </div>
        </div>

        {view === "live" && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "7px 12px", borderRadius: 999, background: "#e6f4ea", border: "1px solid #b8e0c2"
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: "#0f9d58",
              animation: livePulse ? "msPulse 1.4s ease-in-out infinite" : "none"
            }} />
            <span style={{ fontSize: 12.5, color: "#0f5132", fontWeight: 700, letterSpacing: "0.02em" }}>
              LIVE · {NOW_LABEL}
            </span>
          </div>
        )}

        <button style={{
          width: 38, height: 38, borderRadius: 8, background: "#f3f2f1", border: "none",
          color: "#323130", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, position: "relative"
        }}>
          <SIcon name="bell" size={18} />
          <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 4, background: accent.primary, border: "2px solid white" }} />
        </button>

        <MSButton variant="secondary" leading={<SIcon name="download" size={14} />}>Export</MSButton>
        <MSButton variant="primary" accent={accent} leading={<SIcon name="check" size={14} />}>
          Approve {TIMESHEETS.filter(t=>t.status==="ready").length} ready
        </MSButton>
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 0, padding: "0 24px", borderTop: "1px solid #f3f2f1" }}>
        {tabs.map(([id, label, icon, count]) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => setView(id)} style={{
              padding: "13px 4px", marginRight: 28, background: "transparent", border: "none",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              borderBottom: active ? `2px solid ${accent.primary}` : "2px solid transparent",
              color: active ? accent.ink : "#605e5c",
              fontFamily: "Inter, sans-serif", fontSize: 13.5,
              fontWeight: active ? 700 : 500, letterSpacing: "-0.005em",
              marginBottom: -1, position: "relative"
            }}>
              <SIcon name={icon} size={15} />
              <span>{label}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                background: active ? accent.soft : "#f3f2f1",
                color: active ? accent.ink : "#605e5c",
                fontVariantNumeric: "tabular-nums"
              }}>{count}</span>
            </button>
          );
        })}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, padding: "9px 0" }}>
          <MSInput leading={<SIcon name="search" size={14} stroke={2} />} placeholder="Search officer or venue…"
            style={{ width: 240, padding: "6px 10px", fontSize: 12.5 }} />
        </div>
      </div>
    </header>
  );
};

Object.assign(window, { ATT_TWEAKS, A_NAV, ASidebar, ATopbar });
