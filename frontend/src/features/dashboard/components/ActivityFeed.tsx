// ActivityFeed — ported 1:1 from project/dashboard.jsx:730-769.
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { ActivityKind, DashboardActivity } from "../data/mocks";

interface ActivityMeta {
  color: string;
  icon: IconName;
}

const ACTIVITY_META: Record<ActivityKind, ActivityMeta> = {
  "check-in": { color: tokens.color.success, icon: "check" },
  "check-out": { color: tokens.color.ink600, icon: "arrow-down" },
  incident: { color: tokens.color.danger, icon: "alert" },
  approval: { color: tokens.color.info, icon: "check" },
  license: { color: tokens.color.warn, icon: "shield" },
  invoice: { color: "#8764b8", icon: "receipt" },
};

export interface ActivityFeedProps {
  items: DashboardActivity[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.color.ink200}`,
        padding: 20,
        fontFamily: tokens.font.body,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: tokens.color.ink900,
            }}
          >
            Live activity
          </h3>
          <div
            style={{ fontSize: 12.5, color: tokens.color.ink500, marginTop: 2 }}
          >
            Cross-venue stream
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: tokens.color.success,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: tokens.color.success,
              animation: "ms-pulse 1.8s infinite",
            }}
          />
          Live
        </span>
      </div>

      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 15,
            top: 8,
            bottom: 8,
            width: 1,
            background: tokens.color.ink200,
          }}
        />
        {items.map((a, i) => {
          const meta = ACTIVITY_META[a.kind];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 14,
                padding: "8px 0",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  flexShrink: 0,
                  background: "white",
                  border: `1.5px solid ${meta.color}33`,
                  color: meta.color,
                  display: "grid",
                  placeItems: "center",
                  zIndex: 1,
                }}
              >
                <Icon name={meta.icon} size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: tokens.color.ink900,
                    fontWeight: 500,
                  }}
                >
                  {a.text}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: tokens.color.ink500,
                    marginTop: 2,
                  }}
                >
                  {a.t} ago
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
