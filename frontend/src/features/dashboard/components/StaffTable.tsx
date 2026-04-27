// StaffTable — ported 1:1 from project/dashboard.jsx:606-716.
import { useMemo, useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { DashboardStaff, StaffStatus } from "../data/mocks";

const STATUS_TONES: Record<StaffStatus, { tone: PillTone; label: string }> = {
  "on-shift": { tone: "positive", label: "On shift" },
  break: { tone: "info", label: "On break" },
  late: { tone: "warning", label: "Late" },
  "off-duty": { tone: "neutral", label: "Off duty" },
};

type Filter = "all" | "active" | "attention";

const TD_STYLE = { padding: "12px 16px", fontSize: 13, color: tokens.color.ink800 } as const;

const ghostBtnStyle = {
  display: "inline-flex" as const,
  alignItems: "center" as const,
  gap: 6,
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  padding: "6px 12px",
  borderRadius: 7,
  fontFamily: tokens.font.body,
  fontSize: 12,
  fontWeight: 500,
  color: tokens.color.ink800,
  cursor: "pointer",
};

export interface StaffTableProps {
  staff: DashboardStaff[];
}

export function StaffTable({ staff }: StaffTableProps) {
  const { palette } = useAccent();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "active") return staff.filter((s) => s.status === "on-shift" || s.status === "break");
    if (filter === "attention") return staff.filter((s) => s.status === "late" || s.expiresIn < 30);
    return staff;
  }, [staff, filter]);

  const tabs: [Filter, string, number][] = [
    ["all", "All staff", staff.length],
    ["active", "On duty", staff.filter((s) => s.status === "on-shift" || s.status === "break").length],
    ["attention", "Needs attention", staff.filter((s) => s.status === "late" || s.expiresIn < 30).length],
  ];

  return (
    <div
      style={{
        background: "white",
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.color.ink200}`,
        padding: 0,
        fontFamily: tokens.font.body,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "20px 20px 0" }}>
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
              Staff roster
            </h3>
            <div style={{ fontSize: 12.5, color: tokens.color.ink500, marginTop: 2 }}>
              SIA-licensed personnel currently in the system
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={ghostBtnStyle}>
              <Icon name="filter" size={14} /> Filters
            </button>
            <button type="button" style={ghostBtnStyle}>
              <Icon name="download" size={14} /> Export
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "0 20px",
          borderBottom: `1px solid ${tokens.color.ink200}`,
        }}
      >
        {tabs.map(([k, label, count]) => {
          const active = filter === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "10px 4px",
                marginRight: 18,
                fontFamily: tokens.font.body,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? palette.primary : tokens.color.ink600,
                borderBottom: active ? `2px solid ${palette.primary}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {label}
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: active ? palette.primary : tokens.color.ink500,
                  background: active ? palette.soft : tokens.color.ink100,
                  padding: "1px 7px",
                  borderRadius: 999,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: tokens.font.body }}>
          <thead>
            <tr style={{ background: tokens.color.ink50 }}>
              {["Officer", "Role", "Assignment", "Status", "SIA License", "Hours wk", "Rating", ""].map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: i === 5 || i === 6 ? "right" : "left",
                      padding: "10px 16px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: tokens.color.ink600,
                      borderBottom: `1px solid ${tokens.color.ink200}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const st = STATUS_TONES[s.status];
              const licTone: PillTone = s.expiresIn < 14 ? "danger" : s.expiresIn < 60 ? "warning" : "neutral";
              return (
                <tr
                  key={s.id}
                  style={{ borderBottom: `1px solid ${tokens.color.ink100}`, transition: "background .1s" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.color.ink50;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={TD_STYLE}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={s.name} hue={s.avatarHue} size={32} />
                      <div style={{ fontWeight: 600, color: tokens.color.ink900, fontSize: 13.5 }}>
                        {s.name}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...TD_STYLE, color: tokens.color.ink800 }}>{s.role}</td>
                  <td style={{ ...TD_STYLE, color: tokens.color.ink600 }}>{s.venue}</td>
                  <td style={TD_STYLE}>
                    <Pill tone={st.tone} dot>
                      {st.label}
                    </Pill>
                  </td>
                  <td style={TD_STYLE}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: tokens.color.ink800 }}>
                        {s.license}
                      </span>
                      <Pill tone={licTone}>
                        {s.expiresIn < 14
                          ? `${s.expiresIn}d left`
                          : s.expiresIn < 60
                            ? `${s.expiresIn}d`
                            : "Valid"}
                      </Pill>
                    </div>
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: tokens.color.ink900,
                    }}
                  >
                    {s.hours}h
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: palette.primary, fontSize: 13 }}>★</span>
                      <span style={{ fontWeight: 600, color: tokens.color.ink900, fontSize: 13 }}>
                        {s.rating.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>
                    <button type="button" style={{ ...ghostBtnStyle, padding: "5px 8px" }} aria-label="Row actions">
                      <Icon name="more" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
