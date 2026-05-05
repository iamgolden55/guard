// BannerVisual — three overlapping "live" cards.
// Ported 1:1 from project/dashboard.jsx:911-1009.
import { useAccent } from "../../../contexts/AccentContext";
import { Sparkline } from "../../../design-system/charts/Sparkline";
import { tokens } from "../../../design-system/tokens";

const STACK_AVATARS: { hue: number; initials: string }[] = [
  { hue: 12, initials: "JO" },
  { hue: 280, initials: "PS" },
  { hue: 160, initials: "MB" },
  { hue: 32, initials: "SC" },
];

export function BannerVisual() {
  const { palette } = useAccent();

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
          This Week
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
            4,218
          </div>
        </div>
        <div
          style={{ fontSize: 10.5, color: tokens.color.ink600, marginTop: 2 }}
        >
          hours delivered
        </div>
        <div style={{ marginTop: 10 }}>
          <Sparkline
            data={[40, 45, 42, 58, 52, 62, 68]}
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
            127
          </div>
          <div style={{ fontSize: 10.5, color: tokens.color.ink600 }}>
            officers on shift
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex" }}>
          {STACK_AVATARS.map((a, i) => (
            <div
              key={i}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: `linear-gradient(135deg, oklch(68% 0.14 ${a.hue}), oklch(52% 0.17 ${a.hue}))`,
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
              {a.initials}
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
            Mead Security Ltd
          </div>
          <div
            style={{ fontSize: 9.5, color: tokens.color.ink500, marginTop: 2 }}
          >
            Weekly payroll · w/c 20 Apr
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {[
              ["Night Patrol", "£14,400"],
              ["Venue Cover", "£42,810"],
              ["Control Room", "£27,000"],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10.5,
                }}
              >
                <span style={{ color: tokens.color.ink600 }}>{label}</span>
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
              Total
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
              £84,210
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
