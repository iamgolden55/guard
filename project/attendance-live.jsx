// ============================================================
// Attendance — LIVE tab
// Novel ops monitor: a vertical "now line" running across a horizontal day,
// with each shift drawn as a paired ribbon (scheduled vs actual).
// Plus a left rail (KPIs + on-duty officers w/ status) and right rail (venue grid).
// ============================================================

const { useState: lS, useMemo: lM, useEffect: lE, useRef: lR } = React;

// Geometry
const HOUR_PX = 56;
const HOUR_FROM = 5;
const HOUR_TO = 26;          // shows up to 02:00 next day
const HOUR_COUNT = HOUR_TO - HOUR_FROM;

const xForHour = (h) => (h - HOUR_FROM) * HOUR_PX;

// Color helpers for status
const RIBBON_COLORS = {
  scheduled: "rgba(96, 94, 92, 0.18)",
  scheduled_border: "rgba(96, 94, 92, 0.35)",
  on_duty:     { bg: "#0f9d58", glow: "rgba(15,157,88,0.35)" },
  late:        { bg: "#d97706", glow: "rgba(217,119,6,0.35)" },
  early_out:   { bg: "#d97706", glow: "rgba(217,119,6,0.30)" },
  pending:     { bg: "#a19f9d", glow: "rgba(161,159,157,0.25)" },
  no_show:     { bg: "#cb2431", glow: "rgba(203,36,49,0.40)" },
  missing_out: { bg: "#cb2431", glow: "rgba(203,36,49,0.30)" },
  geofence:    { bg: "#6d28d9", glow: "rgba(109,40,217,0.30)" },
  upcoming:    { bg: "transparent", glow: "transparent" },
};

const ribbonKey = (s) => {
  if (s.status === "no_show") return "no_show";
  if (s.status === "missing_out") return "missing_out";
  if (s.geofence_fail) return "geofence";
  if (s.status === "early_out") return "early_out";
  if (s.status === "pending_approval") return "pending";
  if (s.status === "upcoming") return "upcoming";
  if ((s.late_min||0) >= 10 && s.status === "on_duty") return "late";
  if (s.was_late) return "late";
  return "on_duty";
};

// ============================================================
// LEFT RAIL — KPIs + on-duty roster
// ============================================================
const LiveLeftRail = ({ accent, onSelect }) => {
  const showed = ATT_STATS.showed_up;
  const expected = ATT_STATS.expected_so_far;
  const rate = (showed / expected * 100);

  // gauge svg
  const R = 44, C = 2 * Math.PI * R;
  const dash = (rate / 100) * C;

  return (
    <div style={{ width: 320, flexShrink: 0, borderRight: "1px solid #edebe9", background: "white", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Attendance gauge */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #edebe9" }}>
        <div style={{ ...MSText.over, fontSize: 10, marginBottom: 12 }}>Attendance rate · today so far</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={R} fill="none" stroke="#f3f2f1" strokeWidth="10" />
              <circle cx="55" cy="55" r={R} fill="none"
                stroke={rate >= 95 ? "#0f9d58" : rate >= 85 ? "#d97706" : "#cb2431"}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
                transform="rotate(-90 55 55)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 26, fontWeight: 800, color: "#201f1e", letterSpacing: "-0.03em" }}>
                  {rate.toFixed(0)}<span style={{ fontSize: 13 }}>%</span>
                </div>
                <div style={{ fontSize: 10, color: "#a19f9d", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>showed up</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <KPILine label="On duty"      value={ATT_STATS.on_duty}    color="#0f9d58" />
            <KPILine label="No-shows"     value={ATT_STATS.no_show}    color="#cb2431" />
            <KPILine label="Missing out"  value={ATT_STATS.missing_out} color="#cb2431" subtle />
            <KPILine label="Geofence"     value={ATT_STATS.geofence}   color="#6d28d9" />
          </div>
        </div>
      </div>

      {/* On-duty roster */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 10px" }}>
          <div style={{ ...MSText.over, fontSize: 10 }}>On duty now · {liveShifts.length}</div>
          <button style={{ background: "none", border: "none", color: accent.primary, fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>View all</button>
        </div>
        {liveShifts.map(s => <RosterRow key={s.id} s={s} accent={accent} onSelect={() => onSelect(s)} />)}
      </div>
    </div>
  );
};

const KPILine = ({ label, value, color, subtle }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0" }}>
    <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0, opacity: subtle ? 0.5 : 1 }} />
    <span style={{ fontSize: 12.5, color: "#605e5c", flex: 1, fontWeight: 500 }}>{label}</span>
    <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 15, color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{value}</span>
  </div>
);

const RosterRow = ({ s, accent, onSelect }) => {
  const o = A_oById(s.oid);
  const v = A_vById(s.vid);
  const elapsed = NOW_HOUR - s.act_start;
  const total = s.sch_end - s.sch_start;
  const pct = Math.min(100, Math.max(0, elapsed / total * 100));
  const tone = s.status === "missing_out" ? "danger" : s.geofence_fail ? "info" : "positive";
  const dotColor = s.status === "missing_out" ? "#cb2431" : s.geofence_fail ? "#6d28d9" : "#0f9d58";
  const ringDash = s.geofence_fail || s.status === "missing_out";

  return (
    <button onClick={onSelect} style={{
      width: "100%", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12,
      background: "transparent", border: "none", borderBottom: "1px solid #faf9f8",
      cursor: "pointer", textAlign: "left"
    }}
      onMouseEnter={e => e.currentTarget.style.background = "#faf9f8"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <MSAvatar name={o?.name} hue={o?.hue || 0} size={36} />
        <span style={{
          position: "absolute", bottom: -1, right: -1,
          width: 12, height: 12, borderRadius: 6,
          background: dotColor, border: "2.5px solid white",
          animation: ringDash ? "msPulse 1.4s ease-in-out infinite" : "none"
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o?.name}</div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#f3f2f1", color: "#605e5c", letterSpacing: "0.04em" }}>{o?.sia}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#a19f9d", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <SIcon name="map-pin" size={11} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v?.name}</span>
          <span>· {fmtRange2(s.sch_start, s.sch_end)}</span>
        </div>
        {/* progress */}
        <div style={{ marginTop: 5, height: 3, background: "#f3f2f1", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: dotColor, borderRadius: 2 }} />
        </div>
      </div>
    </button>
  );
};

// ============================================================
// CENTER — TIMELINE RIVER
// ============================================================
const TimelineRiver = ({ accent, groupBy, showPhotos, onSelect }) => {
  const containerRef = lR(null);

  // Auto-scroll so NOW is visible
  lE(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = Math.max(0, xForHour(NOW_HOUR) - 280);
    }
  }, []);

  // Group shifts
  const groups = lM(() => {
    if (groupBy === "officer") {
      const map = new Map();
      SHIFTS_TODAY.forEach(s => {
        const key = s.oid || "_open";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      });
      return Array.from(map.entries())
        .map(([k, list]) => ({ key: k, label: k === "_open" ? "Open shifts" : A_oById(k)?.name, sub: k === "_open" ? "" : A_oById(k)?.role, hue: A_oById(k)?.hue || 0, list, isOfficer: true }))
        .filter(g => g.label);
    }
    // by venue
    return A_VENUES
      .map(v => ({ key: v.id, label: v.name, sub: v.area, hue: v.hue, list: SHIFTS_TODAY.filter(s => s.vid === v.id), isOfficer: false }))
      .filter(g => g.list.length > 0);
  }, [groupBy]);

  const ROW_H = showPhotos ? 86 : 64;
  const totalWidth = HOUR_COUNT * HOUR_PX;
  const nowX = xForHour(NOW_HOUR);

  return (
    <div style={{ flex: 1, minWidth: 0, background: "#faf9f8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: "1px solid #edebe9", background: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...MSText.over, fontSize: 10 }}>Timeline · {TODAY_LABEL.split(" ").slice(0,2).join(" ")}</span>
        </div>
        <div style={{ flex: 1 }} />
        <LegendChip dot="#0f9d58" label="On duty" />
        <LegendChip dot="#d97706" label="Late" />
        <LegendChip dot="#cb2431" label="No-show" />
        <LegendChip dot="#6d28d9" label="Geofence" />
        <LegendChip dot="rgba(96,94,92,0.45)" label="Scheduled" hollow />
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <div style={{ width: totalWidth + 220, position: "relative" }}>
          {/* Header — hour ruler */}
          <div style={{
            position: "sticky", top: 0, zIndex: 4, background: "white",
            borderBottom: "1px solid #edebe9", height: 38, display: "flex"
          }}>
            <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #edebe9", padding: "8px 16px", display: "flex", alignItems: "center" }}>
              <span style={{ ...MSText.over, fontSize: 9.5 }}>{groupBy === "officer" ? "Officer" : "Venue"} · {groups.length}</span>
            </div>
            <div style={{ position: "relative", height: 38 }}>
              {Array.from({ length: HOUR_COUNT + 1 }).map((_, i) => {
                const h = HOUR_FROM + i;
                const display = h % 24;
                const isMajor = display % 3 === 0;
                return (
                  <div key={i} style={{
                    position: "absolute", left: i * HOUR_PX, top: 0, bottom: 0,
                    paddingLeft: 6, paddingTop: 12,
                    fontSize: 10.5, color: isMajor ? "#605e5c" : "#a19f9d",
                    fontWeight: isMajor ? 700 : 500, fontFamily: "SF Mono, monospace",
                    fontVariantNumeric: "tabular-nums"
                  }}>
                    {String(display).padStart(2,"0")}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div style={{ position: "relative" }}>
            {/* Hour grid lines */}
            <div style={{ position: "absolute", top: 0, left: 220, right: 0, bottom: 0, pointerEvents: "none" }}>
              {Array.from({ length: HOUR_COUNT + 1 }).map((_, i) => {
                const display = (HOUR_FROM + i) % 24;
                return (
                  <div key={i} style={{
                    position: "absolute", left: i * HOUR_PX, top: 0, bottom: 0, width: 1,
                    background: display % 3 === 0 ? "#edebe9" : "rgba(225,223,221,0.5)"
                  }} />
                );
              })}
            </div>

            {/* NOW line */}
            <div style={{
              position: "absolute", left: 220 + nowX, top: 0, bottom: 0, width: 0,
              borderLeft: `1.5px dashed ${accent.primary}`, zIndex: 6, pointerEvents: "none"
            }}>
              <div style={{
                position: "absolute", left: -22, top: 4,
                background: accent.primary, color: "white",
                fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
                padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
                boxShadow: `0 4px 10px -4px ${accent.primary}`,
              }}>NOW · {NOW_LABEL}</div>
            </div>

            {/* Rows */}
            {groups.map((g) => (
              <div key={g.key} style={{ display: "flex", borderBottom: "1px solid #edebe9", minHeight: ROW_H }}>
                <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #edebe9", padding: "12px 16px", background: "white", display: "flex", alignItems: "center", gap: 10 }}>
                  {g.isOfficer ? (
                    <MSAvatar name={g.label} hue={g.hue} size={30} />
                  ) : (
                    <span style={{
                      width: 8, height: 30, borderRadius: 2,
                      background: `oklch(58% 0.16 ${g.hue})`, flexShrink: 0
                    }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</div>
                    <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{g.sub} · {g.list.length} shift{g.list.length===1?"":"s"}</div>
                  </div>
                </div>
                <div style={{ position: "relative", flex: 1, minHeight: ROW_H }}>
                  {g.list.map(s => (
                    <ShiftRibbon key={s.id} s={s} accent={accent} showPhotos={showPhotos}
                      groupKey={g.key} groupBy={groupBy}
                      onSelect={() => onSelect(s)} />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ height: 60 }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const LegendChip = ({ dot, label, hollow }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#605e5c" }}>
    <span style={{
      width: 10, height: 10, borderRadius: 2,
      background: hollow ? "transparent" : dot,
      border: hollow ? `1.5px dashed ${dot}` : "none"
    }} />
    {label}
  </span>
);

// ============================================================
// SHIFT RIBBON — paired scheduled (translucent) + actual (solid)
// ============================================================
const ShiftRibbon = ({ s, accent, showPhotos, onSelect, groupKey, groupBy }) => {
  const v = A_vById(s.vid);
  const o = A_oById(s.oid);

  const schX = xForHour(s.sch_start);
  const schW = (s.sch_end - s.sch_start) * HOUR_PX;

  const key = ribbonKey(s);
  const colors = RIBBON_COLORS[key];

  // Actual ribbon geometry
  let actX = null, actW = null, isLive = false;
  if (s.act_start != null) {
    actX = xForHour(s.act_start);
    if (s.act_end != null) {
      actW = (s.act_end - s.act_start) * HOUR_PX;
    } else {
      // ongoing — extend to NOW (or sch_end if missing_out)
      const endH = s.status === "missing_out" ? s.sch_end : NOW_HOUR;
      actW = (endH - s.act_start) * HOUR_PX;
      isLive = true;
    }
  }

  return (
    <div onClick={onSelect} style={{ position: "absolute", top: 8, bottom: 8, left: schX, width: schW, cursor: "pointer" }}>
      {/* Scheduled background ribbon */}
      <div style={{
        position: "absolute", inset: 0,
        background: s.open ? "repeating-linear-gradient(135deg, #f3f2f1, #f3f2f1 5px, #faf9f8 5px, #faf9f8 8px)" : RIBBON_COLORS.scheduled,
        border: `1.5px dashed ${RIBBON_COLORS.scheduled_border}`,
        borderRadius: 6,
      }} />

      {/* Actual ribbon overlay */}
      {actX != null && (
        <div style={{
          position: "absolute", top: 4, bottom: 4,
          left: actX - schX, width: actW,
          background: colors.bg,
          borderRadius: 5,
          boxShadow: isLive ? `0 0 0 2px white, 0 6px 14px -4px ${colors.glow}` : `0 4px 10px -4px ${colors.glow}`,
          display: "flex", alignItems: "center",
          padding: "0 8px", gap: 8, color: "white",
          minWidth: 24, overflow: "hidden",
          fontFamily: "Inter, sans-serif"
        }}>
          {/* Live pulse cap on right edge */}
          {isLive && s.status !== "missing_out" && (
            <div style={{
              position: "absolute", right: -3, top: "50%", transform: "translateY(-50%)",
              width: 8, height: 8, borderRadius: 4, background: "white",
              boxShadow: `0 0 0 3px ${colors.bg}`,
              animation: "msPulse 1.2s ease-in-out infinite"
            }} />
          )}

          {showPhotos && s.photo && groupBy === "venue" && o && (
            <MSAvatar name={o.name} hue={o.hue} size={20} />
          )}

          <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1.15 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {groupBy === "venue" ? (o?.name || "Open") : v.name}
            </div>
            {actW > 100 && (
              <div style={{ fontSize: 10, opacity: 0.9, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {fmtHr(s.act_start)} → {s.act_end ? fmtHr(s.act_end) : (s.status === "missing_out" ? "—" : "live")}
                {(s.late_min||0) >= 5 && ` · ${fmtVar(s.late_min)}`}
              </div>
            )}
          </div>

          {s.geofence_fail && (
            <div title="Off-site check-in" style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 10, background: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
              <SIcon name="map-pin" size={12} />
            </div>
          )}
        </div>
      )}

      {/* No-show: cross-hatched scheduled with X overlay */}
      {s.status === "no_show" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "repeating-linear-gradient(135deg, #fde7e9, #fde7e9 4px, #fbd0d4 4px, #fbd0d4 7px)",
          border: "1.5px solid #cb2431", borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          color: "#5b0a10", fontSize: 11.5, fontWeight: 700,
        }}>
          <SIcon name="alert" size={14} />
          NO-SHOW
        </div>
      )}

      {/* Variance bracket on right edge for completed/early */}
      {s.act_end != null && Math.abs(s.act_end - s.sch_end) > 0.1 && (
        <div style={{
          position: "absolute", top: -2, right: ((s.sch_end - Math.max(s.act_end, s.sch_end))) * HOUR_PX, height: 4,
          width: Math.abs(s.act_end - s.sch_end) * HOUR_PX,
          background: s.act_end < s.sch_end ? "#d97706" : "#6d28d9",
          borderRadius: 2, opacity: 0.7
        }} />
      )}

      {/* Upcoming label */}
      {s.status === "upcoming" && schW > 80 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#605e5c", fontSize: 11, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
          {s.open ? "Open · " : ""}{fmtRange2(s.sch_start, s.sch_end)}
        </div>
      )}
    </div>
  );
};

// ============================================================
// RIGHT RAIL — venue grid (live status per venue)
// ============================================================
const VenueGrid = ({ accent, onSelect }) => {
  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid #edebe9", background: "white", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #edebe9" }}>
        <div style={{ ...MSText.over, fontSize: 10, marginBottom: 4 }}>Venue board</div>
        <div style={{ fontSize: 12, color: "#605e5c" }}>Coverage right now across {A_VENUES.length} sites</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {A_VENUES.map(v => {
          const venueShifts = SHIFTS_TODAY.filter(s => s.vid === v.id);
          const onDuty = venueShifts.filter(s => s.status === "on_duty").length;
          const issues = venueShifts.filter(s =>
            s.status === "no_show" || s.status === "missing_out" || s.geofence_fail
          );
          const upcoming = venueShifts.filter(s => s.status === "upcoming").length;
          const tone = issues.length > 0 ? "danger" : onDuty > 0 ? "ok" : "idle";
          const accentBg = tone === "danger" ? "#fde7e9" : tone === "ok" ? "#e6f4ea" : "#faf9f8";
          const accentBorder = tone === "danger" ? "#fbd0d4" : tone === "ok" ? "#b8e0c2" : "#edebe9";
          const dotColor = tone === "danger" ? "#cb2431" : tone === "ok" ? "#0f9d58" : "#a19f9d";
          return (
            <button key={v.id} onClick={() => issues.length > 0 && onSelect(issues[0])} style={{
              width: "100%", padding: "10px 12px", marginBottom: 6, borderRadius: 8,
              background: accentBg, border: `1px solid ${accentBorder}`,
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left"
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: 5, background: dotColor, flexShrink: 0,
                animation: tone === "danger" ? "msPulse 1.4s ease-in-out infinite" : "none"
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                <div style={{ fontSize: 11, color: "#605e5c", marginTop: 1 }}>
                  {issues.length > 0 ? `${issues.length} alert${issues.length===1?"":"s"} · ` : ""}
                  {onDuty} on duty
                  {upcoming > 0 && ` · ${upcoming} upcoming`}
                </div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a19f9d", letterSpacing: "0.04em" }}>{v.area}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// LIVE TAB ROOT
// ============================================================
const LiveView = ({ accent, tweaks, onSelect }) => {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <LiveLeftRail accent={accent} onSelect={onSelect} />
      <TimelineRiver accent={accent} groupBy={tweaks.groupBy} showPhotos={tweaks.showPhotos} onSelect={onSelect} />
      <VenueGrid accent={accent} onSelect={onSelect} />
    </div>
  );
};

Object.assign(window, { LiveView, ribbonKey, RIBBON_COLORS, xForHour, HOUR_PX, HOUR_FROM, HOUR_TO });
