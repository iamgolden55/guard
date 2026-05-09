// ActiveShiftsTable — live view of in-progress monitored shifts. Each row
// shows last-check + countdown to next-due; rows where next-due has elapsed
// are highlighted as overdue. Updates every 15s via parent polling.

import type { CSSProperties } from "react";
import { Card } from "../../../design-system/primitives/Card";
import { Pill } from "../../../design-system/primitives/Pill";
import { tokens } from "../../../design-system/tokens";
import type { ActiveCapacityShift } from "../../../services/capacityLogbookService";

const HEADER_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: tokens.color.ink500,
  textAlign: "left",
  padding: "10px 14px",
  background: tokens.color.ink50,
  borderBottom: `1px solid ${tokens.color.ink200}`,
  whiteSpace: "nowrap",
};

const CELL_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink800,
  padding: "12px 14px",
  borderBottom: `1px solid ${tokens.color.ink100}`,
  verticalAlign: "middle",
};

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Returns "in 12 min" / "5 min ago" / "due now". */
function relativeMinutes(target: string | null | undefined): {
  text: string;
  isOverdue: boolean;
} {
  if (!target) return { text: "—", isOverdue: false };
  const t = new Date(target).getTime();
  if (Number.isNaN(t)) return { text: "—", isOverdue: false };
  const diffMin = Math.round((t - Date.now()) / 60_000);
  if (diffMin === 0) return { text: "due now", isOverdue: true };
  if (diffMin > 0) return { text: `in ${diffMin} min`, isOverdue: false };
  return { text: `${Math.abs(diffMin)} min ago`, isOverdue: true };
}

function performerName(
  p: ActiveCapacityShift["last_check"] extends infer T
    ? T extends { performed_by_details: infer P }
      ? P
      : null
    : null,
): string {
  if (!p) return "—";
  return `${p.first_name} ${p.last_name?.charAt(0) || ""}.`.trim();
}

export interface ActiveShiftsTableProps {
  shifts: ActiveCapacityShift[];
  isLoading: boolean;
  error: string | null;
}

export function ActiveShiftsTable({
  shifts,
  isLoading,
  error,
}: ActiveShiftsTableProps) {
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={HEADER_STYLE}>Venue</th>
              <th style={HEADER_STYLE}>Started</th>
              <th style={HEADER_STYLE}>Last check</th>
              <th style={HEADER_STYLE}>Next due</th>
              <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Logged</th>
              <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Missed</th>
              <th style={HEADER_STYLE}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && shifts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...CELL_STYLE, textAlign: "center", color: tokens.color.ink500 }}>
                  Loading active shifts…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} style={{ ...CELL_STYLE, textAlign: "center", color: tokens.color.ink600 }}>
                  {error}
                </td>
              </tr>
            ) : shifts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...CELL_STYLE, textAlign: "center", color: tokens.color.ink500 }}>
                  No active monitored shifts right now.
                </td>
              </tr>
            ) : (
              shifts.map((s) => {
                const nextDue = relativeMinutes(s.next_due_at);
                const isOverdue = s.is_overdue || nextDue.isOverdue;
                return (
                  <tr key={s.shift_group}>
                    <td style={{ ...CELL_STYLE, fontWeight: 600 }}>
                      {s.venue_name}
                      <div
                        style={{
                          fontSize: 11.5,
                          color: tokens.color.ink500,
                          fontWeight: 400,
                          marginTop: 2,
                        }}
                      >
                        Capacity {s.venue_capacity} · every {s.interval_minutes} min
                      </div>
                    </td>
                    <td style={{ ...CELL_STYLE, color: tokens.color.ink600 }}>
                      {formatTime(s.check_in_time || s.start_time)}
                    </td>
                    <td style={CELL_STYLE}>
                      {s.last_check ? (
                        <>
                          <span
                            style={{
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 600,
                              color: s.last_check.is_at_capacity
                                ? tokens.color.warnInk
                                : tokens.color.ink900,
                            }}
                          >
                            {s.last_check.current_count} / {s.last_check.venue_capacity}
                          </span>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: tokens.color.ink500,
                              marginTop: 2,
                            }}
                          >
                            {formatTime(s.last_check.timestamp)} · {performerName(s.last_check.performed_by_details)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: tokens.color.ink500 }}>None yet</span>
                      )}
                    </td>
                    <td
                      style={{
                        ...CELL_STYLE,
                        color: isOverdue ? tokens.color.dangerInk : tokens.color.ink800,
                        fontWeight: isOverdue ? 600 : 400,
                      }}
                    >
                      <div>{formatTime(s.next_due_at)}</div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: isOverdue ? tokens.color.dangerInk : tokens.color.ink500,
                          marginTop: 2,
                        }}
                      >
                        {nextDue.text}
                      </div>
                    </td>
                    <td
                      style={{
                        ...CELL_STYLE,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {s.total_checks}
                    </td>
                    <td
                      style={{
                        ...CELL_STYLE,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: s.total_missed > 0 ? tokens.color.dangerInk : tokens.color.ink800,
                        fontWeight: s.total_missed > 0 ? 600 : 400,
                      }}
                    >
                      {s.total_missed}
                    </td>
                    <td style={CELL_STYLE}>
                      {isOverdue ? (
                        <Pill tone="danger" dot>
                          Overdue
                        </Pill>
                      ) : s.last_check?.is_at_capacity ? (
                        <Pill tone="warning" dot>
                          At capacity
                        </Pill>
                      ) : (
                        <Pill tone="positive" dot>
                          On track
                        </Pill>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
