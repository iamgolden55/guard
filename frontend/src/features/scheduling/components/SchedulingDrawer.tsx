// SchedulingDrawer — right-edge slide-over for shift detail.
import { useEffect, type ReactNode } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  fmtH,
  fmtHrs,
  fmtRange,
  hrs,
  siaState,
  type Shift,
  type Violation,
} from "../data/mocks";
import { useScheduling } from "../state/SchedulingState";

export interface SchedulingDrawerProps {
  shift: Shift | null;
  onClose: () => void;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
}

export function SchedulingDrawer({ shift, onClose, onEdit, onDelete }: SchedulingDrawerProps) {
  const { palette } = useAccent();
  const { officerById, venueById, week, unassign, publishShift } = useScheduling();

  useEffect(() => {
    if (!shift) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shift, onClose]);

  if (!shift) return null;
  const venue = venueById(shift.venueId);
  const officer = officerById(shift.officerId);
  const day = week.days[shift.day];
  if (!venue || !day) return null;

  const hardViol = (shift.violations || []).filter((v) => v.tier === "hard");
  const softViol = (shift.violations || []).filter((v) => v.tier === "soft");
  const sia = officer ? siaState(officer.sia) : null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(32,31,30,0.28)",
          zIndex: tokens.z.modal - 1,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: "92vw",
          background: "white",
          zIndex: tokens.z.modal,
          borderLeft: `1px solid ${tokens.color.ink200}`,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 30px -12px rgba(32,31,30,0.2)",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: `1px solid ${tokens.color.ink200}`,
            background: venue.color,
            color: "white",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: 6,
              background: "rgba(255,255,255,0.18)",
              border: "none",
              color: "white",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="x" size={16} />
          </button>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            Shift · {shift.id.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: "-0.015em",
              marginTop: 3,
            }}
          >
            {venue.name}
          </div>
          <div
            style={{
              fontSize: 12.5,
              opacity: 0.9,
              marginTop: 5,
              display: "flex",
              gap: 12,
              fontFamily: tokens.font.mono,
            }}
          >
            <span>
              {day.day} {day.dd} Apr
            </span>
            <span>
              {fmtRange(shift.start, shift.end)} · {fmtHrs(hrs(shift.start, shift.end))}h
            </span>
            <span>{venue.area}</span>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <StatusChip shift={shift} />
            {day.bankHoliday && <Chip icon="pin" label="Bank holiday" />}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {(hardViol.length > 0 || softViol.length > 0) && (
            <Section label="Violations">
              {hardViol.map((v, i) => (
                <ViolRow key={`h${i}`} v={v} />
              ))}
              {softViol.map((v, i) => (
                <ViolRow key={`s${i}`} v={v} />
              ))}
            </Section>
          )}

          <Section label="Assigned officer">
            {officer ? (
              <div style={{ display: "flex", gap: 12, padding: "10px 0" }}>
                <Avatar name={officer.name} hue={officer.hue} size={42} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: tokens.color.ink900 }}>
                    {officer.name}
                  </div>
                  <div style={{ fontSize: 12, color: tokens.color.ink600, marginTop: 2 }}>
                    {officer.role} · {officer.sia.level}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leading={<Icon name="edit" size={12} />}
                  onClick={() => {
                    unassign(shift.id);
                    onClose();
                  }}
                >
                  Unassign
                </Button>
              </div>
            ) : (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 8,
                  border: `1.5px dashed ${tokens.color.ink500}`,
                  background: tokens.color.ink50,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: tokens.color.ink600 }}>
                  Open — no officer assigned
                </div>
                <div style={{ fontSize: 11.5, color: tokens.color.ink500, marginTop: 2 }}>
                  Needs {venue.req} licence
                </div>
                <Button
                  variant="primary"
                  accent={palette}
                  size="sm"
                  style={{ marginTop: 10 }}
                  leading={<Icon name="user-plus" size={12} />}
                  onClick={onClose}
                >
                  Drag a Staff card to assign
                </Button>
              </div>
            )}

            {officer && sia && (
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: sia.tone === "danger" ? tokens.color.dangerSoft : tokens.color.warnSoft,
                  border: `1px solid ${sia.tone === "danger" ? "#fbd0d4" : "#fad48a"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="shield" size={14} />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: sia.tone === "danger" ? tokens.color.dangerInk : tokens.color.warnInk,
                    }}
                  >
                    SIA {officer.sia.level} · {sia.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: sia.tone === "danger" ? tokens.color.dangerInk : tokens.color.warnInk,
                    marginTop: 3,
                    fontFamily: tokens.font.mono,
                    opacity: 0.85,
                  }}
                >
                  {officer.sia.no}
                </div>
              </div>
            )}
          </Section>

          <Section label="Schedule">
            <Field label="Start">
              <code>{fmtH(shift.start)}</code>
            </Field>
            <Field label="End">
              <code>
                {fmtH(shift.end)}
                {shift.end > 24 && (
                  <span style={{ color: tokens.color.danger, marginLeft: 5 }}>+1 day</span>
                )}
              </code>
            </Field>
            <Field label="Duration">
              <code>{fmtHrs(hrs(shift.start, shift.end))}h</code>
            </Field>
            <Field label="Break">30 min (unpaid)</Field>
          </Section>

          <Section label="Status">
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: tokens.color.ink50,
                border: `1px solid ${tokens.color.ink200}`,
                fontSize: 12.5,
                color: tokens.color.ink700,
                lineHeight: 1.5,
              }}
            >
              {shift.status === "open" && !shift.published && (
                <>
                  This shift is a <b>draft open shift</b>. Officers can't see it
                  yet. Publish to broadcast it as a claimable shift.
                </>
              )}
              {shift.status === "open" && shift.published && (
                <>
                  This shift is <b>open</b> and broadcast — eligible officers can
                  claim it on their app.
                </>
              )}
              {shift.status !== "open" && !shift.published && (
                <>
                  Assignment is a <b>draft</b>. {officer?.name.split(" ")[0] ?? "The officer"}
                  {" "}hasn't been notified yet. Publish to send.
                </>
              )}
              {shift.status !== "open" && shift.published && (
                <>
                  Published — {officer?.name.split(" ")[0] ?? "the officer"} has
                  been notified.
                </>
              )}
            </div>
          </Section>
        </div>

        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${tokens.color.ink200}`,
            display: "flex",
            gap: 10,
            alignItems: "center",
            background: tokens.color.ink50,
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            leading={<Icon name="x" size={12} />}
            onClick={() => onDelete(shift)}
          >
            Delete
          </Button>
          <div style={{ flex: 1 }} />
          <Button
            variant="secondary"
            leading={<Icon name="edit" size={12} />}
            onClick={() => onEdit(shift)}
          >
            Edit shift
          </Button>
          {!shift.published && (
            <Button
              variant="primary"
              accent={palette}
              leading={<Icon name="send" size={12} />}
              disabled={hardViol.length > 0}
              onClick={() => {
                publishShift(shift.id);
                onClose();
              }}
            >
              Publish shift
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: tokens.color.ink600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: `1px solid ${tokens.color.ink100}`,
        fontSize: 12.5,
      }}
    >
      <span style={{ color: tokens.color.ink600 }}>{label}</span>
      <span
        style={{
          color: tokens.color.ink900,
          fontWeight: 500,
          fontFamily: tokens.font.mono,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function Chip({
  icon,
  label,
  bg = "rgba(255,255,255,0.18)",
  fg = "white",
}: {
  icon: IconName;
  label: string;
  bg?: string;
  fg?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 4,
        background: bg,
        color: fg,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      <Icon name={icon} size={11} /> {label}
    </span>
  );
}

function StatusChip({ shift }: { shift: Shift }) {
  if (shift.status === "open")
    return <Chip icon="alert" label="OPEN · NEEDS COVER" bg="white" fg={tokens.color.ink900} />;
  if (!shift.published) return <Chip icon="edit" label="DRAFT — NOT PUBLISHED" />;
  return <Chip icon="check" label="PUBLISHED" />;
}

function ViolRow({ v }: { v: Violation }) {
  const hard = v.tier === "hard";
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        background: hard ? tokens.color.dangerSoft : tokens.color.warnSoft,
        border: `1px solid ${hard ? "#fbd0d4" : "#fad48a"}`,
        borderRadius: 8,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          flexShrink: 0,
          background: hard ? tokens.color.danger : tokens.color.warn,
          color: "white",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name={hard ? "shield-x" : "alert"} size={12} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: hard ? tokens.color.dangerInk : tokens.color.warnInk,
            letterSpacing: "0.02em",
          }}
        >
          {hard ? "HARD BLOCK" : "SOFT WARNING"} · {v.code}
        </div>
        <div
          style={{
            fontSize: 12,
            color: hard ? tokens.color.dangerInk : tokens.color.warnInk,
            opacity: 0.92,
            marginTop: 2,
          }}
        >
          {v.msg}
        </div>
      </div>
    </div>
  );
}

