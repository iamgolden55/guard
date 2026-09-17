// BannerVisual — three overlapping cards in the dashboard hero.
//
// Ported 1:1 from the prototype, fixtures included: "127 officers on shift",
// "4,218 hours delivered", a £84,210 weekly payroll broken down across three
// invented cost centres, and four made-up avatars — all under a "Live" dot,
// sitting a couple of hundred pixels from the real KPI row. On this tenant it
// read 127 against an actual 5. Every figure now comes from the same overview
// query the KPIs use.
import { useAccent } from "../../../contexts/AccentContext";
import { Sparkline } from "../../../design-system/charts/Sparkline";
import { tokens } from "../../../design-system/tokens";
import type { DashboardStaff, DashboardVenue } from "../data/mocks";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  if (!first) return "?";
  if (!last) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export interface BannerVisualProps {
  /** Officers currently checked in — the `officers_on_shift` KPI. */
  officersOnShift: number;
  /** Hours delivered today — the `hours_delivered_today` KPI. */
  hoursDelivered: number;
  /** Revenue booked this week, in £ — the `revenue_this_week` KPI. */
  revenueThisWeek: number;
  /** Trend behind the hours figure, straight from the KPI sparkline. */
  hoursSpark: number[];
  /** Roster, used for the avatar stack and the on-shift initials. */
  staff: DashboardStaff[];
  /** Venue coverage rows for the third card. */
  venues: DashboardVenue[];
}

export function BannerVisual({
  officersOnShift,
  hoursDelivered,
  revenueThisWeek,
  hoursSpark,
  staff,
  venues,
}: BannerVisualProps) {
  const { palette } = useAccent();

  const onShift = staff.filter((s) => s.status === "on-shift");
  const avatarSource = (onShift.length ? onShift : staff).slice(0, 4);
  const spark = hoursSpark.length >= 2 ? hoursSpark : [0, 0];
  const topVenues = [...venues]
    .sort((a, b) => b.staffed - a.staffed)
    .slice(0, 3);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Card 3 — back */}
      <div
        style={{
          position: "absolute",
          right: 150,
          top: 18,
          width: 150,
          height: 132,
          background: `linear-gradient(165deg, #fef3f4 0%, ${palette.soft} 100%)`,
          borderRadius: 12,
          border: `1px solid ${palette.soft}`,
          padding: 12,
          transform: "rotate(-6deg)",
          boxShadow: `0 8px 20px -10px ${palette.primary}40`,
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: palette.ink,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Today
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 800,
              fontSize: 26,
              color: tokens.color.ink900,
              letterSpacing: "-0.02em",
            }}
          >
            {hoursDelivered.toLocaleString("en-GB", {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
        <div
          style={{ fontSize: 10.5, color: tokens.color.ink600, marginTop: 2 }}
        >
          hours delivered
        </div>
        <div style={{ marginTop: 10 }}>
          <Sparkline
            data={spark}
            color={palette.primary}
            w={120}
            h={28}
          />
        </div>
      </div>

      {/* Card 2 — middle */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 6,
          width: 156,
          height: 150,
          background: "white",
          borderRadius: 12,
          border: `1px solid ${tokens.color.ink200}`,
          padding: 14,
          transform: "rotate(-2deg)",
          boxShadow: "0 10px 24px -12px rgba(32,31,30,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: tokens.color.success,
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: tokens.color.successInk,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Live
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 800,
              fontSize: 24,
              color: tokens.color.ink900,
              letterSpacing: "-0.02em",
            }}
          >
            {officersOnShift}
          </div>
          <div style={{ fontSize: 10.5, color: tokens.color.ink600 }}>
            officers on shift
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex" }}>
          {avatarSource.map((a, i) => (
            <div
              key={a.id}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: `linear-gradient(135deg, oklch(68% 0.14 ${a.avatarHue}), oklch(52% 0.17 ${a.avatarHue}))`,
                color: "white",
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                fontWeight: 700,
                fontFamily: tokens.font.display,
                border: "2px solid white",
                marginLeft: i === 0 ? 0 : -6,
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.1)",
              }}
            >
              {initialsOf(a.name)}
            </div>
          ))}
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: tokens.color.ink100,
              color: tokens.color.ink600,
              display: "grid",
              placeItems: "center",
              fontSize: 9,
              fontWeight: 700,
              border: "2px solid white",
              marginLeft: -6,
            }}
          >
            +8
          </div>
        </div>
      </div>

      {/* Card 1 — front */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 20,
          width: 172,
          height: 148,
          background: "white",
          borderRadius: 12,
          border: `1px solid ${tokens.color.ink200}`,
          padding: 0,
          transform: "rotate(3deg)",
          boxShadow: "0 14px 32px -14px rgba(32,31,30,0.22)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${palette.primary}, ${palette.dark})`,
          }}
        />
        <div style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: tokens.color.ink900,
            }}
          >
            Venue coverage
          </div>
          <div
            style={{ fontSize: 9.5, color: tokens.color.ink500, marginTop: 2 }}
          >
            Staffed vs required, now
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {(topVenues.length
              ? topVenues.map((v) => [v.name, `${v.staffed}/${v.required}`])
              : [["No venues yet", "—"]]
            ).map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10.5,
                }}
              >
                <span
                  style={{
                    color: tokens.color.ink600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 92,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color: tokens.color.ink900,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: `1px dashed ${tokens.color.ink200}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: tokens.color.ink900,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              This wk
            </span>
            <span
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 800,
                fontSize: 15,
                color: palette.primary,
                letterSpacing: "-0.01em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {`£${Math.round(revenueThisWeek).toLocaleString("en-GB")}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
