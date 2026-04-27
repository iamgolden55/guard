// VenueRowHeader + OfficerRowHeader — sticky left column for the day canvas.
// Ported 1:1 from project/scheduling-canvas.jsx:55-108.
import { Avatar } from "../../../../design-system/primitives/Avatar";
import { tokens } from "../../../../design-system/tokens";
import {
  siaState,
  type SchedulingOfficer,
  type SchedulingVenue,
} from "../../data/mocks";

export function VenueRowHeader({ v }: { v: SchedulingVenue }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: `1px solid ${tokens.color.ink100}`,
        borderRight: `1px solid ${tokens.color.ink200}`,
        background: "white",
        position: "sticky",
        left: 0,
        zIndex: 3,
        height: 72,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 6,
          height: 44,
          borderRadius: 3,
          background: v.color,
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
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
          {v.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: tokens.color.ink500,
            marginTop: 1,
            fontFamily: tokens.font.mono,
          }}
        >
          {v.area} · req. {v.req}
        </div>
      </div>
    </div>
  );
}

export interface OfficerRowHeaderProps {
  o: SchedulingOfficer;
  weeklyHrs: number;
  unavailToday: boolean;
}

export function OfficerRowHeader({ o, weeklyHrs, unavailToday }: OfficerRowHeaderProps) {
  const sia = siaState(o.sia);
  const overCap = weeklyHrs > o.cap;
  return (
    <div
      style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: `1px solid ${tokens.color.ink100}`,
        borderRight: `1px solid ${tokens.color.ink200}`,
        background: unavailToday ? tokens.color.ink50 : "white",
        position: "sticky",
        left: 0,
        zIndex: 3,
        height: 72,
        boxSizing: "border-box",
        opacity: unavailToday ? 0.6 : 1,
      }}
    >
      <Avatar name={o.name} hue={o.hue} size={34} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
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
          </span>
          {sia && (
            <span
              title={sia.label}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 4px",
                borderRadius: 3,
                background: sia.tone === "danger" ? tokens.color.dangerSoft : tokens.color.warnSoft,
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
            fontSize: 11,
            color: tokens.color.ink500,
            marginTop: 1,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span>{o.role}</span>
          <span
            style={{
              color: overCap ? tokens.color.danger : tokens.color.ink500,
              fontWeight: overCap ? 600 : 400,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            · {weeklyHrs}h / {o.cap}h
          </span>
          {o.optOut && (
            <span
              style={{
                fontSize: 9,
                background: "#eef2ff",
                color: "#312e81",
                padding: "0 4px",
                borderRadius: 3,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              OPT-OUT
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
