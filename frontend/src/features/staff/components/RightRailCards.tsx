// Right-rail trio: PendingApprovalsCard, SIAExpiringCard, EmploymentMixCard.
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Card } from "../../../design-system/primitives/Card";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { SectionHeader } from "../../../design-system/primitives/SectionHeader";
import { tokens } from "../../../design-system/tokens";
import type { StaffUser } from "../../../services/userService";
import type {
  PendingStaffProfile,
  SIALicenseRecord,
} from "../hooks/useStaffData";

function fullNameOf(p: PendingStaffProfile): string {
  if (p.full_name) return p.full_name;
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.username || "Unnamed";
}

export interface PendingApprovalsCardProps {
  pending: PendingStaffProfile[];
  onReview: (profile: PendingStaffProfile) => void;
}

export function PendingApprovalsCard({
  pending,
  onReview,
}: PendingApprovalsCardProps) {
  return (
    <Card padding={20}>
      <SectionHeader
        title="Pending approvals"
        subtitle={
          pending.length === 0
            ? "Everyone is approved"
            : `${pending.length} waiting for review`
        }
      />
      {pending.length === 0 ? (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
            padding: "8px 0",
          }}
        >
          You're all caught up.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pending.slice(0, 5).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onReview(p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: `1px solid ${tokens.color.ink100}`,
                borderRadius: tokens.radius.md,
                background: "white",
                cursor: "pointer",
                textAlign: "left",
                transition: `background ${tokens.motion.fast}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.color.ink50;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
              }}
            >
              <Avatar name={fullNameOf(p)} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.color.ink900,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {fullNameOf(p)}
                </div>
                <div
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 11.5,
                    color: tokens.color.ink500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.email || "—"}
                </div>
              </div>
              <span
                style={{
                  fontFamily: tokens.font.display,
                  fontSize: 12,
                  fontWeight: 600,
                  color: tokens.color.warnInk,
                }}
              >
                Review →
              </span>
            </button>
          ))}
          {pending.length > 5 && (
            <div
              style={{
                fontFamily: tokens.font.body,
                fontSize: 11.5,
                color: tokens.color.ink500,
                textAlign: "center",
                marginTop: 2,
              }}
            >
              {pending.length - 5} more in the Pending tab
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function daysUntil(dateString: string): number {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function expiryTone(days: number): PillTone {
  if (days < 0) return "danger";
  if (days <= 30) return "warning";
  return "neutral";
}

export interface SIAExpiringCardProps {
  /** Map staff_profile id → display name (for active rows). */
  staffNameByProfileId: Map<number, string>;
  licenses: SIALicenseRecord[];
  onSelect: (staffProfileId: number) => void;
}

export function SIAExpiringCard({
  staffNameByProfileId,
  licenses,
  onSelect,
}: SIAExpiringCardProps) {
  const expiring = licenses
    .map((lic) => ({ lic, days: daysUntil(lic.expiry_date) }))
    .filter((row) => row.days <= 30)
    .sort((a, b) => a.days - b.days);

  return (
    <Card padding={20}>
      <SectionHeader
        title="SIA expiring"
        subtitle={
          expiring.length === 0 ? "Nothing in the next 30 days" : "Within 30 days"
        }
      />
      {expiring.length === 0 ? (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
            padding: "8px 0",
          }}
        >
          All licences are healthy.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expiring.slice(0, 5).map(({ lic, days }) => {
            const name = staffNameByProfileId.get(lic.staff_profile) ?? "Unknown staff";
            const tone = expiryTone(days);
            const label = days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`;
            return (
              <button
                key={lic.id}
                type="button"
                onClick={() => onSelect(lic.staff_profile)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  border: `1px solid ${tokens.color.ink100}`,
                  borderRadius: tokens.radius.md,
                  background: "white",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: `background ${tokens.motion.fast}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = tokens.color.ink50;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                }}
              >
                <Avatar name={name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: 13,
                      fontWeight: 600,
                      color: tokens.color.ink900,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: 11.5,
                      color: tokens.color.ink500,
                    }}
                  >
                    {lic.license_number}
                  </div>
                </div>
                <Pill tone={tone}>{label}</Pill>
              </button>
            );
          })}
          {expiring.length > 5 && (
            <div
              style={{
                fontFamily: tokens.font.body,
                fontSize: 11.5,
                color: tokens.color.ink500,
                textAlign: "center",
                marginTop: 2,
              }}
            >
              {expiring.length - 5} more
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export interface EmploymentMixCardProps {
  staff: StaffUser[];
}

function employmentLabel(et: unknown): string {
  if (et == null) return "Unspecified";
  if (typeof et === "string") return et;
  if (typeof et === "object" && "name" in (et as Record<string, unknown>)) {
    const v = (et as { name?: unknown }).name;
    return typeof v === "string" ? v : "Unspecified";
  }
  return "Unspecified";
}

export function EmploymentMixCard({ staff }: EmploymentMixCardProps) {
  const counts = new Map<string, number>();
  for (const s of staff) {
    const key = employmentLabel(s.employment_type);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const total = staff.length;
  const max = Math.max(1, ...items.map(([, n]) => n));

  return (
    <Card padding={20}>
      <SectionHeader
        title="Employment mix"
        subtitle={`${total} ${total === 1 ? "staff member" : "staff members"}`}
      />
      {items.length === 0 ? (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
            padding: "8px 0",
          }}
        >
          Invite staff to see the breakdown.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(([label, count]) => {
            const pct = (count / max) * 100;
            return (
              <div key={label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                    fontSize: 12.5,
                    fontFamily: tokens.font.body,
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
                    {count}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: tokens.color.ink100,
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: tokens.color.ink800,
                      opacity: 0.65,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
