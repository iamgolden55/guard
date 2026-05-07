// ============================================================
// Attendance — Right Drawer (shift detail + adjustment + audit)
// ============================================================

const { useState: dS, useEffect: dE } = React;

const DrawerSheet = ({ open, onClose, children, accent }) => {
  const [mount, setMount] = dS(open);
  const [vis, setVis] = dS(false);

  dE(() => {
    if (open) { setMount(true); requestAnimationFrame(() => setVis(true)); }
    else { setVis(false); const t = setTimeout(() => setMount(false), 220); return () => clearTimeout(t); }
  }, [open]);

  dE(() => {
    if (!open) return;
    const k = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!mount) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: vis ? "rgba(32,31,30,0.40)" : "rgba(32,31,30,0)",
        backdropFilter: vis ? "blur(2px)" : "none",
        transition: "background .2s"
      }} />
      <div style={{
        position: "relative", width: 520, maxWidth: "100vw", height: "100%", background: "white",
        boxShadow: "-24px 0 48px -16px rgba(32,31,30,0.22)",
        transform: vis ? "translateX(0)" : "translateX(40px)",
        opacity: vis ? 1 : 0,
        transition: "transform .25s ease, opacity .2s",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }}>{children}</div>
    </div>
  );
};

const ShiftDrawer = ({ open, onClose, shift, accent }) => {
  const [editing, setEditing] = dS(false);
  const [reason, setReason] = dS("");
  const [adjIn, setAdjIn] = dS("");
  const [adjOut, setAdjOut] = dS("");

  dE(() => { setEditing(false); setReason(""); }, [shift?.id]);

  if (!shift) return <DrawerSheet open={open} onClose={onClose} accent={accent}><div /></DrawerSheet>;

  const s = shift;
  const o = A_oById(s.oid);
  const v = A_vById(s.vid);
  const adjustments = ADJUSTMENTS[s.id] || [];

  const ribKey = ribbonKey(s);
  const headerColor = RIBBON_COLORS[ribKey]?.bg || "#605e5c";
  const STATUS_LABEL = {
    on_duty: "On duty", no_show: "No-show", missing_out: "Missing check-out",
    pending_approval: "Pending approval", early_out: "Early check-out",
    upcoming: "Upcoming", completed: "Completed"
  };

  return (
    <DrawerSheet open={open} onClose={onClose} accent={accent}>
      {/* Header */}
      <div style={{ background: headerColor, color: "white", padding: "20px 22px 18px", position: "relative" }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 16,
          background: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", display: "grid", placeItems: "center"
        }}>
          <SIcon name="x" size={16} />
        </button>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>
          {STATUS_LABEL[s.status] || s.status} {s.geofence_fail && "· Geofence"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {o ? <MSAvatar name={o.name} hue={o.hue} size={44} /> : (
            <div style={{ width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.2)", display: "grid", placeItems: "center" }}>
              <SIcon name="user-plus" size={20} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: "-0.015em" }}>{o?.name || "Unassigned"}</div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>{o?.role} {o && `· SIA ${o.sia}`}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, opacity: 0.95 }}>
          <SIcon name="map-pin" size={13} /> {v.name} · {v.area}
          <span style={{ opacity: 0.5 }}>·</span>
          <SIcon name="clock" size={13} /> {fmtRange2(s.sch_start, s.sch_end)}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 24px" }}>
        {/* Time comparison card */}
        <div style={{ border: "1px solid #edebe9", borderRadius: 10, padding: 14, marginBottom: 18 }}>
          <div style={{ ...MSText.over, fontSize: 9.5, marginBottom: 10 }}>Scheduled vs actual</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <TimeBlock label="Scheduled" sub="Plan" inT={fmtHr(s.sch_start)} outT={fmtHr(s.sch_end)} muted />
            <TimeBlock label="Actual" sub={s.act_end ? "Recorded" : (s.act_start ? "Live" : "Not yet")}
              inT={s.act_start != null ? fmtHr(s.act_start) : "—"}
              outT={s.act_end != null ? fmtHr(s.act_end) : (s.act_start ? "—" : "—")}
              tone={ribKey === "no_show" ? "danger" : ribKey === "late" || ribKey === "early_out" ? "warn" : "ok"} />
          </div>
          {(s.late_min !== undefined && s.late_min !== 0) && (
            <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: "#faf9f8",
              fontSize: 12, color: "#605e5c", display: "flex", alignItems: "center", gap: 8 }}>
              <SIcon name="clock" size={12} />
              {s.late_min > 0 ? `Checked in ${fmtVar(s.late_min).replace("+","")} after scheduled start.` : `Checked in ${Math.abs(s.late_min)}m early.`}
            </div>
          )}
          {s.status === "early_out" && (
            <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "#fff4e5",
              fontSize: 12, color: "#7a4a00", display: "flex", alignItems: "center", gap: 8 }}>
              <SIcon name="clock" size={12} /> Checked out {s.early_min}m before scheduled end.
            </div>
          )}
        </div>

        {/* SIA + verification */}
        <SectionLabel>Verification</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          <VerifyTile icon="map-pin" label="GPS"
            ok={s.gps_ok === true} bad={s.gps_ok === false} unknown={s.gps_ok == null}
            value={s.gps_ok === true ? `${s.dist_m}m from venue` : s.gps_ok === false ? `${s.dist_m}m off-site` : "Not recorded"} />
          <VerifyTile icon="eye" label="Photo"
            ok={s.photo === true} bad={s.photo === false} unknown={s.photo == null}
            value={s.photo === true ? "Selfie captured" : s.photo === false ? "Missing" : "—"} />
          <VerifyTile icon="shield" label="Patrol checks"
            ok={s.patrol && s.patrol[0] === s.patrol[1]} bad={false} unknown={!s.patrol}
            value={s.patrol ? `${s.patrol[0]} of ${s.patrol[1]} complete` : "—"} />
          <VerifyTile icon="pause" label="Breaks taken"
            ok={true} value={s.breaks != null ? `${s.breaks} break${s.breaks===1?"":"s"}` : "—"} />
        </div>

        {s.note && (
          <>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ padding: "10px 12px", background: "#fffaf6", border: "1px solid #fde2c7", borderRadius: 8, fontSize: 12.5, color: "#605e5c", lineHeight: 1.5, marginBottom: 18 }}>
              {s.note}
            </div>
          </>
        )}

        {/* Adjustment editor */}
        <div style={{ border: "1px solid #edebe9", borderRadius: 10, padding: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 14 : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#201f1e" }}>Time adjustment</div>
              <div style={{ fontSize: 11.5, color: "#a19f9d", marginTop: 2 }}>Override actual times for payroll. Audit-logged.</div>
            </div>
            {!editing && <MSButton variant="secondary" size="sm" leading={<SIcon name="edit" size={12}/>} onClick={() => setEditing(true)}>Edit</MSButton>}
          </div>
          {editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FieldGroup label="Adjusted check-in">
                  <input type="time" value={adjIn || (s.act_start != null ? fmtHr(s.act_start) : fmtHr(s.sch_start))}
                    onChange={e => setAdjIn(e.target.value)}
                    style={inputCss} />
                </FieldGroup>
                <FieldGroup label="Adjusted check-out">
                  <input type="time" value={adjOut || (s.act_end != null ? fmtHr(s.act_end) : fmtHr(s.sch_end))}
                    onChange={e => setAdjOut(e.target.value)}
                    style={inputCss} />
                </FieldGroup>
              </div>
              <FieldGroup label="Reason (required)">
                <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. App outage between 10:00–10:30; confirmed via radio"
                  style={{ ...inputCss, resize: "vertical", lineHeight: 1.5 }} />
              </FieldGroup>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <MSButton variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</MSButton>
                <MSButton variant="primary" size="sm" accent={accent} disabled={!reason} onClick={() => setEditing(false)}>Save adjustment</MSButton>
              </div>
            </div>
          )}
        </div>

        {/* Audit trail */}
        <SectionLabel>Audit trail · {adjustments.length}</SectionLabel>
        {adjustments.length === 0 ? (
          <div style={{ padding: "14px", textAlign: "center", fontSize: 12, color: "#a19f9d", background: "#faf9f8", borderRadius: 8 }}>
            No adjustments recorded
          </div>
        ) : (
          <div style={{ borderLeft: "2px solid #edebe9", paddingLeft: 14, marginLeft: 6 }}>
            {adjustments.map((a, i) => (
              <div key={i} style={{ position: "relative", paddingBottom: 12 }}>
                <span style={{ position: "absolute", left: -21, top: 4, width: 10, height: 10, borderRadius: 5, background: accent.primary, border: "2px solid white", boxShadow: "0 0 0 1px #edebe9" }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: "#201f1e" }}>{a.by}</div>
                <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{a.at.replace("T"," · ").slice(0, 22)} · {a.field} {a.from} → {a.to}</div>
                <div style={{ fontSize: 12, color: "#605e5c", marginTop: 5, lineHeight: 1.5, padding: "8px 10px", background: "#faf9f8", borderRadius: 6 }}>
                  {a.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #edebe9", padding: "12px 18px", display: "flex", gap: 8, justifyContent: "flex-end", background: "#faf9f8" }}>
        <MSButton variant="ghost" size="sm">Reject</MSButton>
        <MSButton variant="secondary" size="sm" leading={<SIcon name="bell" size={12}/>}>Notify officer</MSButton>
        <MSButton variant="primary" size="sm" accent={accent} leading={<SIcon name="check" size={12}/>}>Approve shift</MSButton>
      </div>
    </DrawerSheet>
  );
};

const inputCss = {
  width: "100%", padding: "8px 10px", border: "1px solid #edebe9", borderRadius: 6,
  fontSize: 13, fontFamily: "Inter, sans-serif", color: "#201f1e", outline: "none"
};

const FieldGroup = ({ label, children }) => (
  <label style={{ display: "block" }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: "#605e5c", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    {children}
  </label>
);

const SectionLabel = ({ children }) => (
  <div style={{ ...MSText.over, fontSize: 9.5, marginBottom: 8 }}>{children}</div>
);

const TimeBlock = ({ label, sub, inT, outT, tone, muted }) => {
  const tones = {
    ok:     { bg: "#e6f4ea", fg: "#0f5132" },
    warn:   { bg: "#fff4e5", fg: "#7a4a00" },
    danger: { bg: "#fde7e9", fg: "#5b0a10" },
  }[tone] || { bg: "#faf9f8", fg: "#201f1e" };
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: muted ? "#faf9f8" : tones.bg, border: `1px solid ${muted ? "#edebe9" : tones.bg}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: muted ? "#605e5c" : tones.fg, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 10, color: muted ? "#a19f9d" : tones.fg, opacity: 0.7, marginTop: 1 }}>{sub}</div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6, fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 17, color: muted ? "#201f1e" : tones.fg, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
        {inT} <span style={{ fontSize: 12, color: muted ? "#a19f9d" : tones.fg, opacity: 0.6, fontWeight: 500 }}>→</span> {outT}
      </div>
    </div>
  );
};

const VerifyTile = ({ icon, label, ok, bad, unknown, value }) => {
  const color = bad ? "#cb2431" : unknown ? "#a19f9d" : "#0f9d58";
  const bg = bad ? "#fde7e9" : unknown ? "#faf9f8" : "#e6f4ea";
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: bg, border: `1px solid ${bg}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <SIcon name={icon} size={12} /> {label}
      </div>
      <div style={{ fontSize: 12, color: "#605e5c", marginTop: 4 }}>{value}</div>
    </div>
  );
};

Object.assign(window, { ShiftDrawer });
