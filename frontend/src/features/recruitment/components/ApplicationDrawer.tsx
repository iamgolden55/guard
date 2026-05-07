// ApplicationDrawer — slide-over with stacked sections (NOT sub-tabs).
// Mount/visible state machine + 220ms enter/exit lifted from
// features/attendance/components/AttendanceDrawer.tsx.
import { format, parseISO } from "date-fns";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { RecruitmentApplication } from "../../../services/recruitmentService";

const STATUS_TONE: Record<RecruitmentApplication["status"], PillTone> = {
  pending: "warning",
  approved: "positive",
  rejected: "danger",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy 'at' HH:mm");
  } catch {
    return iso;
  }
}

function yesNo(value: boolean | undefined) {
  return value ? "Yes" : "No";
}

function reviewerName(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const obj = details as Record<string, unknown>;
  const first = typeof obj.first_name === "string" ? obj.first_name : "";
  const last = typeof obj.last_name === "string" ? obj.last_name : "";
  const username = typeof obj.username === "string" ? obj.username : "";
  const full = `${first} ${last}`.trim();
  return full || username || null;
}

function convertedUserName(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const obj = details as Record<string, unknown>;
  const first = typeof obj.first_name === "string" ? obj.first_name : "";
  const last = typeof obj.last_name === "string" ? obj.last_name : "";
  const username = typeof obj.username === "string" ? obj.username : "";
  const full = `${first} ${last}`.trim();
  return full || username || null;
}

export interface ApplicationDrawerProps {
  open: boolean;
  application: RecruitmentApplication | null;
  onClose: () => void;
  onApprove: (app: RecruitmentApplication) => void;
  onRejectClick: (app: RecruitmentApplication) => void;
  onConvertClick: (app: RecruitmentApplication) => void;
  isMutating: boolean;
}

export function ApplicationDrawer({
  open,
  application,
  onClose,
  onApprove,
  onRejectClick,
  onConvertClick,
  isMutating,
}: ApplicationDrawerProps) {
  const [mount, setMount] = useState(open);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    if (open) {
      setMount(true);
      requestAnimationFrame(() => setVis(true));
    } else {
      setVis(false);
      const t = setTimeout(() => setMount(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!mount) return null;

  const a = application;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: tokens.z.modal,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: vis ? "rgba(32,31,30,0.40)" : "rgba(32,31,30,0)",
          backdropFilter: vis ? "blur(2px)" : "none",
          transition: "background .2s",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 560,
          maxWidth: "100vw",
          height: "100%",
          background: "white",
          boxShadow: "-24px 0 48px -16px rgba(32,31,30,0.22)",
          transform: vis ? "translateX(0)" : "translateX(40px)",
          opacity: vis ? 1 : 0,
          transition: "transform .25s ease, opacity .2s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!a ? (
          <div />
        ) : (
          <>
            <Header app={a} onClose={onClose} />
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 24px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
                background: tokens.color.ink50,
              }}
            >
              <PersonalSection app={a} />
              <SIASection app={a} />
              <AvailabilitySection app={a} />
              <ComplianceSection app={a} />
              <AdminActivitySection app={a} />
            </div>
            <FooterActions
              app={a}
              onApprove={onApprove}
              onRejectClick={onRejectClick}
              onConvertClick={onConvertClick}
              isMutating={isMutating}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header({
  app,
  onClose,
}: {
  app: RecruitmentApplication;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        padding: "20px 24px 16px",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        background: "white",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <Avatar name={app.full_name} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 18,
            color: tokens.color.ink900,
            letterSpacing: "-0.015em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {app.full_name}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {app.email} · {app.phone_number}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <Pill tone={STATUS_TONE[app.status]} dot>
            {app.status}
          </Pill>
          {app.employment_type_details?.name && (
            <Pill tone="neutral">{app.employment_type_details.name}</Pill>
          )}
          {app.has_sia_licence && !app.licence_suspended_revoked && (
            <Pill tone="positive" dot>
              SIA · valid
            </Pill>
          )}
          {app.has_sia_licence && app.licence_suspended_revoked && (
            <Pill tone="danger" dot>
              SIA · suspended
            </Pill>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: tokens.color.ink100,
          border: "none",
          color: tokens.color.ink600,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────
const SECTION_STYLE: CSSProperties = {
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.lg,
  padding: 18,
};

function SectionTitle({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: tokens.color.ink100,
          color: tokens.color.ink700,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={13} />
      </span>
      <span
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 13,
          color: tokens.color.ink900,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.ink900,
          wordBreak: "break-word",
        }}
      >
        {value || <span style={{ color: tokens.color.ink500 }}>—</span>}
      </div>
    </div>
  );
}

function GridTwo({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px 20px",
      }}
    >
      {children}
    </div>
  );
}

function PersonalSection({ app }: { app: RecruitmentApplication }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="user" label="Personal & contact" />
      <GridTwo>
        <KV label="Full name" value={app.full_name} />
        <KV label="Date of birth" value={fmtDate(app.date_of_birth)} />
        <KV label="Email" value={app.email} />
        <KV label="Phone" value={app.phone_number} />
      </GridTwo>
      <div style={{ marginTop: 12 }}>
        <KV
          label="Address"
          value={
            app.home_address || app.postcode
              ? `${app.home_address}${app.postcode ? `, ${app.postcode}` : ""}`
              : ""
          }
        />
      </div>
    </div>
  );
}

function SIASection({ app }: { app: RecruitmentApplication }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="shield" label="SIA & qualifications" />
      <GridTwo>
        <KV label="Holds SIA licence" value={yesNo(app.has_sia_licence)} />
        {app.has_sia_licence && (
          <>
            <KV label="Licence number" value={app.sia_licence_number} />
            <KV label="Expiry" value={fmtDate(app.licence_expiry_date)} />
            <KV
              label="Suspended / revoked"
              value={yesNo(app.licence_suspended_revoked)}
            />
          </>
        )}
      </GridTwo>
      {app.has_sia_licence && app.licence_types?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <KV
            label="Licence types"
            value={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {app.licence_types.map((t) => (
                  <Pill key={t} tone="neutral">
                    {t}
                  </Pill>
                ))}
              </div>
            }
          />
        </div>
      )}
      {app.licence_suspended_revoked && app.licence_suspension_details && (
        <div style={{ marginTop: 12 }}>
          <KV
            label="Suspension details"
            value={app.licence_suspension_details}
          />
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <GridTwo>
          <KV
            label="Has security experience"
            value={yesNo(app.has_security_experience)}
          />
          {app.has_security_experience && (
            <KV
              label="Experience details"
              value={app.security_experience_details}
            />
          )}
        </GridTwo>
      </div>
      {app.certifications?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <KV
            label="Certifications"
            value={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {app.certifications.map((c) => (
                  <Pill key={c} tone="neutral">
                    {c}
                  </Pill>
                ))}
              </div>
            }
          />
        </div>
      )}
      {app.other_certification_details && (
        <div style={{ marginTop: 12 }}>
          <KV
            label="Other certifications"
            value={app.other_certification_details}
          />
        </div>
      )}
    </div>
  );
}

function AvailabilitySection({ app }: { app: RecruitmentApplication }) {
  const availability: string[] = [];
  if (app.availability_days) availability.push("Days");
  if (app.availability_nights) availability.push("Nights");
  if (app.availability_weekends) availability.push("Weekends");
  if (app.availability_holidays) availability.push("Holidays");

  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="calendar" label="Availability & employment" />
      <GridTwo>
        <KV
          label="Employment type"
          value={app.employment_type_details?.name}
        />
        <KV label="Hours per week" value={app.hours_per_week} />
        <KV
          label="Available shifts"
          value={
            availability.length === 0 ? null : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {availability.map((slot) => (
                  <Pill key={slot} tone="neutral">
                    {slot}
                  </Pill>
                ))}
              </div>
            )
          }
        />
        <KV label="Willing to travel" value={yesNo(app.willing_to_travel)} />
        <KV label="Has transport" value={yesNo(app.has_transport)} />
        <KV label="Has commitments" value={yesNo(app.has_commitments)} />
      </GridTwo>
      {app.has_commitments && app.commitments_details && (
        <div style={{ marginTop: 12 }}>
          <KV label="Commitments details" value={app.commitments_details} />
        </div>
      )}
    </div>
  );
}

function ComplianceSection({ app }: { app: RecruitmentApplication }) {
  const sig = app.digital_signature;
  const isDataUrl = typeof sig === "string" && sig.startsWith("data:");
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="lock" label="Compliance" />
      <GridTwo>
        <KV
          label="Eligible to work in UK"
          value={yesNo(app.eligible_to_work_uk)}
        />
        <KV
          label="Has criminal convictions"
          value={yesNo(app.has_criminal_convictions)}
        />
      </GridTwo>
      {app.has_criminal_convictions && app.criminal_convictions_details && (
        <div style={{ marginTop: 12 }}>
          <KV
            label="Conviction details"
            value={app.criminal_convictions_details}
          />
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <KV
          label="Digital signature"
          value={
            !sig ? null : isDataUrl ? (
              <img
                src={sig}
                alt="Applicant signature"
                style={{
                  maxWidth: 220,
                  maxHeight: 80,
                  background: "white",
                  border: `1px solid ${tokens.color.ink200}`,
                  borderRadius: 6,
                  padding: 4,
                }}
              />
            ) : (
              <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                {sig}
              </span>
            )
          }
        />
      </div>
    </div>
  );
}

function AdminActivitySection({ app }: { app: RecruitmentApplication }) {
  const reviewer = reviewerName(app.reviewed_by_details);
  const convertedTo = convertedUserName(app.converted_user_details);
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="history" label="Admin activity" />
      <GridTwo>
        <KV label="Applied" value={fmtDateTime(app.application_date ?? app.created_at)} />
        <KV label="Last update" value={fmtDateTime(app.updated_at)} />
        <KV label="Reviewed by" value={reviewer} />
        <KV label="Reviewed at" value={fmtDateTime(app.reviewed_at)} />
      </GridTwo>
      {app.admin_notes && (
        <div style={{ marginTop: 12 }}>
          <KV label="Admin notes" value={app.admin_notes} />
        </div>
      )}
      {app.converted_to_user && (
        <div style={{ marginTop: 12 }}>
          <KV
            label="Converted to user"
            value={
              <Pill tone="info" dot>
                {convertedTo ?? `User #${app.converted_to_user}`}
              </Pill>
            }
          />
        </div>
      )}
    </div>
  );
}

// ── Footer action bar ──────────────────────────────────────────────────────
interface FooterActionsProps {
  app: RecruitmentApplication;
  onApprove: (app: RecruitmentApplication) => void;
  onRejectClick: (app: RecruitmentApplication) => void;
  onConvertClick: (app: RecruitmentApplication) => void;
  isMutating: boolean;
}

function FooterActions({
  app,
  onApprove,
  onRejectClick,
  onConvertClick,
  isMutating,
}: FooterActionsProps) {
  const alreadyConverted = app.converted_to_user != null;

  return (
    <div
      style={{
        padding: "14px 24px",
        background: "white",
        borderTop: `1px solid ${tokens.color.ink200}`,
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
      }}
    >
      {app.status === "pending" && (
        <>
          <Button
            variant="ghost"
            onClick={() => onRejectClick(app)}
            disabled={isMutating}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            onClick={() => onApprove(app)}
            disabled={isMutating}
          >
            {isMutating ? "Working…" : "Approve"}
          </Button>
        </>
      )}

      {app.status === "approved" &&
        (alreadyConverted ? (
          <Pill tone="info" dot>
            Already converted
          </Pill>
        ) : (
          <Button
            variant="primary"
            onClick={() => onConvertClick(app)}
            disabled={isMutating}
          >
            {isMutating ? "Working…" : "Convert to user"}
          </Button>
        ))}

      {app.status === "rejected" && (
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          Application rejected{app.reviewed_at ? ` on ${fmtDate(app.reviewed_at)}` : ""}.
        </span>
      )}
    </div>
  );
}
