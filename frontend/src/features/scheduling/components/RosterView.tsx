// RosterView — officers × days table.
// Ported 1:1 from project/scheduling-app.jsx RosterView (lines 176-246).
import { Fragment } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  fmtRange,
  OFFICERS,
  siaState,
  UNAVAIL,
  venueById,
  WEEK,
  type Shift,
} from "../data/mocks";
import { officerWeeklyHrs, useScheduling } from "../state/SchedulingState";

export interface RosterViewProps {
  onOpenShift: (s: Shift) => void;
}

export function RosterView({ onOpenShift }: RosterViewProps) {
  const { shifts } = useScheduling();
  return (
    <div
      style={{
        margin: "16px 24px",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px repeat(7, minmax(140px, 1fr))",
            minWidth: 980,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: tokens.color.ink50,
              borderBottom: `1px solid ${tokens.color.ink200}`,
              fontSize: 10.5,
              fontWeight: 700,
              color: tokens.color.ink600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Officer
          </div>
          {WEEK.days.map((d, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                background: d.today ? "#fffaf6" : tokens.color.ink50,
                borderBottom: `1px solid ${tokens.color.ink200}`,
                borderLeft: `1px solid ${tokens.color.ink200}`,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: tokens.color.ink600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {d.day}
              </div>
              <div
                style={{
                  fontFamily: tokens.font.display,
                  fontWeight: 700,
                  fontSize: 14,
                  color: d.today ? tokens.color.danger : tokens.color.ink900,
                }}
              >
                {d.dd}
                {d.bankHoliday && (
                  <span
                    style={{
                      fontSize: 9,
                      marginLeft: 5,
                      color: "#312e81",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    BH
                  </span>
                )}
              </div>
            </div>
          ))}

          {OFFICERS.map((o) => {
            const sia = siaState(o.sia);
            const hrsWk = officerWeeklyHrs(shifts, o.id);
            return (
              <Fragment key={o.id}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${tokens.color.ink100}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Avatar name={o.name} hue={o.hue} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
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
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: tokens.color.ink500,
                        marginTop: 1,
                        display: "flex",
                        gap: 5,
                      }}
                    >
                      {sia && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "0 4px",
                            borderRadius: 2,
                            background:
                              sia.tone === "danger" ? tokens.color.dangerSoft : tokens.color.warnSoft,
                            color:
                              sia.tone === "danger" ? tokens.color.dangerInk : tokens.color.warnInk,
                          }}
                        >
                          {sia.short}
                        </span>
                      )}
                      <span>{hrsWk}h</span>
                    </div>
                  </div>
                </div>
                {WEEK.days.map((d, di) => {
                  const cellShifts = shifts.filter(
                    (s) => s.officerId === o.id && s.day === di,
                  );
                  const unavail = UNAVAIL.find((u) => u.officerId === o.id && u.day === di);
                  return (
                    <div
                      key={di}
                      style={{
                        padding: "6px 8px",
                        borderBottom: `1px solid ${tokens.color.ink100}`,
                        borderLeft: `1px solid ${tokens.color.ink200}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        minHeight: 52,
                        background: unavail
                          ? "repeating-linear-gradient(135deg, #faf9f8, #faf9f8 6px, #f3f2f1 6px, #f3f2f1 8px)"
                          : d.today
                            ? "rgba(255,250,246,0.4)"
                            : "white",
                      }}
                    >
                      {unavail ? (
                        <div
                          style={{
                            fontSize: 10,
                            color: tokens.color.ink600,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Icon name={unavail.type === "leave" ? "sun" : "pause"} size={10} />
                          {unavail.type === "leave" ? "Leave" : "N/A"}
                        </div>
                      ) : (
                        cellShifts.map((s) => {
                          const venue = venueById(s.venueId);
                          if (!venue) return null;
                          const hard = (s.violations || []).some((v) => v.tier === "hard");
                          const draftPattern = !s.published && s.status !== "open";
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => onOpenShift(s)}
                              style={{
                                padding: "4px 6px",
                                borderRadius: 4,
                                background: venue.color,
                                color: "white",
                                border: hard
                                  ? `2px solid ${tokens.color.danger}`
                                  : !s.published
                                    ? `1px solid ${tokens.color.warn}`
                                    : "1px solid transparent",
                                textAlign: "left",
                                fontFamily: tokens.font.body,
                                cursor: "pointer",
                                backgroundImage: draftPattern
                                  ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 7px)"
                                  : undefined,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {venue.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  opacity: 0.85,
                                  fontFamily: tokens.font.mono,
                                }}
                              >
                                {fmtRange(s.start, s.end)}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
