// ============================================================
// Attendance — EXCEPTIONS tab + TIMESHEETS tab
// ============================================================

const { useState: eS, useMemo: eM } = React;

// ============================================================
// EXCEPTIONS — triage queue
// ============================================================
const EXCEPTION_TYPES = [
  { id: "no_show",     label: "No-shows",        color: "#cb2431", icon: "alert",
    test: s => s.status === "no_show" },
  { id: "missing_out", label: "Missing checkout", color: "#cb2431", icon: "clock",
    test: s => s.status === "missing_out" },
  { id: "geofence",    label: "Geofence",        color: "#6d28d9", icon: "map-pin",
    test: s => s.geofence_fail },
  { id: "early_out",   label: "Early checkout",  color: "#d97706", icon: "x",
    test: s => s.status === "early_out" },
  { id: "late",        label: "Late check-in",   color: "#d97706", icon: "clock",
    test: s => (s.late_min||0) >= 10 && s.status !== "no_show" },
];

const ExceptionsView = ({ accent, onSelect }) => {
  const [filter, setFilter] = eS("all");

  const buckets = EXCEPTION_TYPES.map(t => ({ ...t, items: SHIFTS_TODAY.filter(t.test) }));
  const total = buckets.reduce((n, b) => n + b.items.length, 0);
  const visible = filter === "all" ? buckets : buckets.filter(b => b.id === filter);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#faf9f8" }}>
      {/* Filter strip */}
      <div style={{ display: "flex", gap: 8, padding: "16px 24px", background: "white", borderBottom: "1px solid #edebe9", overflowX: "auto" }}>
        <FilterChip active={filter==="all"} onClick={()=>setFilter("all")} label="All" count={total} color="#605e5c" accent={accent} />
        {buckets.map(b => (
          <FilterChip key={b.id} active={filter===b.id} onClick={()=>setFilter(b.id)} label={b.label} count={b.items.length} color={b.color} accent={accent} />
        ))}
        <div style={{ flex: 1 }} />
        <MSButton variant="secondary" size="sm" leading={<SIcon name="check" size={13} />}>Bulk approve</MSButton>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {visible.map(b => b.items.length > 0 && (
          <div key={b.id} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: b.color, color: "white", display: "grid", placeItems: "center" }}>
                <SIcon name={b.icon} size={15} />
              </span>
              <div>
                <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 16, color: "#201f1e" }}>{b.label}</div>
                <div style={{ fontSize: 11.5, color: "#a19f9d" }}>{b.items.length} requires action</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
              {b.items.map(s => <ExceptionCard key={s.id} s={s} type={b} accent={accent} onSelect={() => onSelect(s)} />)}
            </div>
          </div>
        ))}
        {total === 0 && (
          <div style={{ padding: 80, textAlign: "center", color: "#a19f9d" }}>
            <div style={{ fontSize: 56 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#201f1e", marginTop: 12 }}>All clear</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>No open exceptions across {SHIFTS_TODAY.length} shifts today.</div>
          </div>
        )}
      </div>
    </div>
  );
};

const FilterChip = ({ active, onClick, label, count, color, accent }) => (
  <button onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "7px 12px", borderRadius: 999, cursor: "pointer",
    background: active ? color : "white",
    border: `1px solid ${active ? color : "#edebe9"}`,
    color: active ? "white" : "#323130",
    fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap"
  }}>
    {label}
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
      background: active ? "rgba(255,255,255,0.25)" : "#f3f2f1",
      color: active ? "white" : "#605e5c", fontVariantNumeric: "tabular-nums"
    }}>{count}</span>
  </button>
);

const ExceptionCard = ({ s, type, accent, onSelect }) => {
  const o = A_oById(s.oid);
  const v = A_vById(s.vid);
  const sinceMin = s.status === "no_show"
    ? Math.round((NOW_HOUR - s.sch_start) * 60)
    : s.status === "missing_out"
    ? Math.round((NOW_HOUR - s.sch_end) * 60)
    : null;

  return (
    <div onClick={onSelect} style={{
      background: "white", borderRadius: 10, border: "1px solid #edebe9",
      borderLeft: `4px solid ${type.color}`, padding: 14, cursor: "pointer",
      transition: "box-shadow .15s, transform .08s", boxShadow: "0 1px 2px rgba(32,31,30,0.04)"
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 20px -8px rgba(32,31,30,0.18)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(32,31,30,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {o ? <MSAvatar name={o.name} hue={o.hue} size={36} /> : (
          <div style={{ width: 36, height: 36, borderRadius: 18, background: "#f3f2f1", display: "grid", placeItems: "center", color: "#605e5c" }}>
            <SIcon name="user-plus" size={16} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#201f1e" }}>{o?.name || "Unassigned"}</div>
          <div style={{ fontSize: 11.5, color: "#a19f9d", display: "flex", alignItems: "center", gap: 5 }}>
            <SIcon name="map-pin" size={11} /> {v.name} · {fmtRange2(s.sch_start, s.sch_end)}
          </div>
        </div>
        {sinceMin != null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 17, color: type.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {sinceMin >= 60 ? `${Math.floor(sinceMin/60)}h ${sinceMin%60}m` : `${sinceMin}m`}
            </div>
            <div style={{ fontSize: 9.5, color: "#a19f9d", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 700 }}>
              {s.status === "no_show" ? "past start" : "past end"}
            </div>
          </div>
        )}
      </div>

      {s.note && (
        <div style={{ fontSize: 12, color: "#605e5c", lineHeight: 1.5, padding: "8px 10px", background: "#faf9f8", borderRadius: 6, marginBottom: 10 }}>
          {s.note}
        </div>
      )}

      {s.geofence_fail && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 10px", background: "#f5f3ff", borderRadius: 6, fontSize: 11.5, color: "#5b21b6", fontWeight: 600 }}>
          <SIcon name="map-pin" size={12} /> {s.dist_m}m from venue boundary
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <MSButton variant="secondary" size="sm" leading={<SIcon name="bell" size={12} />} style={{ flex: 1 }}>Call</MSButton>
        <MSButton variant="secondary" size="sm" leading={<SIcon name="edit" size={12} />} style={{ flex: 1 }}>Adjust</MSButton>
        <MSButton variant="primary" size="sm" accent={accent} leading={<SIcon name="check" size={12} />} style={{ flex: 1 }}>Resolve</MSButton>
      </div>
    </div>
  );
};

// ============================================================
// TIMESHEETS — review-and-approve table
// ============================================================
const STATUS_TONE = {
  ready:    { bg: "#e6f4ea", fg: "#0f5132", label: "Ready", dot: "#0f9d58" },
  review:   { bg: "#fff4e5", fg: "#7a4a00", label: "Review", dot: "#d97706" },
  blocked:  { bg: "#fde7e9", fg: "#5b0a10", label: "Blocked", dot: "#cb2431" },
  approved: { bg: "#f3f2f1", fg: "#605e5c", label: "Approved", dot: "#a19f9d" },
};

const CELL_TONE = {
  approved: { bg: "#e6f4ea", fg: "#0f5132", border: "#b8e0c2" },
  pending:  { bg: "#fffbe6", fg: "#7a4a00", border: "#fde68a" },
  late:     { bg: "#fff4e5", fg: "#7a4a00", border: "#fad48a" },
  early:    { bg: "#fff4e5", fg: "#7a4a00", border: "#fad48a" },
  noshow:   { bg: "#fde7e9", fg: "#5b0a10", border: "#fbd0d4" },
  missing:  { bg: "#fde7e9", fg: "#5b0a10", border: "#fbd0d4" },
  geofence: { bg: "#f5f3ff", fg: "#5b21b6", border: "#ddd6fe" },
  absent:   { bg: "#faf9f8", fg: "#a19f9d", border: "#edebe9" },
  future:   { bg: "transparent", fg: "#c8c6c4", border: "#f3f2f1" },
};

const TimesheetsView = ({ accent, density, hideApproved, onSelect }) => {
  const [selected, setSelected] = eS(new Set());
  const rows = hideApproved ? TIMESHEETS.filter(t => t.status !== "approved") : TIMESHEETS;

  const totals = {
    sched: rows.reduce((a, r) => a + r.scheduled, 0),
    actual: rows.reduce((a, r) => a + r.actual, 0),
    flagged: rows.filter(r => r.status !== "ready" && r.status !== "approved").length,
  };

  const padY = density === "compact" ? 8 : 12;

  return (
    <div style={{ flex: 1, minHeight: 0, background: "#faf9f8", display: "flex", flexDirection: "column" }}>
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 0, padding: "14px 24px 0", background: "white", borderBottom: "1px solid #edebe9" }}>
        <SummaryBlock label="Scheduled" value={fmtH2(totals.sched)} />
        <SummaryBlock label="Actual" value={fmtH2(totals.actual)} />
        <SummaryBlock label="Variance" value={`${totals.actual - totals.sched > 0 ? "+" : ""}${(totals.actual - totals.sched).toFixed(1)}h`}
          tone={totals.actual - totals.sched < -1 ? "warn" : "ok"} />
        <SummaryBlock label="Officers" value={rows.length} />
        <SummaryBlock label="Need review" value={totals.flagged} tone={totals.flagged > 0 ? "warn" : "ok"} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0 14px" }}>
          <MSButton variant="secondary" size="sm" leading={<SIcon name="filter" size={12} />}>Filter</MSButton>
          <MSButton variant="primary" size="sm" accent={accent} leading={<SIcon name="check" size={12} />} disabled={selected.size === 0}>
            {selected.size > 0 ? `Approve ${selected.size} selected` : "Select rows to approve"}
          </MSButton>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 32px" }}>
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #edebe9", overflow: "hidden" }}>
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "32px minmax(220px, 1.6fr) repeat(7, 1fr) 90px 90px 90px 110px 100px",
            background: "#faf9f8", borderBottom: "1px solid #edebe9",
            fontSize: 10.5, fontWeight: 700, color: "#a19f9d", letterSpacing: "0.06em", textTransform: "uppercase",
            padding: "10px 14px", alignItems: "center"
          }}>
            <input type="checkbox"
              checked={selected.size === rows.length}
              onChange={e => setSelected(e.target.checked ? new Set(rows.map(r=>r.oid)) : new Set())}
            />
            <div>Officer</div>
            {WEEK_DAYS.map(d => (
              <div key={d.d} style={{ textAlign: "center", color: d.today ? accent.primary : "#a19f9d" }}>
                {d.label} <span style={{ fontVariantNumeric: "tabular-nums" }}>{d.date}</span>
              </div>
            ))}
            <div style={{ textAlign: "right" }}>Sched</div>
            <div style={{ textAlign: "right" }}>Actual</div>
            <div style={{ textAlign: "right" }}>Var</div>
            <div style={{ textAlign: "center" }}>Flags</div>
            <div style={{ textAlign: "center" }}>Status</div>
          </div>

          {rows.map(t => {
            const o = A_oById(t.oid);
            const tone = STATUS_TONE[t.status];
            const checked = selected.has(t.oid);
            const isApproved = t.status === "approved";
            return (
              <div key={t.oid} style={{
                display: "grid",
                gridTemplateColumns: "32px minmax(220px, 1.6fr) repeat(7, 1fr) 90px 90px 90px 110px 100px",
                padding: `${padY}px 14px`, borderBottom: "1px solid #f3f2f1",
                alignItems: "center", cursor: "pointer", background: checked ? "#fffaf6" : "white"
              }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "#faf9f8"; }}
                onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "white"; }}
                onClick={() => onSelect({ timesheet: t })}
              >
                <input type="checkbox" checked={checked} onClick={e => e.stopPropagation()}
                  onChange={e => {
                    const ns = new Set(selected);
                    if (e.target.checked) ns.add(t.oid); else ns.delete(t.oid);
                    setSelected(ns);
                  }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <MSAvatar name={o?.name} hue={o?.hue} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o?.name}</div>
                    <div style={{ fontSize: 11, color: "#a19f9d", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "#f3f2f1", color: "#605e5c" }}>{o?.sia}</span>
                      <span>{o?.role}</span>
                    </div>
                  </div>
                </div>

                {t.days.map((cell, i) => <DayCell key={i} cell={cell} today={WEEK_DAYS[i].today} />)}

                <div style={{ textAlign: "right", fontSize: 12.5, color: "#605e5c", fontVariantNumeric: "tabular-nums" }}>{fmtH2(t.scheduled)}</div>
                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{fmtH2(t.actual)}</div>
                <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                  color: Math.abs(t.variance) < 0.2 ? "#0f5132" : t.variance < 0 ? "#7a4a00" : "#5b21b6" }}>
                  {t.variance > 0 ? "+" : ""}{t.variance.toFixed(2)}h
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                  {t.flags.late > 0 && <FlagBadge label={t.flags.late} color="#d97706" title="Late check-ins" />}
                  {t.flags.early > 0 && <FlagBadge label={t.flags.early} color="#d97706" title="Early check-outs" />}
                  {t.flags.noshow > 0 && <FlagBadge label={t.flags.noshow} color="#cb2431" title="No-shows" />}
                  {t.flags.missing > 0 && <FlagBadge label={t.flags.missing} color="#cb2431" title="Missing check-out" />}
                  {t.flags.geofence > 0 && <FlagBadge label={t.flags.geofence} color="#6d28d9" title="Geofence" />}
                  {(t.flags.late + t.flags.early + t.flags.noshow + t.flags.missing + t.flags.geofence) === 0 && (
                    <span style={{ color: "#c8c6c4", fontSize: 14 }}>—</span>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: 999,
                    background: tone.bg, color: tone.fg,
                    fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase"
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: tone.dot }} />
                    {tone.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Approval modes */}
        <div style={{ marginTop: 18, padding: "16px 18px", background: "white", borderRadius: 10, border: "1px solid #edebe9", display: "flex", alignItems: "center", gap: 16 }}>
          <SIcon name="info" size={18} />
          <div style={{ flex: 1, fontSize: 13, color: "#605e5c", lineHeight: 1.5 }}>
            <strong style={{ color: "#201f1e" }}>Approval modes:</strong>{" "}
            click any row to approve a single shift, tick checkboxes to approve per-officer-per-week,
            or use the filter chips above to bulk-approve a filtered set. Blocked rows must have exceptions resolved first.
          </div>
          <MSButton variant="ghost" size="sm">Learn more</MSButton>
        </div>
      </div>
    </div>
  );
};

const SummaryBlock = ({ label, value, tone }) => (
  <div style={{ paddingRight: 28, paddingBottom: 14, borderRight: "1px solid #f3f2f1", marginRight: 28 }}>
    <div style={{ ...MSText.over, fontSize: 9.5, marginBottom: 4 }}>{label}</div>
    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 22,
      letterSpacing: "-0.02em", color: tone === "warn" ? "#d97706" : "#201f1e", fontVariantNumeric: "tabular-nums" }}>
      {value}
    </div>
  </div>
);

const DayCell = ({ cell, today }) => {
  const tone = CELL_TONE[cell.status];
  if (cell.status === "future") {
    return <div style={{ textAlign: "center", color: "#c8c6c4", fontSize: 11 }}>{cell.sch ? `${cell.sch}h` : "·"}</div>;
  }
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        padding: "4px 8px", minWidth: 50, borderRadius: 6,
        background: tone.bg, border: `1px solid ${tone.border}`,
        color: tone.fg, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums",
        outline: today ? "2px solid #cb243133" : "none"
      }}>
        <div>{cell.act > 0 ? `${cell.act.toFixed(2)}h` : (cell.status === "noshow" ? "NS" : cell.status === "missing" ? "—" : "·")}</div>
        {cell.act > 0 && Math.abs(cell.act - cell.sch) > 0.05 && (
          <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 1 }}>
            sch {cell.sch}h
          </div>
        )}
      </div>
    </div>
  );
};

const FlagBadge = ({ label, color, title }) => (
  <span title={title} style={{
    display: "inline-grid", placeItems: "center",
    minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9,
    background: color, color: "white", fontSize: 10, fontWeight: 800, fontVariantNumeric: "tabular-nums"
  }}>{label}</span>
);

Object.assign(window, { ExceptionsView, TimesheetsView, EXCEPTION_TYPES });
