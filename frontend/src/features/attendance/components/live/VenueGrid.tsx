// VenueGrid — right rail of Live tab. Per-venue tile with status color
// and counts. Ported 1:1 from project/attendance-live.jsx:432-476.
import { tokens } from "../../../../design-system/tokens";
import type { AttendanceShift } from "../../data/mocks";
import { useAttendance } from "../../AttendanceContext";

export interface VenueGridProps {
  onSelect: (shift: AttendanceShift) => void;
}

export function VenueGrid({ onSelect }: VenueGridProps) {
  const { venues, shifts, matchesSearch } = useAttendance();
  const visibleShifts = shifts.filter(matchesSearch);
  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderLeft: `1px solid ${tokens.color.ink200}`,
        background: "white",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${tokens.color.ink200}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tokens.color.ink500,
            marginBottom: 4,
          }}
        >
          Venue board
        </div>
        <div style={{ fontSize: 12, color: tokens.color.ink600 }}>
          Coverage right now across {venues.length} sites
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {venues.map((v) => {
          const venueShifts = visibleShifts.filter((s) => s.vid === v.id);
          const onDuty = venueShifts.filter((s) => s.status === "on_duty").length;
          const issues = venueShifts.filter(
            (s) => s.status === "no_show" || s.status === "missing_out" || s.geofence_fail,
          );
          const upcoming = venueShifts.filter((s) => s.status === "upcoming").length;
          const tone = issues.length > 0 ? "danger" : onDuty > 0 ? "ok" : "idle";

          const accentBg =
            tone === "danger"
              ? tokens.color.dangerSoft
              : tone === "ok"
                ? tokens.color.successSoft
                : tokens.color.ink50;
          const accentBorder =
            tone === "danger" ? "#fbd0d4" : tone === "ok" ? "#b8e0c2" : tokens.color.ink200;
          const dotColor =
            tone === "danger"
              ? tokens.color.danger
              : tone === "ok"
                ? tokens.color.success
                : tokens.color.ink500;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => issues.length > 0 && issues[0] && onSelect(issues[0])}
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 6,
                borderRadius: 8,
                background: accentBg,
                border: `1px solid ${accentBorder}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: dotColor,
                  flexShrink: 0,
                  animation: tone === "danger" ? "ms-pulse 1.4s ease-in-out infinite" : "none",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
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
                  {v.name}
                </div>
                <div style={{ fontSize: 11, color: tokens.color.ink600, marginTop: 1 }}>
                  {issues.length > 0
                    ? `${issues.length} alert${issues.length === 1 ? "" : "s"} · `
                    : ""}
                  {onDuty} on duty
                  {upcoming > 0 && ` · ${upcoming} upcoming`}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: tokens.color.ink500,
                  letterSpacing: "0.04em",
                }}
              >
                {v.area}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
