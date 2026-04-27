// ============================================================
// Invoices — Shell (sidebar + topbar w/ Outbox/My-Invoices tabs
// + Staff/Client toggle for the admin Outbox view)
// ============================================================

const INV_TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "brand-red",
  "sidebarCollapsed": false,
  "tab": "outbox",
  "ledger": "client",
  "template": "modern",
  "paperEffect": true,
  "density": "comfortable",
  "showStamp": true,
  "listFirst": false,
  "agingMode": "bars"
}/*EDITMODE-END*/;

const I_NAV = [
  { group: "Overview", items: [
    ["dashboard","Dashboard","squares-2x2", "Dashboard.html"],
    ["shifts","Scheduling","calendar", "Scheduling.html"],
    ["attendance","Attendance","clock", "Attendance.html"],
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
    ["invoices","Invoices","receipt", null, true],
    ["payroll","Payroll","banknote", "Payroll.html"],
    ["integrations","Integrations","plug"],
  ]},
];

const ISidebar = ({ collapsed, onToggle, accent }) => {
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
        {I_NAV.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#a19f9d", padding: "10px 10px 6px" }}>{group.group}</div>
            )}
            {group.items.map(([id, label, icon, href, isActive]) => {
              const content = (
                <>
                  {isActive && <span style={{ position: "absolute", left: collapsed ? 4 : -4, top: 8, bottom: 8, width: 3, borderRadius: 2, background: accent.primary }} />}
                  <span style={{ color: isActive ? accent.primary : "#605e5c", display: "flex" }}>
                    <IIcon name={icon} size={18} />
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
// TOPBAR — breadcrumb, tabs, ledger toggle, actions
// ============================================================
const ITopbar = ({ accent, tab, setTab, ledger, setLedger, stats, onNew, onStatement }) => {
  const tabs = [
    ["outbox",     "Outbox",       "send",    stats.counts.draft + stats.counts.sent + stats.counts.overdue],
    ["my",         "My invoices",  "user",    null],
    ["archive",    "Archive",      "stack",   stats.counts.paid],
  ];

  return (
    <header style={{ background: "white", borderBottom: "1px solid #edebe9", position: "sticky", top: 0, zIndex: 10 }}>
      <div className="inv-topbar-row">
        <div className="inv-topbar-title">
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a19f9d", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <a href="Dashboard.html" style={{ color: "#a19f9d", textDecoration: "none" }}>Finance</a>
            <IIcon name="chevron-right" size={11} />
            <span style={{ color: "#605e5c" }}>Invoices</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
            <h1 style={{ margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#201f1e" }}>
              Invoices
            </h1>
            <span style={{ fontSize: 13, color: "#605e5c" }}>{TODAY_STR}</span>
            {stats.counts.overdue > 0 && tab === "outbox" && (
              <span className="inv-overdue-pill" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 999,
                background: "#fde7e9", color: "#8a1820",
                fontSize: 12, fontWeight: 700
              }}>
                <IIcon name="warning" size={12} />
                {stats.counts.overdue} overdue · {moneyShort(stats.totals.overdue)}
              </span>
            )}
          </div>
        </div>

        {/* Ledger toggle (Staff/Client) — only relevant in outbox & archive */}
        {tab !== "my" && (
          <div role="tablist" style={{
            display: "inline-flex", padding: 3, borderRadius: 999,
            background: "#f3f2f1", border: "1px solid #edebe9"
          }}>
            {[
              ["client", "Clients", "building"],
              ["staff",  "Staff",   "user"],
            ].map(([id, label, icon]) => {
              const active = ledger === id;
              return (
                <button key={id} onClick={() => setLedger(id)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 999,
                  background: active ? "white" : "transparent",
                  color: active ? accent.ink : "#605e5c",
                  border: "none", cursor: "pointer",
                  fontFamily: "Inter, sans-serif", fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  boxShadow: active ? "0 1px 3px rgba(32,31,30,0.08)" : "none",
                  transition: "all .15s"
                }}>
                  <IIcon name={icon} size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <button style={{
          width: 38, height: 38, borderRadius: 8, background: "#f3f2f1", border: "none",
          color: "#323130", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0
        }}>
          <IIcon name="bell" size={18} />
        </button>

        {tab === "outbox" && (
          <>
            <MSButton variant="secondary" leading={<IIcon name="mail" size={14} />} onClick={onStatement}>
              Send statement…
            </MSButton>
            <MSButton variant="primary" accent={accent} leading={<IIcon name="plus" size={14} />} onClick={onNew}>
              New invoice
            </MSButton>
          </>
        )}
        {tab === "my" && (
          <MSButton variant="secondary" leading={<IIcon name="download" size={14} />}>
            Download all
          </MSButton>
        )}
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 0, padding: "0 24px", borderTop: "1px solid #f3f2f1" }}>
        {tabs.map(([id, label, icon, count]) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "13px 4px", marginRight: 28, background: "transparent", border: "none",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              borderBottom: active ? `2px solid ${accent.primary}` : "2px solid transparent",
              color: active ? accent.ink : "#605e5c",
              fontFamily: "Inter, sans-serif", fontSize: 13.5,
              fontWeight: active ? 700 : 500, letterSpacing: "-0.005em",
              marginBottom: -1
            }}>
              <IIcon name={icon} size={15} />
              <span>{label}</span>
              {count != null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                  background: active ? accent.soft : "#f3f2f1",
                  color: active ? accent.ink : "#605e5c",
                  fontVariantNumeric: "tabular-nums"
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};

Object.assign(window, { INV_TWEAKS, ISidebar, ITopbar });
