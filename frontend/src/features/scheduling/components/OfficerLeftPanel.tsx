// OfficerLeftPanel — left rail with Open shifts + Staff tabs.
// Ported 1:1 from project/scheduling-canvas.jsx:377-539.
import { useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  fmtRange,
  hrs,
  OFFICERS,
  officerWeeklyHrs,
  SHIFTS,
  siaState,
  venueById,
  WEEK,
  type Shift,
} from "../data/mocks";

export type LeftPanelMode = "expanded" | "collapsed";

export interface OfficerLeftPanelProps {
  mode: LeftPanelMode;
  setMode: (m: LeftPanelMode) => void;
  onOpenShift: (s: Shift) => void;
}

export function OfficerLeftPanel({ mode, setMode, onOpenShift }: OfficerLeftPanelProps) {
  const { palette } = useAccent();
  const [tab, setTab] = useState<"open" | "people">("open");
  const [search, setSearch] = useState("");

  const openShifts = SHIFTS.filter((s) => s.status === "open").sort(
    (a, b) => a.day - b.day || a.start - b.start,
  );

  const filteredOfficers = OFFICERS.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.role.toLowerCase().includes(q);
  });

  if (mode === "collapsed") {
    return (
      <aside
        style={{
          width: 48,
          flexShrink: 0,
          background: "white",
          borderRight: `1px solid ${tokens.color.ink200}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 10,
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setMode("expanded")}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.color.ink600,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="chevron-right" size={16} />
        </button>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: tokens.color.ink500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            marginTop: 10,
          }}
        >
          Open · {openShifts.length} · Staff · {OFFICERS.length}
        </div>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: "white",
        borderRight: `1px solid ${tokens.color.ink200}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          padding: "10px 12px 0",
          gap: 4,
          borderBottom: `1px solid ${tokens.color.ink200}`,
        }}
      >
        {(
          [
            ["open", "Open shifts", openShifts.length],
            ["people", "Staff", OFFICERS.length],
          ] as const
        ).map(([id, label, count]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                padding: "9px 10px",
                border: "none",
                cursor: "pointer",
                background: "transparent",
                fontFamily: tokens.font.body,
                color: active ? tokens.color.ink900 : tokens.color.ink600,
                fontSize: 12.5,
                fontWeight: 600,
                borderBottom: active ? `2px solid ${palette.primary}` : "2px solid transparent",
                marginBottom: -1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {label}
              <span
                style={{
                  fontSize: 10.5,
                  padding: "1px 6px",
                  borderRadius: 8,
                  background: active ? palette.soft : tokens.color.ink100,
                  color: active ? palette.primary : tokens.color.ink600,
                  fontFamily: tokens.font.mono,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMode("collapsed")}
          aria-label="Collapse"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.color.ink600,
            display: "grid",
            placeItems: "center",
            marginBottom: 4,
          }}
        >
          <Icon name="chevrons-left" size={14} />
        </button>
      </div>

      <div
        style={{
          margin: "10px 12px",
          padding: "6px 10px",
          borderRadius: 8,
          background: tokens.color.ink100,
          display: "flex",
          alignItems: "center",
          gap: 7,
          color: tokens.color.ink600,
        }}
      >
        <Icon name="search" size={13} />
        <input
          placeholder={tab === "open" ? "Search open shifts…" : "Search officers…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 12.5,
            fontFamily: tokens.font.body,
            flex: 1,
            color: tokens.color.ink800,
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {tab === "open"
          ? openShifts.map((s) => {
              const v = venueById(s.venueId);
              const dayInfo = WEEK.days[s.day];
              if (!v || !dayInfo) return null;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenShift(s)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "white",
                    border: `1.5px dashed ${tokens.color.ink500}`,
                    marginBottom: 6,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.color.ink50;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        background: v.color,
                      }}
                    />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: tokens.color.ink900 }}>
                      {v.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: tokens.color.ink600, fontFamily: tokens.font.mono }}>
                    {dayInfo.day} {dayInfo.dd} · {fmtRange(s.start, s.end)} · {hrs(s.start, s.end)}h
                  </div>
                  <div style={{ fontSize: 10.5, color: tokens.color.ink500, marginTop: 3 }}>
                    Needs {v.req} · no officer assigned
                  </div>
                </button>
              );
            })
          : filteredOfficers.map((o) => {
              const sia = siaState(o.sia);
              const hrsWk = officerWeeklyHrs(o.id);
              const full = hrsWk >= o.cap;
              return (
                <div
                  key={o.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 10px",
                    borderRadius: 8,
                    marginBottom: 3,
                    cursor: "grab",
                    background: "white",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.color.ink50;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                  }}
                >
                  <Avatar name={o.name} hue={o.hue} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: tokens.color.ink900,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {o.name}
                      </span>
                      {sia && (
                        <span
                          title={sia.label}
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 4px",
                            borderRadius: 3,
                            background:
                              sia.tone === "danger" ? tokens.color.dangerSoft : tokens.color.warnSoft,
                            color: sia.tone === "danger" ? tokens.color.dangerInk : tokens.color.warnInk,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {sia.short}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: tokens.color.ink500,
                        marginTop: 1,
                        display: "flex",
                        gap: 5,
                        alignItems: "center",
                      }}
                    >
                      <span>
                        {o.sia.level} · {o.role}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        height: 3,
                        background: tokens.color.ink100,
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (hrsWk / o.cap) * 100)}%`,
                          height: "100%",
                          background: full
                            ? tokens.color.danger
                            : hrsWk / o.cap > 0.85
                              ? tokens.color.warn
                              : palette.primary,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: full ? tokens.color.dangerInk : tokens.color.ink500,
                        marginTop: 3,
                        fontFamily: tokens.font.mono,
                        fontWeight: 600,
                      }}
                    >
                      {hrsWk}h / {o.cap}h {full && "· at cap"}
                    </div>
                  </div>
                  <Icon name="grip" size={14} />
                </div>
              );
            })}
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderTop: `1px solid ${tokens.color.ink200}`,
          background: tokens.color.ink50,
        }}
      >
        <div style={{ fontSize: 10.5, color: tokens.color.ink600, lineHeight: 1.45 }}>
          Drag onto a row to assign. Hard blocks (expired SIA, leave) will prevent the drop.
          <span style={{ color: tokens.color.ink500 }}> · drag-drop ships in Phase 7.5</span>
        </div>
      </div>
    </aside>
  );
}
