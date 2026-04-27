// LiveLeftRail — KPI gauge + on-duty roster with progress bars.
// Ported 1:1 from project/attendance-live.jsx:46-154.
import { useAccent } from "../../../../contexts/AccentContext";
import { Avatar } from "../../../../design-system/primitives/Avatar";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import {
  ATT_STATS,
  fmtRange2,
  liveShifts,
  NOW_HOUR,
  officerById,
  venueById,
  type AttendanceShift,
} from "../../data/mocks";

export interface LiveLeftRailProps {
  onSelect: (shift: AttendanceShift) => void;
}

export function LiveLeftRail({ onSelect }: LiveLeftRailProps) {
  const { palette } = useAccent();
  const showed = ATT_STATS.showed_up;
  const expected = ATT_STATS.expected_so_far;
  const rate = (showed / expected) * 100;

  const R = 44;
  const C = 2 * Math.PI * R;
  const dash = (rate / 100) * C;
  const ringColor =
    rate >= 95 ? tokens.color.success : rate >= 85 ? tokens.color.warn : tokens.color.danger;

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderRight: `1px solid ${tokens.color.ink200}`,
        background: "white",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 20px 16px",
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
            marginBottom: 12,
          }}
        >
          Attendance rate · today so far
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={R} fill="none" stroke={tokens.color.ink100} strokeWidth="10" />
              <circle
                cx="55"
                cy="55"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
                transform="rotate(-90 55 55)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: tokens.font.display,
                    fontSize: 26,
                    fontWeight: 800,
                    color: tokens.color.ink900,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {rate.toFixed(0)}
                  <span style={{ fontSize: 13 }}>%</span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: tokens.color.ink500,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  showed up
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <KPILine label="On duty" value={ATT_STATS.on_duty} color={tokens.color.success} />
            <KPILine label="No-shows" value={ATT_STATS.no_show} color={tokens.color.danger} />
            <KPILine label="Missing out" value={ATT_STATS.missing_out} color={tokens.color.danger} subtle />
            <KPILine label="Geofence" value={ATT_STATS.geofence} color="#6d28d9" />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px 10px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: tokens.color.ink500,
            }}
          >
            On duty now · {liveShifts.length}
          </div>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: palette.primary,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            View all
          </button>
        </div>
        {liveShifts.map((s) => (
          <RosterRow key={s.id} s={s} onSelect={() => onSelect(s)} />
        ))}
      </div>
    </div>
  );
}

interface KPILineProps {
  label: string;
  value: number;
  color: string;
  subtle?: boolean;
}

function KPILine({ label, value, color, subtle }: KPILineProps) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0" }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: color,
          flexShrink: 0,
          opacity: subtle ? 0.5 : 1,
        }}
      />
      <span style={{ fontSize: 12.5, color: tokens.color.ink600, flex: 1, fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 15,
          color: tokens.color.ink900,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RosterRow({ s, onSelect }: { s: AttendanceShift; onSelect: () => void }) {
  const o = officerById(s.oid);
  const v = venueById(s.vid);
  if (!v || !o || s.act_start == null) return null;

  const elapsed = NOW_HOUR - s.act_start;
  const total = s.sch_end - s.sch_start;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const dotColor =
    s.status === "missing_out"
      ? tokens.color.danger
      : s.geofence_fail
        ? "#6d28d9"
        : tokens.color.success;
  const ringDash = s.geofence_fail || s.status === "missing_out";

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${tokens.color.ink50}`,
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.color.ink50;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar name={o.name} hue={o.hue} size={36} />
        <span
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 12,
            height: 12,
            borderRadius: 6,
            background: dotColor,
            border: "2.5px solid white",
            animation: ringDash ? "ms-pulse 1.4s ease-in-out infinite" : "none",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: tokens.color.ink900,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {o.name}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: 3,
              background: tokens.color.ink100,
              color: tokens.color.ink600,
              letterSpacing: "0.04em",
            }}
          >
            {o.sia}
          </span>
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: tokens.color.ink500,
            marginTop: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="map-pin" size={11} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {v.name}
          </span>
          <span>· {fmtRange2(s.sch_start, s.sch_end)}</span>
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
              width: `${pct}%`,
              height: "100%",
              background: dotColor,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </button>
  );
}
