// ============================================================
// Scheduling — Canvas (day timeline Gantt) + sidebars
// ============================================================

// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------
const siaState = (sia) => {
  if (sia.daysLeft < 0)   return { tone: "danger",  label: `SIA expired ${Math.abs(sia.daysLeft)}d`, short: "Expired", hard: true };
  if (sia.daysLeft <= 14) return { tone: "danger",  label: `SIA ${sia.daysLeft}d left`,              short: `${sia.daysLeft}d`, soft: true };
  if (sia.daysLeft <= 30) return { tone: "warning", label: `SIA ${sia.daysLeft}d left`,              short: `${sia.daysLeft}d`, soft: true };
  return null;
};

const HOUR_W = 60; // px per hour

// ============================================================
// HOUR HEADER
// ============================================================
const HourHeader = ({ currentHour }) => {
  const hours = [];
  for (let h = HOURS_START; h <= HOURS_END; h++) hours.push(h);
  return (
    <div style={{
      display: "flex", position: "sticky", top: 0, zIndex: 4,
      background: "white", borderBottom: "1px solid #edebe9",
      minWidth: (HOURS_END - HOURS_START) * HOUR_W
    }}>
      {hours.slice(0, -1).map((h) => {
        const isNoon = (h % 24) === 12;
        const isCurrent = Math.floor(currentHour) === h;
        return (
          <div key={h} style={{
            width: HOUR_W, flexShrink: 0, borderRight: "1px solid #f3f2f1",
            padding: "10px 8px 8px", background: isCurrent ? "#fffaf6" : "transparent"
          }}>
            <div style={{
              fontFamily: "SF Mono, monospace", fontSize: 11,
              color: isNoon || h >= 24 ? "#605e5c" : "#a19f9d",
              fontWeight: isNoon || isCurrent ? 700 : 500
            }}>
              {String(h % 24).padStart(2, "0")}:00
              {h >= 24 && <span style={{ marginLeft: 4, color: "#cb2431", fontSize: 9 }}>+1</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// ROW HEADER CELLS
// ============================================================
const VenueRowHeader = ({ v }) => (
  <div style={{
    padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
    borderBottom: "1px solid #f3f2f1", borderRight: "1px solid #edebe9",
    background: "white", position: "sticky", left: 0, zIndex: 3, height: 72, boxSizing: "border-box"
  }}>
    <div style={{
      width: 6, height: 44, borderRadius: 3, background: v.color, flexShrink: 0
    }} />
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {v.name}
      </div>
      <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1, fontFamily: "SF Mono, monospace" }}>
        {v.area} · req. {v.req}
      </div>
    </div>
  </div>
);

const OfficerRowHeader = ({ o, weeklyHrs, unavailToday }) => {
  const sia = siaState(o.sia);
  const overCap = weeklyHrs > o.cap;
  return (
    <div style={{
      padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
      borderBottom: "1px solid #f3f2f1", borderRight: "1px solid #edebe9",
      background: unavailToday ? "#faf9f8" : "white",
      position: "sticky", left: 0, zIndex: 3, height: 72, boxSizing: "border-box", opacity: unavailToday ? 0.6 : 1
    }}>
      <MSAvatar name={o.name} hue={o.hue} size={34} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
          {sia && (
            <span title={sia.label} style={{
              fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
              background: sia.tone === "danger" ? "#fde7e9" : "#fff4e5",
              color: sia.tone === "danger" ? "#991b25" : "#7a4a00",
              letterSpacing: "0.04em"
            }}>{sia.short}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1, display: "flex", gap: 6, alignItems: "center" }}>
          <span>{o.role}</span>
          <span style={{ color: overCap ? "#cb2431" : "#a19f9d", fontWeight: overCap ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
            · {weeklyHrs}h / {o.cap}h
          </span>
          {o.optOut && <span style={{ fontSize: 9, background: "#eef2ff", color: "#312e81", padding: "0 4px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.04em" }}>OPT-OUT</span>}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SHIFT BLOCK
// ============================================================
const ShiftBlock = ({ shift, onOpen, colorBy = "venue" }) => {
  const venue = VENUES.find(v => v.id === shift.venueId);
  const officer = shift.officerId ? OFFICERS.find(o => o.id === shift.officerId) : null;

  const left  = (shift.start - HOURS_START) * HOUR_W + 2;
  const width = (shift.end - shift.start) * HOUR_W - 4;

  const hardViol = (shift.violations || []).find(v => v.tier === "hard");
  const softViol = (shift.violations || []).find(v => v.tier === "soft");

  const bgColor = shift.status === "open"
    ? "white"
    : colorBy === "status"
      ? (shift.published ? "#0f766e" : "#d97706")
      : venue.color;
  const fgColor = shift.status === "open" ? "#201f1e" : "white";

  const draftPattern = !shift.published && shift.status !== "open";

  return (
    <button
      onClick={() => onOpen(shift)}
      className={"sched-block" + (draftPattern ? " draft" : "")}
      style={{
        position: "absolute", top: 6, bottom: 6,
        left, width, minWidth: 60,
        borderRadius: 7,
        background: bgColor,
        border: shift.status === "open"
          ? "1.5px dashed #a19f9d"
          : hardViol
            ? "2px solid #cb2431"
            : softViol
              ? "2px solid #d97706"
              : `1px solid ${shift.published ? "transparent" : "#d97706"}`,
        color: fgColor, padding: "6px 9px",
        textAlign: "left", fontFamily: "Inter, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
        boxShadow: shift.status === "open" ? "none" : "0 1px 2px rgba(32,31,30,0.12)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4, minWidth: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            letterSpacing: "-0.005em"
          }}>
            {officer ? officer.name : "Open shift"}
          </div>
          <div style={{
            fontSize: 10.5, opacity: 0.88, marginTop: 2,
            fontFamily: "SF Mono, monospace",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
          }}>
            {fmtRange(shift.start, shift.end)}
            {width > 130 && <span style={{ opacity: 0.75 }}> · {venue.name}</span>}
          </div>
        </div>
        {(hardViol || softViol) && (
          <div style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            background: hardViol ? "rgba(203,36,49,0.9)" : "rgba(217,119,6,0.9)",
            color: "white",
            display: "grid", placeItems: "center"
          }}>
            <SIcon name="alert" size={11} stroke={2.4} />
          </div>
        )}
      </div>

      {/* Bottom meta chip */}
      {width > 90 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, fontSize: 10, opacity: 0.9,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>
          {!shift.published && shift.status !== "open" && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 2,
              background: "rgba(255,255,255,0.22)", letterSpacing: "0.05em"
            }}>DRAFT</span>
          )}
          {shift.status === "open" && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 2,
              background: "#f3f2f1", color: "#605e5c", letterSpacing: "0.05em"
            }}>OPEN · NEEDS COVER</span>
          )}
          {width > 160 && officer && shift.published && (
            <span style={{ fontSize: 9.5, opacity: 0.75 }}>{venue.req} · {hrs(shift.start, shift.end)}h</span>
          )}
        </div>
      )}
    </button>
  );
};

// ============================================================
// DAY CANVAS — single day, rows = venues OR officers
// ============================================================
const DayCanvas = ({ currentDay, canvasAxis, colorBy, onOpenShift }) => {
  const scrollerRef = uR(null);
  const day = WEEK.days[currentDay];
  const dayShifts = shiftsByDay(currentDay);

  // "Current time" indicator — 14:27 on Thu
  const nowHour = day.today ? 14.45 : null;

  // scroll to 08:00 on mount
  uE(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = (8 - HOURS_START) * HOUR_W;
    }
  }, [currentDay, canvasAxis]);

  const rows = canvasAxis === "venue"
    ? VENUES.map(v => ({
        key: v.id,
        header: <VenueRowHeader v={v} />,
        shifts: dayShifts.filter(s => s.venueId === v.id),
      }))
    : OFFICERS.map(o => {
        const unavail = UNAVAIL.find(u => u.officerId === o.id && u.day === currentDay);
        return {
          key: o.id,
          unavail,
          header: <OfficerRowHeader o={o} weeklyHrs={officerWeeklyHrs(o.id)} unavailToday={!!unavail} />,
          shifts: dayShifts.filter(s => s.officerId === o.id),
        };
      });

  return (
    <div style={{
      background: "white", border: "1px solid #edebe9", borderRadius: 12, overflow: "hidden",
      margin: "16px 24px", display: "flex", flexDirection: "column", minHeight: 400
    }}>
      {/* Day summary bar */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid #edebe9",
        display: "flex", alignItems: "center", gap: 20,
        background: day.bankHoliday ? "#eef2ff" : "white"
      }}>
        <div>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 17, color: "#201f1e", letterSpacing: "-0.015em" }}>
            {day.day} {day.dd} Apr 2026
            {day.today && <span style={{ marginLeft: 8, fontSize: 11, color: "white", background: "#cb2431", padding: "2px 6px", borderRadius: 3, letterSpacing: "0.05em", fontWeight: 700 }}>TODAY</span>}
          </div>
          {day.bankHoliday && (
            <div style={{ fontSize: 11.5, color: "#312e81", marginTop: 3, fontWeight: 600 }}>
              <SIcon name="pin" size={11} /> {day.bankHoliday} · bank holiday uplift applies
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <DaySummary shifts={dayShifts} />
      </div>

      {/* Grid */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Row headers (sticky) */}
        <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #edebe9", background: "white" }}>
          <div style={{ height: 41, borderBottom: "1px solid #edebe9", background: "#faf9f8", display: "flex", alignItems: "center", padding: "0 14px" }}>
            <span style={{ ...MSText.over, color: "#605e5c" }}>{canvasAxis === "venue" ? "Venue" : "Officer"}</span>
          </div>
          {rows.map(r => <div key={r.key}>{r.header}</div>)}
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollerRef} style={{ flex: 1, overflowX: "auto", overflowY: "hidden", position: "relative" }}>
          <div style={{ minWidth: (HOURS_END - HOURS_START) * HOUR_W, position: "relative" }}>
            <HourHeader currentHour={nowHour} />

            {rows.map((r) => (
              <div key={r.key} style={{
                position: "relative", height: 72, borderBottom: "1px solid #f3f2f1",
                background: r.unavail
                  ? `repeating-linear-gradient(135deg, #faf9f8, #faf9f8 8px, #f3f2f1 8px, #f3f2f1 10px)`
                  : "white"
              }}>
                {/* hour gridlines */}
                {Array.from({ length: HOURS_END - HOURS_START }).map((_, i) => (
                  <div key={i} style={{
                    position: "absolute", top: 0, bottom: 0, left: i * HOUR_W,
                    width: 1, background: (i + HOURS_START) % 24 === 0 ? "#e1dfdd" : "#f3f2f1"
                  }}/>
                ))}
                {/* Non-working hours shading (00-06 early morning) */}
                {r.unavail && (
                  <div style={{
                    position: "absolute", top: 16, left: 12, padding: "6px 10px",
                    borderRadius: 6, background: "white", border: "1px dashed #a19f9d",
                    fontSize: 11.5, color: "#605e5c", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 6
                  }}>
                    <SIcon name={r.unavail.type === "leave" ? "sun" : "pause"} size={11} />
                    {r.unavail.reason}
                  </div>
                )}
                {r.shifts.map(s => (
                  <ShiftBlock key={s.id} shift={s} onOpen={onOpenShift} colorBy={colorBy} />
                ))}
              </div>
            ))}

            {/* Current-time indicator */}
            {nowHour != null && (
              <div style={{
                position: "absolute", top: 41, bottom: 0,
                left: (nowHour - HOURS_START) * HOUR_W,
                width: 2, background: "#cb2431", pointerEvents: "none", zIndex: 6
              }}>
                <div style={{
                  position: "absolute", top: -4, left: -4, width: 10, height: 10,
                  borderRadius: 5, background: "#cb2431"
                }} />
                <div style={{
                  position: "absolute", top: -18, left: 8, padding: "1px 6px", borderRadius: 3,
                  background: "#cb2431", color: "white", fontSize: 10, fontFamily: "SF Mono, monospace", fontWeight: 700, whiteSpace: "nowrap"
                }}>Now · {fmtH(nowHour)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// DAY SUMMARY CHIPS
// ============================================================
const DaySummary = ({ shifts }) => {
  const published = shifts.filter(s => s.published).length;
  const draft = shifts.filter(s => !s.published && s.status !== "open").length;
  const open = shifts.filter(s => s.status === "open").length;
  const totalHrs = shifts.reduce((a, s) => a + (s.end - s.start), 0);
  const hard = shifts.filter(s => (s.violations||[]).some(v => v.tier === "hard")).length;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <Stat label="Shifts" value={shifts.length} />
      <Stat label="Hours" value={`${totalHrs}h`} />
      <Stat label="Published" value={published} color="#0f766e" />
      {draft > 0 && <Stat label="Drafts" value={draft} color="#d97706" />}
      {open > 0 && <Stat label="Open" value={open} color="#605e5c" />}
      {hard > 0 && <Stat label="Blocked" value={hard} color="#cb2431" />}
    </div>
  );
};

const Stat = ({ label, value, color = "#201f1e" }) => (
  <div style={{
    padding: "5px 10px", borderRadius: 6, background: "#faf9f8",
    border: "1px solid #edebe9", display: "flex", alignItems: "baseline", gap: 6, fontFamily: "Inter, sans-serif"
  }}>
    <span style={{ fontSize: 10.5, color: "#605e5c", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "Plus Jakarta Sans, sans-serif", fontVariantNumeric: "tabular-nums" }}>{value}</span>
  </div>
);

// ============================================================
// LEFT SIDEBAR — unassigned queue + people
// ============================================================
const LeftPanel = ({ peoplePanel, setPeoplePanel, accent, onOpenShift }) => {
  const [tab, setTab] = uS("open"); // open | people
  const [search, setSearch] = uS("");

  const openShifts = SHIFTS.filter(s => s.status === "open")
    .sort((a,b) => a.day - b.day || a.start - b.start);

  const filteredOfficers = OFFICERS.filter(o =>
    !search.trim() ||
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.role.toLowerCase().includes(search.toLowerCase())
  );

  const collapsed = peoplePanel === "collapsed";
  if (collapsed) {
    return (
      <aside style={{
        width: 48, flexShrink: 0, background: "white", borderRight: "1px solid #edebe9",
        display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, gap: 6
      }}>
        <button onClick={() => setPeoplePanel("expanded")} style={{
          width: 36, height: 36, borderRadius: 8, background: "transparent", border: "none",
          cursor: "pointer", color: "#605e5c", display: "grid", placeItems: "center"
        }}>
          <SIcon name="chevron-right" size={16} />
        </button>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#a19f9d", letterSpacing: "0.08em", textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)", marginTop: 10 }}>
          Open · {openShifts.length} · Staff · {OFFICERS.length}
        </div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: 280, flexShrink: 0, background: "white", borderRight: "1px solid #edebe9",
      display: "flex", flexDirection: "column", height: "calc(100vh - 57px)", position: "sticky", top: 57
    }}>
      {/* Tabs */}
      <div style={{ display: "flex", padding: "10px 12px 0", gap: 4, borderBottom: "1px solid #edebe9" }}>
        {[["open", "Open shifts", openShifts.length], ["people", "Staff", OFFICERS.length]].map(([id, label, count]) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: "9px 10px", border: "none", cursor: "pointer",
              background: "transparent", fontFamily: "Inter, sans-serif",
              color: active ? "#201f1e" : "#605e5c", fontSize: 12.5, fontWeight: 600,
              borderBottom: active ? `2px solid ${accent.primary}` : "2px solid transparent",
              marginBottom: -1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              {label}
              <span style={{
                fontSize: 10.5, padding: "1px 6px", borderRadius: 8,
                background: active ? accent.soft : "#f3f2f1",
                color: active ? accent.primary : "#605e5c", fontFamily: "SF Mono, monospace"
              }}>{count}</span>
            </button>
          );
        })}
        <button onClick={() => setPeoplePanel("collapsed")} style={{
          width: 28, height: 28, borderRadius: 6, background: "transparent", border: "none",
          cursor: "pointer", color: "#605e5c", display: "grid", placeItems: "center", marginBottom: 4
        }}>
          <SIcon name="chevrons-left" size={14} />
        </button>
      </div>

      {/* Search */}
      <div style={{
        margin: "10px 12px", padding: "6px 10px", borderRadius: 8,
        background: "#f3f2f1", display: "flex", alignItems: "center", gap: 7, color: "#605e5c"
      }}>
        <SIcon name="search" size={13} />
        <input placeholder={tab === "open" ? "Search open shifts…" : "Search officers…"} value={search} onChange={e => setSearch(e.target.value)} style={{
          border: "none", outline: "none", background: "transparent", fontSize: 12.5,
          fontFamily: "Inter, sans-serif", flex: 1, color: "#323130"
        }}/>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {tab === "open" ? (
          openShifts.map(s => {
            const v = VENUES.find(x => x.id === s.venueId);
            return (
              <button key={s.id} onClick={() => onOpenShift(s)} style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 12px", borderRadius: 8, background: "white",
                border: "1.5px dashed #a19f9d", marginBottom: 6, cursor: "pointer"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#faf9f8"}
                onMouseLeave={e => e.currentTarget.style.background = "white"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: v.color }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#201f1e" }}>{v.name}</span>
                </div>
                <div style={{ fontSize: 11, color: "#605e5c", fontFamily: "SF Mono, monospace" }}>
                  {WEEK.days[s.day].day} {WEEK.days[s.day].dd} · {fmtRange(s.start, s.end)} · {hrs(s.start, s.end)}h
                </div>
                <div style={{ fontSize: 10.5, color: "#a19f9d", marginTop: 3 }}>
                  Needs {v.req} · no officer assigned
                </div>
              </button>
            );
          })
        ) : (
          filteredOfficers.map(o => {
            const sia = siaState(o.sia);
            const hrsWk = officerWeeklyHrs(o.id);
            const full = hrsWk >= o.cap;
            return (
              <div key={o.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 10px", borderRadius: 8,
                marginBottom: 3, cursor: "grab",
                background: "white"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#faf9f8"}
                onMouseLeave={e => e.currentTarget.style.background = "white"}
              >
                <MSAvatar name={o.name} hue={o.hue} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#201f1e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
                    {sia && (
                      <span title={sia.label} style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                        background: sia.tone === "danger" ? "#fde7e9" : "#fff4e5",
                        color: sia.tone === "danger" ? "#991b25" : "#7a4a00",
                        letterSpacing: "0.04em"
                      }}>{sia.short}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#a19f9d", marginTop: 1, display: "flex", gap: 5, alignItems: "center" }}>
                    <span>{o.sia.level} · {o.role}</span>
                  </div>
                  {/* capacity bar */}
                  <div style={{ marginTop: 5, height: 3, background: "#f3f2f1", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: Math.min(100, (hrsWk / o.cap) * 100) + "%",
                      height: "100%",
                      background: full ? "#cb2431" : hrsWk / o.cap > 0.85 ? "#d97706" : accent.primary
                    }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: full ? "#991b25" : "#a19f9d", marginTop: 3, fontFamily: "SF Mono, monospace", fontWeight: 600 }}>
                    {hrsWk}h / {o.cap}h {full && "· at cap"}
                  </div>
                </div>
                <SIcon name="grip" size={14} />
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: "10px 12px", borderTop: "1px solid #edebe9", background: "#faf9f8" }}>
        <div style={{ fontSize: 10.5, color: "#605e5c", lineHeight: 1.45 }}>
          Drag onto a row to assign. Hard blocks (expired SIA, leave) will prevent the drop.
        </div>
      </div>
    </aside>
  );
};

Object.assign(window, { DayCanvas, LeftPanel, HourHeader, ShiftBlock, siaState });
