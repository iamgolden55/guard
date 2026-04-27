// ============================================================
// Payroll — Main App
// Drawer + Export modal come from payroll-drawer-modal.jsx
// ============================================================

const PayrollApp = ({ tweaks, setTweaks }) => {
  const accent = MS_ACCENTS[tweaks.accent] || MS_ACCENTS["brand-red"];
  const [active, setActive] = uS("payroll");
  const [filter, setFilter] = uS("all");
  const [search, setSearch] = uS("");
  const [selectedIds, setSelectedIds] = uS([]);
  const [detailOfficer, setDetailOfficer] = uS(null);
  const [exportOpen, setExportOpen] = uS(false);

  const collapsed = tweaks.sidebarCollapsed;
  const toggleCollapse = () => setTweaks('sidebarCollapsed', !collapsed);

  const filteredOfficers = uM(() => {
    let list = OFFICERS;
    if (filter === "flagged") {
      list = list.filter(o =>
        o.sia.expired || o.sia.expiresInDays <= 30 ||
        o.adjustments > 0 || o.status === "rejected"
      );
    } else if (filter !== "all") {
      list = list.filter(o => o.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.venue.toLowerCase().includes(q) ||
        o.role.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filter, search]);

  const counts = uM(() => ({
    all: OFFICERS.length,
    pending:  OFFICERS.filter(o => o.status === "pending").length,
    paid:     OFFICERS.filter(o => o.status === "paid").length,
    rejected: OFFICERS.filter(o => o.status === "rejected").length,
    flagged:  OFFICERS.filter(o =>
      o.sia.expired || o.sia.expiresInDays <= 30 ||
      o.adjustments > 0 || o.status === "rejected"
    ).length,
  }), []);

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: "#faf9f8",
      fontFamily: "Inter, sans-serif", color: "#201f1e"
    }}>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapse} accent={accent} active={active} setActive={setActive} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar accent={accent} onOpenExport={() => setExportOpen(true)} />

        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <RunHero run={CURRENT_RUN} accent={accent}
            onOpenExport={() => setExportOpen(true)}
            onGeneratePdfs={() => {}} />

          {tweaks.showExportStrip && (
            <ExportStrip accent={accent} run={CURRENT_RUN} onOpenExport={() => setExportOpen(true)} />
          )}

          <div className="payroll-layout" style={{
            display: "grid",
            gridTemplateColumns: tweaks.showRightRail ? "1fr 340px" : "1fr",
            gap: 20, alignItems: "flex-start"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <FilterBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch}
                accent={accent} counts={counts} selected={selectedIds.length}
                onBulkExport={() => setExportOpen(true)}
              />
              <OfficersTable officers={filteredOfficers} accent={accent}
                selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                onOpenDetail={setDetailOfficer}
                density={tweaks.density}
              />
            </div>

            {tweaks.showRightRail && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <CompositionCard accent={accent} />
                <SiaHoldsCard accent={accent} />
                <RunHistoryCard accent={accent} />
              </div>
            )}
          </div>

          <div style={{ height: 40 }} />
        </main>
      </div>

      <OfficerDrawer officer={detailOfficer} accent={accent} onClose={() => setDetailOfficer(null)} />
      <ExportRunModal open={exportOpen} onClose={() => setExportOpen(false)}
        accent={accent} selectedCount={selectedIds.length || null} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Layout">
          <TweakToggle label="Collapse sidebar" value={tweaks.sidebarCollapsed}
            onChange={v => setTweaks('sidebarCollapsed', v)} />
          <TweakToggle label="Show export strip" value={tweaks.showExportStrip}
            onChange={v => setTweaks('showExportStrip', v)} />
          <TweakToggle label="Right rail" value={tweaks.showRightRail}
            onChange={v => setTweaks('showRightRail', v)} />
          <TweakRadio label="Density" value={tweaks.density}
            onChange={v => setTweaks('density', v)}
            options={[["compact","Compact"],["comfortable","Comfortable"],["spacious","Spacious"]]} />
        </TweakSection>
        <TweakSection title="Theme">
          <TweakRadio label="Accent" value={tweaks.accent}
            onChange={v => setTweaks('accent', v)}
            options={[["brand-red","Brand red"],["deep-navy","Navy"],["forest","Forest"],["graphite","Graphite"]]} />
        </TweakSection>
        <TweakSection title="Demo">
          <TweakButton onClick={() => setExportOpen(true)}>Open export modal</TweakButton>
          <TweakButton onClick={() => setDetailOfficer(OFFICERS[3])}>Open detail drawer</TweakButton>
          <TweakButton onClick={() => setDetailOfficer(OFFICERS[6])}>Drawer · SIA expired</TweakButton>
        </TweakSection>
      </TweaksPanel>

      <style>{`
        @keyframes msFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes msSlideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes msSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const PayrollRoot = () => {
  const [tweaks, setTweak] = useTweaks(PAYROLL_TWEAKS);
  return <PayrollApp tweaks={tweaks} setTweaks={setTweak} />;
};

ReactDOM.createRoot(document.getElementById("root")).render(<PayrollRoot />);
