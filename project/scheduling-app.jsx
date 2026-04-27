// ============================================================
// Scheduling — App entry (stitches everything + tweaks + week/month/roster)
// ============================================================

const { TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, TweakSelect } = window;

// ============================================================
// WEEK VIEW — 7 days × hours condensed
// ============================================================
const WeekView = ({ colorBy, onOpenShift }) => {
  const DAY_W = 170;
  const HOUR_H = 24;
  const startH = 6, endH = 26;
  const hoursArr = Array.from({ length: endH - startH }, (_, i) => startH + i);

  return (
    <div style={{
      margin: "16px 24px", background: "white", border: "1px solid #edebe9",
      borderRadius: 12, overflow: "hidden"
    }}>
      <div style={{ display: "flex", borderBottom: "1px solid #edebe9", background: "white" }}>
        <div style={{ width: 56, flexShrink: 0, background: "#faf9f8", borderRight: "1px solid #edebe9" }} />
        {WEEK.days.map((d, i) => (
          <div key={i} style={{
            flex: 1, minWidth: DAY_W, padding: "12px 14px",
            borderRight: i < 6 ? "1px solid #edebe9" : "none",
            background: d.today ? "#fffaf6" : d.bankHoliday ? "#eef2ff" : "white"
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#605e5c", letterSpacing: "0.08em", textTransform: "uppercase" }}>{d.day}</div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 20, color: d.today ? "#cb2431" : "#201f1e", letterSpacing: "-0.02em" }}>{d.dd}</div>
            {d.bankHoliday && <div style={{ fontSize: 10, color: "#312e81", marginTop: 2, fontWeight: 600 }}>{d.bankHoliday}</div>}
          </div>
        ))}
      </div>
      <div style={{ position: "relative", display: "flex", overflow: "auto", maxHeight: 620 }}>
        <div style={{ width: 56, flexShrink: 0, background: "#faf9f8", borderRight: "1px solid #edebe9", position: "sticky", left: 0, zIndex: 2 }}>
          {hoursArr.map((h) => (
            <div key={h} style={{ height: HOUR_H, borderBottom: "1px solid #f3f2f1", padding: "2px 6px", fontFamily: "SF Mono, monospace", fontSize: 10, color: "#a19f9d" }}>
              {String(h % 24).padStart(2, "0")}
            </div>
          ))}
        </div>
        {WEEK.days.map((d, di) => {
          const dayShifts = shiftsByDay(di);
          return (
            <div key={di} style={{
              flex: 1, minWidth: DAY_W, borderRight: di < 6 ? "1px solid #edebe9" : "none",
              position: "relative", background: d.today ? "rgba(255,250,246,0.5)" : "white"
            }}>
              {hoursArr.map((h) => (
                <div key={h} style={{ height: HOUR_H, borderBottom: "1px solid #f3f2f1" }} />
              ))}
              {dayShifts.map(s => {
                const venue = VENUES.find(v => v.id === s.venueId);
                const officer = s.officerId ? OFFICERS.find(o => o.id === s.officerId) : null;
                const hard = (s.violations||[]).some(v => v.tier === "hard");
                const soft = (s.violations||[]).some(v => v.tier === "soft");
                const top = (s.start - startH) * HOUR_H + 2;
                const height = (s.end - s.start) * HOUR_H - 4;
                const bg = s.status === "open" ? "white" : colorBy === "status" ? (s.published ? "#0f766e" : "#d97706") : venue.color;
                return (
                  <button key={s.id} onClick={() => onOpenShift(s)}
                    className={"sched-block" + (!s.published && s.status !== "open" ? " draft" : "")}
                    style={{
                      position: "absolute", top, height, left: 3, right: 3,
                      borderRadius: 5, background: bg, color: s.status === "open" ? "#201f1e" : "white",
                      border: s.status === "open" ? "1.5px dashed #a19f9d"
                        : hard ? "2px solid #cb2431"
                        : soft ? "2px solid #d97706"
                        : `1px solid ${s.published ? "transparent" : "#d97706"}`,
                      padding: "4px 6px", textAlign: "left", overflow: "hidden",
                      fontFamily: "Inter, sans-serif"
                    }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {officer ? officer.name.split(" ")[0] + " " + officer.name.split(" ")[1][0] + "." : "Open"}
                    </div>
                    {height > 28 && (
                      <div style={{ fontSize: 9.5, opacity: 0.85, fontFamily: "SF Mono, monospace" }}>
                        {fmtRange(s.start, s.end)}
                      </div>
                    )}
                    {height > 44 && (
                      <div style={{ fontSize: 9, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                        {venue.name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// MONTH VIEW — coverage heatmap
// ============================================================
const MonthView = ({ onOpenShift }) => {
  // Build a 35-cell grid (5 weeks × 7 days) using real week at position 2
  const cells = [];
  const monthStart = -14;
  for (let i = 0; i < 35; i++) {
    const dayOffset = monthStart + i;
    const inWeek = dayOffset >= 0 && dayOffset < 7;
    const dayShifts = inWeek ? shiftsByDay(dayOffset) : [];
    const hasBH = inWeek && WEEK.days[dayOffset].bankHoliday;
    const published = dayShifts.filter(s => s.published).length;
    const draft = dayShifts.filter(s => !s.published && s.status !== "open").length;
    const open = dayShifts.filter(s => s.status === "open").length;
    const hard = dayShifts.filter(s => (s.violations||[]).some(v => v.tier === "hard")).length;
    const date = new Date(2026, 3, 6 + i); // Apr 6 = Monday
    cells.push({ i, dayOffset, inWeek, dayShifts, hasBH, published, draft, open, hard, date });
  }

  return (
    <div style={{ margin: "16px 24px", background: "white", border: "1px solid #edebe9", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #edebe9", display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.015em" }}>April 2026</div>
        <div style={{ fontSize: 12, color: "#605e5c" }}>Coverage overview · click a day to drill in</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid #edebe9" }}>
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
          <div key={d} style={{ padding: "8px 12px", background: "#faf9f8", borderRight: "1px solid #edebe9", borderBottom: "1px solid #edebe9", fontSize: 10.5, fontWeight: 700, color: "#605e5c", letterSpacing: "0.08em", textTransform: "uppercase" }}>{d}</div>
        ))}
        {cells.map(c => {
          const coverage = c.dayShifts.length;
          const heat = Math.min(1, coverage / 9);
          return (
            <div key={c.i} style={{
              minHeight: 100, padding: "8px 10px",
              borderRight: ((c.i + 1) % 7) !== 0 ? "1px solid #edebe9" : "none",
              borderBottom: "1px solid #edebe9",
              background: c.inWeek && c.dayOffset === 3 ? "#fffaf6"
                : c.hasBH ? "#eef2ff"
                : c.inWeek ? `rgba(203, 36, 49, ${heat * 0.12})` : "#faf9f8",
              opacity: c.inWeek ? 1 : 0.55, position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{
                  fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700,
                  fontSize: 14, color: c.dayOffset === 3 ? "#cb2431" : "#201f1e"
                }}>{c.date.getDate()}</span>
                {c.hasBH && <span style={{ fontSize: 8.5, color: "#312e81", fontWeight: 700, letterSpacing: "0.04em" }}>BH</span>}
              </div>
              {c.inWeek && coverage > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 18, color: "#201f1e" }}>
                    {coverage}<span style={{ fontSize: 10, color: "#605e5c", fontWeight: 500, marginLeft: 3 }}>shifts</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, fontSize: 9.5 }}>
                    {c.published > 0 && <span style={{ color: "#0f5132", fontWeight: 700 }}>● {c.published} pub</span>}
                    {c.draft > 0 && <span style={{ color: "#7a4a00", fontWeight: 700 }}>● {c.draft} drf</span>}
                    {c.open > 0 && <span style={{ color: "#605e5c", fontWeight: 700 }}>○ {c.open} open</span>}
                  </div>
                  {c.hard > 0 && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#cb2431", display: "inline-block", padding: "1px 5px", borderRadius: 3, marginTop: 2, alignSelf: "flex-start" }}>
                      {c.hard} blocked
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// ROSTER VIEW — officers × days
// ============================================================
const RosterView = ({ onOpenShift }) => {
  return (
    <div style={{ margin: "16px 24px", background: "white", border: "1px solid #edebe9", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px repeat(7, minmax(140px, 1fr))", minWidth: 980 }}>
          <div style={{ padding: "10px 14px", background: "#faf9f8", borderBottom: "1px solid #edebe9", fontSize: 10.5, fontWeight: 700, color: "#605e5c", letterSpacing: "0.08em", textTransform: "uppercase" }}>Officer</div>
          {WEEK.days.map((d, i) => (
            <div key={i} style={{ padding: "10px 12px", background: d.today ? "#fffaf6" : "#faf9f8", borderBottom: "1px solid #edebe9", borderLeft: "1px solid #edebe9" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#605e5c", letterSpacing: "0.06em", textTransform: "uppercase" }}>{d.day}</div>
              <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 14, color: d.today ? "#cb2431" : "#201f1e" }}>{d.dd}{d.bankHoliday && <span style={{ fontSize: 9, marginLeft: 5, color: "#312e81", fontWeight: 700, letterSpacing: "0.04em" }}>BH</span>}</div>
            </div>
          ))}
          {OFFICERS.map(o => {
            const sia = siaState(o.sia);
            const hrsWk = officerWeeklyHrs(o.id);
            return (
              <React.Fragment key={o.id}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f2f1", display: "flex", alignItems: "center", gap: 10 }}>
                  <MSAvatar name={o.name} hue={o.hue} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</div>
                    <div style={{ fontSize: 10.5, color: "#a19f9d", marginTop: 1, display: "flex", gap: 5 }}>
                      {sia && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "0 4px", borderRadius: 2,
                          background: sia.tone === "danger" ? "#fde7e9" : "#fff4e5",
                          color: sia.tone === "danger" ? "#991b25" : "#7a4a00" }}>{sia.short}</span>
                      )}
                      <span>{hrsWk}h</span>
                    </div>
                  </div>
                </div>
                {WEEK.days.map((d, di) => {
                  const shifts = SHIFTS.filter(s => s.officerId === o.id && s.day === di);
                  const unavail = UNAVAIL.find(u => u.officerId === o.id && u.day === di);
                  return (
                    <div key={di} style={{
                      padding: "6px 8px", borderBottom: "1px solid #f3f2f1", borderLeft: "1px solid #edebe9",
                      display: "flex", flexDirection: "column", gap: 3, minHeight: 52,
                      background: unavail
                        ? `repeating-linear-gradient(135deg, #faf9f8, #faf9f8 6px, #f3f2f1 6px, #f3f2f1 8px)`
                        : d.today ? "rgba(255,250,246,0.4)" : "white"
                    }}>
                      {unavail ? (
                        <div style={{ fontSize: 10, color: "#605e5c", fontWeight: 600 }}>
                          <SIcon name={unavail.type === "leave" ? "sun" : "pause"} size={10} /> {unavail.type === "leave" ? "Leave" : "N/A"}
                        </div>
                      ) : shifts.map(s => {
                        const venue = VENUES.find(v => v.id === s.venueId);
                        const hard = (s.violations||[]).some(v => v.tier === "hard");
                        return (
                          <button key={s.id} onClick={() => onOpenShift(s)} className={"sched-block" + (!s.published ? " draft" : "")} style={{
                            padding: "4px 6px", borderRadius: 4, background: venue.color, color: "white",
                            border: hard ? "2px solid #cb2431" : !s.published ? "1px solid #d97706" : "1px solid transparent",
                            textAlign: "left", fontFamily: "Inter, sans-serif", cursor: "pointer"
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{venue.name}</div>
                            <div style={{ fontSize: 9, opacity: 0.85, fontFamily: "SF Mono, monospace" }}>{fmtRange(s.start, s.end)}</div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// APP
// ============================================================
const SchedulingApp = () => {
  const tk = useTweaks(SCHED_TWEAKS);

  const [sidebarCollapsed, setSidebarCollapsed] = uS(!!tk.values.sidebarCollapsed);
  const [active, setActive] = uS("shifts");
  const [currentDay, setCurrentDay] = uS(3); // Thu
  const [viewMode, setViewMode] = uS(tk.values.viewMode);
  const [canvasAxis, setCanvasAxis] = uS(tk.values.canvasAxis);
  const [peoplePanel, setPeoplePanel] = uS(tk.values.peoplePanel);
  const [openShift, setOpenShift] = uS(null);
  const [showPublish, setShowPublish] = uS(false);

  // Sync tweak changes → local state
  uE(() => setViewMode(tk.values.viewMode), [tk.values.viewMode]);
  uE(() => setCanvasAxis(tk.values.canvasAxis), [tk.values.canvasAxis]);
  uE(() => setPeoplePanel(tk.values.peoplePanel), [tk.values.peoplePanel]);

  const accent = MS_ACCENTS[tk.values.accent] || MS_ACCENTS["brand-red"];
  const colorBy = tk.values.colorBy || "venue";

  const draftCount = WEEK_COUNTS.draft;
  const hardCount = WEEK_COUNTS.hardViols;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#faf9f8" }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        accent={accent} active={active} setActive={setActive} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar accent={accent} draftCount={draftCount} hardCount={hardCount}
          onPublish={() => setShowPublish(true)}
          onNewShift={() => { /* no-op in prototype */ }} />
        <WeekStrip accent={accent} currentDay={currentDay} setCurrentDay={setCurrentDay}
          viewMode={viewMode} setViewMode={setViewMode}
          canvasAxis={canvasAxis} setCanvasAxis={setCanvasAxis} />

        <ViolationsBanner accent={accent} onJump={() => {}} />

        {/* Main area */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {viewMode === "day" && (
            <LeftPanel peoplePanel={peoplePanel} setPeoplePanel={setPeoplePanel} accent={accent} onOpenShift={setOpenShift} />
          )}
          <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
            {viewMode === "day" && (
              <DayCanvas currentDay={currentDay} canvasAxis={canvasAxis} colorBy={colorBy} onOpenShift={setOpenShift} />
            )}
            {viewMode === "week" && <WeekView colorBy={colorBy} onOpenShift={setOpenShift} />}
            {viewMode === "month" && <MonthView onOpenShift={setOpenShift} />}
            {viewMode === "roster" && <RosterView onOpenShift={setOpenShift} />}

            <Legend accent={accent} />
            <div style={{ height: 40 }} />
          </main>
        </div>
      </div>

      {openShift && <ShiftDrawer shift={openShift} onClose={() => setOpenShift(null)} accent={accent} />}
      {showPublish && <PublishModal accent={accent} onClose={() => setShowPublish(false)} hard={hardCount} draft={draftCount} />}

      <TweaksPanel title="Scheduling">
        <TweakSection title="View">
          <TweakRadio label="View mode" value={tk.values.viewMode} onChange={v => tk.set("viewMode", v)} options={[
            { value: "day",    label: "Day timeline" },
            { value: "week",   label: "Week grid" },
            { value: "month",  label: "Month coverage" },
            { value: "roster", label: "Roster table" },
          ]}/>
          <TweakRadio label="Canvas axis (day view)" value={tk.values.canvasAxis} onChange={v => tk.set("canvasAxis", v)} options={[
            { value: "venue",   label: "Rows = venues" },
            { value: "officer", label: "Rows = officers" },
          ]}/>
          <TweakRadio label="Color shift blocks by" value={tk.values.colorBy} onChange={v => tk.set("colorBy", v)} options={[
            { value: "venue",  label: "Venue (default)" },
            { value: "status", label: "Status (published / draft)" },
          ]}/>
          <TweakRadio label="People panel" value={tk.values.peoplePanel} onChange={v => tk.set("peoplePanel", v)} options={[
            { value: "expanded",  label: "Expanded" },
            { value: "collapsed", label: "Collapsed rail" },
          ]}/>
        </TweakSection>
        <TweakSection title="Chrome">
          <TweakToggle label="Collapse main sidebar" value={sidebarCollapsed} onChange={setSidebarCollapsed} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

// ============================================================
// LEGEND
// ============================================================
const Legend = ({ accent }) => (
  <div style={{
    margin: "0 24px", padding: "12px 16px", border: "1px solid #edebe9",
    borderRadius: 10, background: "white", display: "flex", gap: 20, alignItems: "center",
    flexWrap: "wrap", fontSize: 12
  }}>
    <span style={{ fontSize: 10.5, color: "#605e5c", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Legend</span>
    <Swatch color="#0f766e" label="Published" />
    <Swatch color="#d97706" label="Draft (not yet visible to officers)" pattern />
    <Swatch color="white" label="Open — needs cover" dashed />
    <Swatch color="white" label="Hard block (expired SIA / leave)" border="#cb2431" />
    <Swatch color="white" label="Soft warning (OT / rest / BH)" border="#d97706" />
  </div>
);

const Swatch = ({ color, label, pattern, dashed, border }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <span style={{
      width: 22, height: 14, borderRadius: 3, background: color,
      backgroundImage: pattern ? "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 5px)" : null,
      border: dashed ? "1.5px dashed #a19f9d" : border ? `2px solid ${border}` : "1px solid rgba(0,0,0,0.08)"
    }} />
    <span style={{ color: "#323130" }}>{label}</span>
  </div>
);

// ============================================================
// PUBLISH MODAL
// ============================================================
const PublishModal = ({ accent, onClose, hard, draft }) => (
  <MSModal open={true} title="Publish week 17" description="Officers will receive notifications once published." onClose={onClose}
    footer={(
      <>
        <MSButton variant="secondary" onClick={onClose}>Cancel</MSButton>
        <MSButton variant="primary" accent={accent} leading={<SIcon name="send" size={12} />} disabled={hard > 0} onClick={onClose}>
          {hard > 0 ? "Resolve blocks first" : `Publish ${draft} draft${draft === 1 ? "" : "s"}`}
        </MSButton>
      </>
    )}>
    <div style={{ display: "grid", gap: 10 }}>
      <Summary label="Drafts ready to publish" value={draft - hard} tone="success" />
      <Summary label="Hard blocks (must be resolved)" value={hard} tone={hard > 0 ? "danger" : "neutral"} />
      <Summary label="Soft warnings (allowed to publish)" value={WEEK_COUNTS.softViols} tone="warn" />
      <div style={{ padding: "10px 12px", background: "#faf9f8", borderRadius: 8, fontSize: 12, color: "#605e5c", lineHeight: 1.5, marginTop: 6 }}>
        Each officer will be notified via email and in-app. Open shifts remain open until claimed.
      </div>
    </div>
  </MSModal>
);

const Summary = ({ label, value, tone }) => {
  const colors = {
    success: { bg: "#e6f4ea", fg: "#0f5132" },
    danger:  { bg: "#fde7e9", fg: "#991b25" },
    warn:    { bg: "#fff4e5", fg: "#7a4a00" },
    neutral: { bg: "#faf9f8", fg: "#605e5c" },
  }[tone];
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: colors.bg }}>
      <span style={{ fontSize: 12.5, color: colors.fg, fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 18, color: colors.fg }}>{value}</span>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<SchedulingApp />);
