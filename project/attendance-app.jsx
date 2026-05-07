// ============================================================
// Attendance — App root
// ============================================================

const { useState: appS } = React;

const ACCENTS = window.MS_ACCENTS || {
  "brand-red":   { primary: "#cb2431", dark: "#8a1820", soft: "#fde7e9", ink: "#5b0a10" },
  "ink-black":   { primary: "#201f1e", dark: "#000",     soft: "#f3f2f1", ink: "#201f1e" },
  "indigo":      { primary: "#4f46e5", dark: "#3730a3", soft: "#eef2ff", ink: "#312e81" },
  "forest":      { primary: "#0f9d58", dark: "#0a6b3a", soft: "#e6f4ea", ink: "#0f5132" },
};

const AttendanceApp = () => {
  const [tweaks, setTweak] = useTweaks(ATT_TWEAKS);
  const [selectedShift, setSelectedShift] = appS(null);
  const [drawerOpen, setDrawerOpen] = appS(false);
  const accent = ACCENTS[tweaks.accent] || ACCENTS["brand-red"];

  const onSelect = (s) => {
    if (!s) return;
    if (s.timesheet) {
      const shift = SHIFTS_TODAY.find(x => x.oid === s.timesheet.oid && x.status !== "upcoming") || SHIFTS_TODAY.find(x => x.oid === s.timesheet.oid);
      if (shift) { setSelectedShift(shift); setDrawerOpen(true); }
      return;
    }
    setSelectedShift(s);
    setDrawerOpen(true);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#faf9f8", fontFamily: "Inter, sans-serif", color: "#201f1e" }}
      data-screen-label={`Attendance · ${tweaks.view}`}>
      <ASidebar collapsed={tweaks.sidebarCollapsed} onToggle={() => setTweak("sidebarCollapsed", !tweaks.sidebarCollapsed)} accent={accent} />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <ATopbar accent={accent} view={tweaks.view} setView={(v) => setTweak("view", v)} livePulse={tweaks.livePulse} dateLabel={TODAY_LABEL} />

        {tweaks.view === "live" && (
          <LiveView accent={accent} tweaks={tweaks} onSelect={onSelect} />
        )}
        {tweaks.view === "exceptions" && (
          <ExceptionsView accent={accent} onSelect={onSelect} />
        )}
        {tweaks.view === "timesheets" && (
          <TimesheetsView accent={accent} density={tweaks.density} hideApproved={tweaks.hideApproved} onSelect={onSelect} />
        )}
      </main>

      <ShiftDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} shift={selectedShift} accent={accent} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="View">
          <TweakRadio label="Tab" value={tweaks.view}
            options={[
              { value: "live", label: "Live ops" },
              { value: "exceptions", label: "Exceptions" },
              { value: "timesheets", label: "Timesheets" },
            ]}
            onChange={v => setTweak("view", v)} />
        </TweakSection>

        <TweakSection title="Live timeline">
          <TweakRadio label="Group by" value={tweaks.groupBy}
            options={[{ value: "venue", label: "Venue" }, { value: "officer", label: "Officer" }]}
            onChange={v => setTweak("groupBy", v)} />
          <TweakToggle label="Inline avatars on ribbons" value={tweaks.showPhotos} onChange={v => setTweak("showPhotos", v)} />
          <TweakToggle label="Live pulse animation" value={tweaks.livePulse} onChange={v => setTweak("livePulse", v)} />
        </TweakSection>

        <TweakSection title="Timesheets">
          <TweakRadio label="Density" value={tweaks.density}
            options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]}
            onChange={v => setTweak("density", v)} />
          <TweakToggle label="Hide approved rows" value={tweaks.hideApproved} onChange={v => setTweak("hideApproved", v)} />
        </TweakSection>

        <TweakSection title="Theme">
          <TweakRadio label="Accent" value={tweaks.accent}
            options={[
              { value: "brand-red", label: "Mead red" },
              { value: "ink-black", label: "Ink" },
              { value: "indigo", label: "Indigo" },
              { value: "forest", label: "Forest" },
            ]}
            onChange={v => setTweak("accent", v)} />
          <TweakToggle label="Collapse sidebar" value={tweaks.sidebarCollapsed} onChange={v => setTweak("sidebarCollapsed", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<AttendanceApp />);
