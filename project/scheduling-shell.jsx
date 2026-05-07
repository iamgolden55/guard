// ============================================================
// Scheduling — Shell (sidebar + topbar + week strip)
// ============================================================

const SCHED_TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "brand-red",
  "sidebarCollapsed": false,
  "viewMode": "day",
  "canvasAxis": "venue",
  "peoplePanel": "expanded",
  "density": "comfortable",
  "colorBy": "venue"
}/*EDITMODE-END*/;

// ---------- NAV ----------
const NAV = [
  { group: "Overview", items: [
    ["dashboard","Dashboard","squares-2x2", "Dashboard.html"],
    ["shifts","Scheduling","calendar", null, true],
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
    ["payroll","Payroll","banknote", "Payroll.html"],
    ["integrations","Integrations","plug"],
  ]},
];

// ============================================================
// SIDEBAR (same as payroll)
// ============================================================
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
        zIndex: 12
      }}>
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
                    <SIcon name={icon} size={18} />
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
const Topbar = ({ accent, onPublish, onNewShift, draftCount, hardCount }) => (
  <header style={{
    display: "flex", alignItems: "center", gap: 12,
    padding: "14px 24px", background: "white",
    borderBottom: "1px solid #edebe9",
    position: "sticky", top: 0, zIndex: 10
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a19f9d", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <a href="Dashboard.html" style={{ color: "#a19f9d", textDecoration: "none" }}>Operations</a>
        <SIcon name="chevron-right" size={11} />
        <span style={{ color: "#605e5c" }}>Scheduling</span>
      </div>
      <h1 style={{ margin: "2px 0 0", fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#201f1e" }}>
        Scheduling
      </h1>
    </div>

    {draftCount > 0 && (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "7px 12px", borderRadius: 8, background: "#fff4e5", border: "1px solid #fad48a"
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: "#d97706", animation: "msPulse 1.6s ease-in-out infinite" }} />
        <span style={{ fontSize: 12.5, color: "#7a4a00", fontWeight: 600 }}>
          {draftCount} draft{draftCount === 1 ? "" : "s"} not yet visible to officers
        </span>
      </div>
    )}

    <button style={{
      position: "relative", width: 38, height: 38, borderRadius: 8,
      background: "#f3f2f1", border: "none", color: "#323130",
      display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0
    }}>
      <SIcon name="bell" size={18} />
      <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 4, background: accent.primary, border: "2px solid white" }} />
    </button>

    <MSButton variant="secondary" leading={<SIcon name="copy" size={14} />}>Copy last week</MSButton>
    <MSButton variant="secondary" leading={<SIcon name="plus" size={14} />} onClick={onNewShift}>New shift</MSButton>
    <MSButton variant="primary" accent={accent} leading={<SIcon name="send" size={14} />} onClick={onPublish}
      disabled={hardCount > 0}>
      Publish week
    </MSButton>
  </header>
);

// ============================================================
// WEEK STRIP — horizontal date ribbon with coverage dots
// ============================================================
const WeekStrip = ({ accent, currentDay, setCurrentDay, viewMode, setViewMode, canvasAxis, setCanvasAxis }) => {
  return (
    <div style={{
      display: "flex", alignItems: "stretch", gap: 0,
      padding: "14px 24px", background: "white", borderBottom: "1px solid #edebe9"
    }}>
      {/* Prev / label / next */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 20, borderRight: "1px solid #edebe9" }}>
        <MSButton variant="secondary" size="sm" leading={<SIcon name="chevron-left" size={14} />}></MSButton>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 14.5, color: "#201f1e", letterSpacing: "-0.01em" }}>
            {WEEK.label}
          </div>
          <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1, fontFamily: "SF Mono, monospace" }}>{WEEK.id}</div>
        </div>
        <MSButton variant="secondary" size="sm" leading={<SIcon name="chevron-right" size={14} />}></MSButton>
        <MSButton variant="ghost" size="sm">Today</MSButton>
      </div>

      {/* Day chips */}
      <div style={{ flex: 1, display: "flex", gap: 6, paddingLeft: 20, paddingRight: 20, overflowX: "auto" }}>
        {WEEK.days.map((d, i) => {
          const active = currentDay === i && viewMode === "day";
          const dayShifts = shiftsByDay(i);
          const hasHard = dayShifts.some(s => (s.violations||[]).some(v => v.tier === "hard"));
          const hasSoft = dayShifts.some(s => (s.violations||[]).some(v => v.tier === "soft"));
          const open = dayShifts.filter(s => s.status === "open").length;
          const draft = dayShifts.filter(s => !s.published && s.status !== "open").length;
          return (
            <button key={i} onClick={() => { setCurrentDay(i); setViewMode("day"); }} style={{
              flex: "1 1 0", minWidth: 98, padding: "10px 10px",
              borderRadius: 10, cursor: "pointer", textAlign: "left",
              background: active ? accent.soft : d.today ? "#fffaf6" : "transparent",
              border: active ? `1.5px solid ${accent.primary}` : d.today ? "1.5px solid " + accent.primary + "44" : "1.5px solid transparent",
              position: "relative"
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#faf9f8"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = d.today ? "#fffaf6" : "transparent"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? accent.primary : "#605e5c", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {d.day}
                </span>
                {d.bankHoliday && (
                  <span title={d.bankHoliday} style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                    background: "#eef2ff", color: "#312e81", letterSpacing: "0.04em"
                  }}>BH</span>
                )}
              </div>
              <div style={{
                fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 20,
                color: active ? accent.dark : d.today ? accent.primary : "#201f1e", letterSpacing: "-0.02em", marginTop: 2
              }}>{d.dd}</div>

              {/* Coverage dots */}
              <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10.5, color: "#605e5c", fontVariantNumeric: "tabular-nums" }}>
                  {dayShifts.length} shift{dayShifts.length === 1 ? "" : "s"}
                </span>
                {open > 0 && <Dot color="#a19f9d" tip={`${open} open`} />}
                {draft > 0 && <Dot color="#d97706" tip={`${draft} draft`} />}
                {hasHard && <Dot color="#cb2431" tip="Hard block" />}
                {hasSoft && !hasHard && <Dot color="#d97706" tip="Warning" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* View + axis toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 20, borderLeft: "1px solid #edebe9" }}>
        <Segmented
          accent={accent} value={viewMode} setValue={setViewMode}
          options={[
            ["day", "Day"],
            ["week", "Week"],
            ["month", "Month"],
            ["roster", "Roster"],
          ]}
        />
        {viewMode === "day" && (
          <Segmented
            accent={accent} value={canvasAxis} setValue={setCanvasAxis}
            options={[
              ["venue", <span><SIcon name="map-pin" size={12} /> Venues</span>],
              ["officer", <span><SIcon name="users" size={12} /> Officers</span>],
            ]}
          />
        )}
      </div>
    </div>
  );
};

const Dot = ({ color, tip }) => (
  <span title={tip} style={{ width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
);

const Segmented = ({ accent, value, setValue, options }) => (
  <div style={{ display: "inline-flex", background: "#f3f2f1", borderRadius: 8, padding: 3, gap: 2 }}>
    {options.map(([id, label]) => {
      const active = value === id;
      return (
        <button key={id} onClick={() => setValue(id)} style={{
          padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
          background: active ? "white" : "transparent",
          color: active ? accent.primary : "#605e5c",
          fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 5,
          boxShadow: active ? "0 1px 3px rgba(32,31,30,0.08)" : "none"
        }}>{label}</button>
      );
    })}
  </div>
);

// ============================================================
// VIOLATIONS BANNER
// ============================================================
const ViolationsBanner = ({ accent, onJump }) => {
  const hards = SHIFTS.filter(s => (s.violations||[]).some(v => v.tier === "hard"));
  const softs = SHIFTS.filter(s => (s.violations||[]).some(v => v.tier === "soft"));
  if (hards.length === 0 && softs.length === 0) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 18px", margin: "14px 24px 0", borderRadius: 10,
      background: hards.length > 0 ? "#fde7e9" : "#fff4e5",
      border: `1px solid ${hards.length > 0 ? "#fbd0d4" : "#fad48a"}`
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: hards.length > 0 ? "#cb2431" : "#d97706", color: "white",
        display: "grid", placeItems: "center"
      }}>
        <SIcon name={hards.length > 0 ? "shield-x" : "alert"} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: hards.length > 0 ? "#5b0a10" : "#7a4a00", lineHeight: 1.3 }}>
          {hards.length > 0
            ? `${hards.length} hard block${hards.length === 1 ? "" : "s"} must be resolved before publishing`
            : `${softs.length} soft warning${softs.length === 1 ? "" : "s"} — publish allowed`}
        </div>
        <div style={{ fontSize: 11.5, color: hards.length > 0 ? "#5b0a10" : "#7a4a00", opacity: 0.85, marginTop: 2 }}>
          {hards.length > 0
            ? "Expired SIA licences and assignments during approved leave block publication."
            : "Overtime tiers, bank holiday uplift and rest-period warnings — admin can acknowledge."}
        </div>
      </div>
      <MSButton variant="ghost" size="sm" onClick={onJump}>Review {hards.length + softs.length}</MSButton>
    </div>
  );
};

Object.assign(window, { Sidebar, Topbar, WeekStrip, ViolationsBanner, Segmented, SCHED_TWEAKS, NAV });
