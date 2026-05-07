// CoverageAlertBanner — top-of-canvas alert showing assigned, published shifts
// whose start time has passed but no check-in has been recorded. The backend's
// detect_attendance_exceptions Celery task auto-flips these to no_show at
// start_time + 30 min, so this banner gives the admin a window to intervene
// before that happens (call the officer, manually check them in, reassign).
//
// Compact by default — headline + count + expand toggle. Expanded reveals a
// scrollable list. Avoids "5 officers" turning into a wall of text inline.
//
// Range scope: reads from the currently-loaded canvas shifts (current view's
// week or month). If the admin has navigated away from "today", they won't see
// today's alerts here. Trade-off documented; fix later by lifting the alert
// query to its own "today" fetch.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { Shift } from "../data/mocks";
import { useScheduling } from "../state/SchedulingState";

const NO_SHOW_GRACE_MINUTES = 30;
const URGENT_THRESHOLD_MINUTES = 5;

interface AlertEntry {
  shift: Shift;
  officerName: string;
  venueName: string;
  startTime: number;
  minutesLate: number;
  minutesUntilFlip: number;
  urgent: boolean;
}

function shiftStartEpoch(shift: Shift): number | null {
  if (!shift.date) return null;
  const [yyyy, mm, dd] = shift.date.split("-").map(Number);
  const wholeHours = Math.floor(shift.start);
  const minutes = Math.round((shift.start - wholeHours) * 60);
  return new Date(
    yyyy ?? 1970,
    (mm ?? 1) - 1,
    dd ?? 1,
    wholeHours,
    minutes,
    0,
    0,
  ).getTime();
}

export function CoverageAlertBanner({
  onSelectShift,
}: {
  onSelectShift: (shift: Shift) => void;
}) {
  const { shifts, officerById, venueById } = useScheduling();
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const alerts: AlertEntry[] = useMemo(() => {
    const out: AlertEntry[] = [];
    const graceMs = NO_SHOW_GRACE_MINUTES * 60 * 1000;
    for (const s of shifts) {
      if (!s.published) continue;
      if (!s.officerId) continue;
      if (s.status !== "assigned" && s.status !== "in_progress") continue;
      if (s.checkInTime) continue;
      const startEpoch = shiftStartEpoch(s);
      if (startEpoch == null) continue;
      const minutesLate = (now - startEpoch) / 60_000;
      if (minutesLate <= 0) continue;
      // Stop showing 15 min after the auto-flip should have run; the row will
      // be filtered as no_show by then anyway.
      if (now - startEpoch > graceMs + 15 * 60 * 1000) continue;
      const minutesUntilFlip = Math.max(0, NO_SHOW_GRACE_MINUTES - minutesLate);
      const officer = officerById(s.officerId);
      const venue = venueById(s.venueId);
      out.push({
        shift: s,
        officerName: officer?.name ?? "Assigned officer",
        venueName: venue?.name ?? "Unknown venue",
        startTime: startEpoch,
        minutesLate,
        minutesUntilFlip,
        urgent: minutesUntilFlip <= URGENT_THRESHOLD_MINUTES,
      });
    }
    out.sort((a, b) => a.minutesUntilFlip - b.minutesUntilFlip);
    return out;
  }, [shifts, now, officerById, venueById]);

  if (alerts.length === 0) return null;

  const urgentCount = alerts.filter((a) => a.urgent).length;
  const anyUrgent = urgentCount > 0;
  const tone = anyUrgent
    ? {
        bg: tokens.color.dangerSoft,
        border: "#fbd0d4",
        ink: tokens.color.dangerInk,
        accent: tokens.color.danger,
      }
    : {
        bg: tokens.color.warnSoft,
        border: "#fad48a",
        ink: tokens.color.warnInk,
        accent: tokens.color.warn,
      };

  const headline =
    alerts.length === 1
      ? `${alerts[0]?.officerName} hasn't checked in at ${alerts[0]?.venueName}`
      : `${alerts.length} officers haven't checked in${
          urgentCount > 0
            ? ` · ${urgentCount} within ${URGENT_THRESHOLD_MINUTES} min of auto-no-show`
            : ""
        }`;

  return (
    <div
      role="alert"
      style={{
        margin: "14px 24px 0",
        borderRadius: 10,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            flexShrink: 0,
            background: tone.accent,
            color: "white",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="alert" size={14} />
        </div>
        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 700,
            color: tone.ink,
            lineHeight: 1.3,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {headline}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            background: "transparent",
            border: `1px solid ${tone.border}`,
            color: tone.ink,
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: 6,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          {expanded ? "Hide" : `View ${alerts.length}`}
          <Icon name={expanded ? "arrow-up" : "chevron-down"} size={11} />
        </button>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${tone.border}`,
            background: "rgba(255,255,255,0.5)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {alerts.map((a) => (
            <button
              key={a.shift.id}
              type="button"
              onClick={() => onSelectShift(a.shift)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${tone.border}33`,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: tokens.font.body,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: a.urgent ? tokens.color.danger : tokens.color.warn,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: tokens.color.ink900,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.officerName}
                  <span style={{ color: tokens.color.ink600, fontWeight: 500 }}>
                    {" · "}
                    {a.venueName}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.color.ink600,
                    fontFamily: tokens.font.mono,
                    marginTop: 1,
                  }}
                >
                  {Math.floor(a.minutesLate)}m late
                  {a.minutesUntilFlip > 0
                    ? ` · ${Math.ceil(a.minutesUntilFlip)}m to auto-no-show`
                    : " · auto-no-show pending"}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: tone.ink,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Open →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
