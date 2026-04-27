// ============================================================
// Scheduling — Right Drawer (shift detail)
// ============================================================

const ShiftDrawer = ({ shift, onClose, accent }) => {
  if (!shift) return null;
  const venue = VENUES.find(v => v.id === shift.venueId);
  const officer = shift.officerId ? OFFICERS.find(o => o.id === shift.officerId) : null;
  const day = WEEK.days[shift.day];

  const hardViol = (shift.violations || []).filter(v => v.tier === "hard");
  const softViol = (shift.violations || []).filter(v => v.tier === "soft");
  const sia = officer ? siaState(officer.sia) : null;

  const [repeat, setRepeat] = uS(false);
  const [repeatWeeks, setRepeatWeeks] = uS(4);

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(32,31,30,0.28)", zIndex: 50,
        animation: "msFadeIn .18s ease"
      }} />
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 460, maxWidth: "92vw",
        background: "white", zIndex: 51, borderLeft: "1px solid #edebe9",
        display: "flex", flexDirection: "column",
        boxShadow: "-12px 0 30px -12px rgba(32,31,30,0.2)",
        animation: "msSlideIn .22s ease"
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 20px", borderBottom: "1px solid #edebe9",
          background: venue.color, color: "white", position: "relative"
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 14, right: 14, width: 30, height: 30,
            borderRadius: 6, background: "rgba(255,255,255,0.18)", border: "none",
            color: "white", cursor: "pointer", display: "grid", placeItems: "center"
          }}>
            <SIcon name="x" size={16} />
          </button>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", opacity: 0.85 }}>
            Shift · {shift.id.toUpperCase()}
          </div>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "-0.015em", marginTop: 3 }}>
            {venue.name}
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 5, display: "flex", gap: 12, fontFamily: "SF Mono, monospace" }}>
            <span>{day.day} {day.dd} Apr</span>
            <span>{fmtRange(shift.start, shift.end)} · {hrs(shift.start, shift.end)}h</span>
            <span>{venue.area}</span>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <StatusChip shift={shift} />
            {day.bankHoliday && <Chip icon="pin" label="Bank holiday" />}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {/* Violations */}
          {(hardViol.length > 0 || softViol.length > 0) && (
            <Section label="Violations">
              {hardViol.map((v, i) => <ViolRow key={i} v={v} />)}
              {softViol.map((v, i) => <ViolRow key={"s"+i} v={v} />)}
            </Section>
          )}

          {/* Officer */}
          <Section label="Assigned officer">
            {officer ? (
              <div style={{ display: "flex", gap: 12, padding: "10px 0" }}>
                <MSAvatar name={officer.name} hue={officer.hue} size={42} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#201f1e" }}>{officer.name}</div>
                  <div style={{ fontSize: 12, color: "#605e5c", marginTop: 2 }}>{officer.role} · {officer.sia.level}</div>
                </div>
                <MSButton variant="secondary" size="sm" leading={<SIcon name="edit" size={12} />}>Reassign</MSButton>
              </div>
            ) : (
              <div style={{
                padding: "14px 16px", borderRadius: 8, border: "1.5px dashed #a19f9d",
                background: "#faf9f8", textAlign: "center"
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#605e5c" }}>Open — no officer assigned</div>
                <div style={{ fontSize: 11.5, color: "#a19f9d", marginTop: 2 }}>Needs {venue.req} licence</div>
                <MSButton variant="primary" accent={accent} size="sm" style={{ marginTop: 10 }} leading={<SIcon name="user-plus" size={12} />}>Find eligible officer</MSButton>
              </div>
            )}

            {officer && sia && (
              <div style={{
                marginTop: 6, padding: "10px 12px", borderRadius: 8,
                background: sia.tone === "danger" ? "#fde7e9" : "#fff4e5",
                border: "1px solid " + (sia.tone === "danger" ? "#fbd0d4" : "#fad48a")
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SIcon name="shield" size={14} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: sia.tone === "danger" ? "#5b0a10" : "#7a4a00" }}>
                    SIA {officer.sia.level} · {sia.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: sia.tone === "danger" ? "#5b0a10" : "#7a4a00", marginTop: 3, fontFamily: "SF Mono, monospace", opacity: 0.85 }}>
                  {officer.sia.no}
                </div>
              </div>
            )}
          </Section>

          {/* Schedule */}
          <Section label="Schedule">
            <Field label="Start"><code>{fmtH(shift.start)}</code></Field>
            <Field label="End"><code>{fmtH(shift.end)}{shift.end > 24 && <span style={{ color: "#cb2431", marginLeft: 5 }}>+1 day</span>}</code></Field>
            <Field label="Duration"><code>{hrs(shift.start, shift.end)}h</code></Field>
            <Field label="Break">30 min (unpaid)</Field>
          </Section>

          {/* Recurrence */}
          <Section label="Repeat weekly">
            <div style={{ padding: "10px 0", display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
                <span style={{ fontSize: 13, color: "#323130" }}>Repeat this shift every week for</span>
              </label>
              <input type="number" min="1" max="52" value={repeatWeeks} onChange={e => setRepeatWeeks(+e.target.value)} disabled={!repeat} style={{
                width: 52, padding: "5px 8px", border: "1px solid #c8c6c4", borderRadius: 6,
                fontFamily: "SF Mono, monospace", fontSize: 13, textAlign: "center",
                opacity: repeat ? 1 : 0.5
              }}/>
              <span style={{ fontSize: 12, color: "#605e5c" }}>weeks</span>
            </div>
            {repeat && (
              <div style={{ fontSize: 11, color: "#a19f9d", background: "#faf9f8", padding: "8px 10px", borderRadius: 6, lineHeight: 1.45 }}>
                Will generate {repeatWeeks} shifts starting {WEEK.days[shift.day].day} {WEEK.days[shift.day].dd} Apr.
                Each one becomes an individual draft — edit or skip them separately. Conflicts will be flagged per week.
              </div>
            )}
          </Section>

          {/* Audit */}
          <Section label="Activity">
            <Activity icon="plus" text={<>Shift created by <b>Alex Mead</b></>} time="2 days ago" />
            {officer && <Activity icon="user-plus" text={<>Assigned to <b>{officer.name}</b></>} time="2 days ago" />}
            {!shift.published && shift.status !== "open" && (
              <Activity icon="edit" text={<>Pending publish — not yet visible to {officer ? officer.name.split(" ")[0] : "officer"}</>} time="draft" accent />
            )}
            {shift.published && (
              <Activity icon="eye" text={<>Published to schedule — officer notified</>} time="yesterday" />
            )}
          </Section>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid #edebe9",
          display: "flex", gap: 10, alignItems: "center", background: "#faf9f8"
        }}>
          <MSButton variant="ghost" size="sm" leading={<SIcon name="x" size={12} />}>Delete</MSButton>
          <div style={{ flex: 1 }} />
          {!shift.published && shift.status !== "open" && (
            <MSButton variant="primary" accent={accent} leading={<SIcon name="send" size={12} />} disabled={hardViol.length > 0}>
              Publish shift
            </MSButton>
          )}
          {shift.published && <MSButton variant="secondary" leading={<SIcon name="edit" size={12} />}>Edit shift</MSButton>}
          {shift.status === "open" && <MSButton variant="primary" accent={accent} leading={<SIcon name="user-plus" size={12} />}>Assign officer</MSButton>}
        </div>
      </aside>
    </>
  );
};

// --- tiny helpers ---
const Section = ({ label, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#605e5c", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
    {children}
  </div>
);

const Field = ({ label, children }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 0", borderBottom: "1px solid #f3f2f1", fontSize: 12.5
  }}>
    <span style={{ color: "#605e5c" }}>{label}</span>
    <span style={{ color: "#201f1e", fontWeight: 500, fontFamily: "SF Mono, monospace" }}>{children}</span>
  </div>
);

const Chip = ({ icon, label, bg = "rgba(255,255,255,0.18)", fg = "white" }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px",
    borderRadius: 4, background: bg, color: fg, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em"
  }}>
    <SIcon name={icon} size={11} /> {label}
  </span>
);

const StatusChip = ({ shift }) => {
  if (shift.status === "open") return <Chip icon="alert" label="OPEN · NEEDS COVER" bg="white" fg="#201f1e" />;
  if (!shift.published) return <Chip icon="edit" label="DRAFT — NOT PUBLISHED" />;
  return <Chip icon="check" label="PUBLISHED" />;
};

const ViolRow = ({ v }) => {
  const hard = v.tier === "hard";
  return (
    <div style={{
      display: "flex", gap: 10, padding: "10px 12px",
      background: hard ? "#fde7e9" : "#fff4e5",
      border: "1px solid " + (hard ? "#fbd0d4" : "#fad48a"),
      borderRadius: 8, marginBottom: 6
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
        background: hard ? "#cb2431" : "#d97706", color: "white",
        display: "grid", placeItems: "center"
      }}>
        <SIcon name={hard ? "shield-x" : "alert"} size={12} stroke={2.4} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: hard ? "#5b0a10" : "#7a4a00", letterSpacing: "0.02em" }}>
          {hard ? "HARD BLOCK" : "SOFT WARNING"} · {v.code}
        </div>
        <div style={{ fontSize: 12, color: hard ? "#5b0a10" : "#7a4a00", opacity: 0.92, marginTop: 2 }}>
          {v.msg}
        </div>
      </div>
    </div>
  );
};

const Activity = ({ icon, text, time, accent: isAccent }) => (
  <div style={{ display: "flex", gap: 10, padding: "7px 0", alignItems: "flex-start" }}>
    <div style={{
      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
      background: isAccent ? "#fff4e5" : "#f3f2f1",
      color: isAccent ? "#7a4a00" : "#605e5c",
      display: "grid", placeItems: "center"
    }}>
      <SIcon name={icon} size={12} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: "#201f1e", lineHeight: 1.45 }}>{text}</div>
      <div style={{ fontSize: 10.5, color: "#a19f9d", marginTop: 2 }}>{time}</div>
    </div>
  </div>
);

Object.assign(window, { ShiftDrawer });
