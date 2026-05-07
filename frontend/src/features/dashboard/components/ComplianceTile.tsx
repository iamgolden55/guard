// ComplianceTile — ported from project/dashboard.jsx:774-817.
// Each row in "Expiring soon" is clickable → modal with the officer's
// full SIA compliance details.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Modal } from "../../../design-system/primitives/Modal";
import { Pill } from "../../../design-system/primitives/Pill";
import { tokens } from "../../../design-system/tokens";
import type { DashboardStaff } from "../data/mocks";

const ROW_LIMIT = 5;

export interface ComplianceTileProps {
  staff: DashboardStaff[];
}

export function ComplianceTile({ staff }: ComplianceTileProps) {
  const { palette } = useAccent();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<DashboardStaff | null>(null);

  const expiringSoon = staff
    .filter((s) => s.expiresIn < 60)
    .sort((a, b) => a.expiresIn - b.expiresIn);
  const total = staff.length;
  const valid = staff.filter((s) => s.expiresIn >= 60).length;
  const pct = total ? Math.round((valid / total) * 100) : 0;

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
      <div style={{ marginBottom: 16 }}>
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
          SIA compliance
        </h3>
        <div
          style={{ fontSize: 12.5, color: tokens.color.ink500, marginTop: 2 }}
        >
          {valid} of {total} officers in good standing
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}
        >
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke={tokens.color.ink100}
              strokeWidth="10"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke={palette.primary}
              strokeWidth="10"
              strokeDasharray={`${(pct / 100) * 251.3} 251.3`}
              strokeDashoffset="0"
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 22,
              color: tokens.color.ink900,
              letterSpacing: "-0.02em",
            }}
          >
            {pct}%
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: tokens.color.ink600,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Expiring soon
          </div>
          {expiringSoon.slice(0, ROW_LIMIT).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: `1px dashed ${tokens.color.ink100}`,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: tokens.font.body,
              }}
            >
              <Avatar name={s.name} hue={s.avatarHue} size={22} />
              <div
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  color: tokens.color.ink900,
                  fontWeight: 500,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.name}
              </div>
              <Pill tone={s.expiresIn < 14 ? "danger" : "warning"}>
                {s.expiresIn}d
              </Pill>
            </button>
          ))}
          {expiringSoon.length === 0 && (
            <div style={{ fontSize: 12.5, color: tokens.color.ink500 }}>
              No expirations in the next 60 days
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ""}
        description={selected ? `${selected.role} · ${selected.venue}` : ""}
        size="md"
        footer={
          selected ? (
            <button
              type="button"
              onClick={() => {
                navigate(`/staff?focus=${selected.id}`);
                setSelected(null);
              }}
              style={{
                background: palette.primary,
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 8,
                fontFamily: tokens.font.body,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              View full profile
            </button>
          ) : null
        }
      >
        {selected && <ComplianceDetails staff={selected} />}
      </Modal>
    </div>
  );
}

function ComplianceDetails({ staff }: { staff: DashboardStaff }) {
  const tone =
    staff.expiresIn < 14
      ? "danger"
      : staff.expiresIn < 60
        ? "warning"
        : "neutral";
  const status =
    staff.expiresIn < 0
      ? "Expired"
      : staff.expiresIn < 14
        ? "Expires within 2 weeks"
        : staff.expiresIn < 60
          ? "Expiring soon"
          : "Valid";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <DetailRow label="Licence" value={staff.license} />
      <DetailRow
        label="Status"
        value={
          <Pill tone={tone}>
            {status}
            {staff.expiresIn >= 0 ? ` · ${staff.expiresIn}d left` : ""}
          </Pill>
        }
      />
      <DetailRow label="Role" value={staff.role} />
      <DetailRow label="Current assignment" value={staff.venue} />
      <DetailRow label="Hours this week" value={`${staff.hours}h`} />
    </div>
  );
}

function DetailRow({
  label,
  value,
}: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 12,
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <div
        style={{
          color: tokens.color.ink600,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: 11,
        }}
      >
        {label}
      </div>
      <div style={{ color: tokens.color.ink900, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
