// AttendanceDrawer — right-edge drawer with shift detail, time
// adjustment editor, and audit trail. Ported 1:1 from
// project/attendance-drawer.jsx.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  fmtHr,
  fmtRange2,
  fmtVar,
  ribbonKey,
  RIBBON_COLORS,
  type AttendanceShift,
} from "../data/mocks";
import { useAttendance } from "../AttendanceContext";

const STATUS_LABEL: Record<AttendanceShift["status"], string> = {
  on_duty: "On duty",
  no_show: "No-show",
  missing_out: "Missing check-out",
  pending_approval: "Pending approval",
  early_out: "Early check-out",
  upcoming: "Upcoming",
  completed: "Completed",
  approved: "Approved",
  late: "Late",
  geofence_fail: "Geofence",
};

export interface AttendanceDrawerProps {
  open: boolean;
  shift: AttendanceShift | null;
  onClose: () => void;
}

export function AttendanceDrawer({ open, shift, onClose }: AttendanceDrawerProps) {
  const { palette } = useAccent();
  const {
    officerById,
    venueById,
    adjustments,
    isLoadingAdjustments,
    adjustTime,
    isAdjusting,
    approveShift,
    isApproving,
  } = useAttendance();
  const [mount, setMount] = useState(open);
  const [vis, setVis] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [adjIn, setAdjIn] = useState("");
  const [adjOut, setAdjOut] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  useEffect(() => {
    setEditing(false);
    setReason("");
    setAdjIn("");
    setAdjOut("");
  }, [shift?.id]);

  if (!mount) return null;

  const s = shift;
  const o = s ? officerById(s.oid) : undefined;
  const v = s ? venueById(s.vid) : undefined;
  const ribKey = s ? ribbonKey(s) : "on_duty";
  const headerColor = s
    ? RIBBON_COLORS[ribKey].bg !== "transparent"
      ? RIBBON_COLORS[ribKey].bg
      : tokens.color.ink600
    : tokens.color.ink600;

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
          width: 520,
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
        {!s || !v ? (
          <div />
        ) : (
          <>
            <div
              style={{
                background: headerColor,
                color: "white",
                padding: "20px 22px 18px",
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
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.15)",
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
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: 0.8,
                }}
              >
                {STATUS_LABEL[s.status] || s.status} {s.geofence_fail && "· Geofence"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                {o ? (
                  <Avatar name={o.name} hue={o.hue} size={44} />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: "rgba(255,255,255,0.2)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name="user-plus" size={20} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: tokens.font.display,
                      fontWeight: 700,
                      fontSize: 19,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {o?.name || "Unassigned"}
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>
                    {o?.role} {o && `· SIA ${o.sia}`}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 14,
                  fontSize: 12.5,
                  opacity: 0.95,
                }}
              >
                <Icon name="map-pin" size={13} /> {v.name} · {v.area}
                <span style={{ opacity: 0.5 }}>·</span>
                <Icon name="clock" size={13} /> {fmtRange2(s.sch_start, s.sch_end)}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 24px" }}>
              <div
                style={{
                  border: `1px solid ${tokens.color.ink200}`,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 18,
                }}
              >
                <SectionLabel>Scheduled vs actual</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <TimeBlock
                    label="Scheduled"
                    sub="Plan"
                    inT={fmtHr(s.sch_start)}
                    outT={fmtHr(s.sch_end)}
                    muted
                  />
                  <TimeBlock
                    label="Actual"
                    sub={s.act_end ? "Recorded" : s.act_start ? "Live" : "Not yet"}
                    inT={s.act_start != null ? fmtHr(s.act_start) : "—"}
                    outT={s.act_end != null ? fmtHr(s.act_end) : s.act_start ? "—" : "—"}
                    tone={
                      ribKey === "no_show"
                        ? "danger"
                        : ribKey === "late" || ribKey === "early_out"
                          ? "warn"
                          : "ok"
                    }
                  />
                </div>
                {s.late_min != null && s.late_min !== 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: tokens.color.ink50,
                      fontSize: 12,
                      color: tokens.color.ink600,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Icon name="clock" size={12} />
                    {s.late_min > 0
                      ? `Checked in ${fmtVar(s.late_min).replace("+", "")} after scheduled start.`
                      : `Checked in ${Math.abs(s.late_min)}m early.`}
                  </div>
                )}
                {s.status === "early_out" && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: tokens.color.warnSoft,
                      fontSize: 12,
                      color: tokens.color.warnInk,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Icon name="clock" size={12} /> Checked out {s.early_min}m before scheduled end.
                  </div>
                )}
              </div>

              <SectionLabel>Verification</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 18,
                }}
              >
                <VerifyTile
                  icon="map-pin"
                  label="GPS"
                  state={s.gps_ok === true ? "ok" : s.gps_ok === false ? "bad" : "unknown"}
                  value={
                    s.gps_ok === true
                      ? `${s.dist_m}m from venue`
                      : s.gps_ok === false
                        ? `${s.dist_m}m off-site`
                        : "Not recorded"
                  }
                />
                <VerifyTile
                  icon="eye"
                  label="Photo"
                  state={s.photo === true ? "ok" : s.photo === false ? "bad" : "unknown"}
                  value={
                    s.photo === true ? "Selfie captured" : s.photo === false ? "Missing" : "—"
                  }
                />
                <VerifyTile
                  icon="shield"
                  label="Patrol checks"
                  state={s.patrol && s.patrol[0] === s.patrol[1] ? "ok" : !s.patrol ? "unknown" : "bad"}
                  value={s.patrol ? `${s.patrol[0]} of ${s.patrol[1]} complete` : "—"}
                />
                <VerifyTile
                  icon="pause"
                  label="Breaks taken"
                  state="ok"
                  value={s.breaks != null ? `${s.breaks} break${s.breaks === 1 ? "" : "s"}` : "—"}
                />
              </div>

              {s.note && (
                <>
                  <SectionLabel>Notes</SectionLabel>
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "#fffaf6",
                      border: "1px solid #fde2c7",
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: tokens.color.ink600,
                      lineHeight: 1.5,
                      marginBottom: 18,
                    }}
                  >
                    {s.note}
                  </div>
                </>
              )}

              <div
                style={{
                  border: `1px solid ${tokens.color.ink200}`,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: editing ? 14 : 0,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tokens.color.ink900 }}>
                      Time adjustment
                    </div>
                    <div style={{ fontSize: 11.5, color: tokens.color.ink500, marginTop: 2 }}>
                      {s.act_start == null
                        ? "Officer on-site but couldn't check in? Mark present and add a reason."
                        : "Override actual times for payroll. Audit-logged."}
                    </div>
                  </div>
                  {!editing && (
                    <div style={{ display: "flex", gap: 6 }}>
                      {s.act_start == null && (
                        <Button
                          variant="primary"
                          size="sm"
                          accent={palette}
                          leading={<Icon name="check" size={12} />}
                          onClick={() => {
                            const now = new Date();
                            const hh = String(now.getHours()).padStart(2, "0");
                            const mm = String(now.getMinutes()).padStart(2, "0");
                            setAdjIn(`${hh}:${mm}`);
                            // Leave check-out blank — shift still in progress.
                            setAdjOut("");
                            setReason(
                              "Manager attested presence — officer on-site, app/phone unavailable. ",
                            );
                            setEditing(true);
                          }}
                        >
                          Mark present
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        leading={<Icon name="edit" size={12} />}
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
                {editing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <FieldGroup label="Adjusted check-in">
                        <input
                          type="time"
                          value={
                            adjIn ||
                            (s.act_start != null ? fmtHr(s.act_start) : fmtHr(s.sch_start))
                          }
                          onChange={(e) => setAdjIn(e.target.value)}
                          style={inputCss}
                        />
                      </FieldGroup>
                      <FieldGroup
                        label={
                          s.act_end == null
                            ? "Adjusted check-out (optional)"
                            : "Adjusted check-out"
                        }
                      >
                        <input
                          type="time"
                          value={
                            adjOut !== ""
                              ? adjOut
                              : s.act_end != null
                                ? fmtHr(s.act_end)
                                : ""
                          }
                          onChange={(e) => setAdjOut(e.target.value)}
                          style={inputCss}
                        />
                        {s.act_end == null && adjOut === "" && (
                          <div
                            style={{
                              fontSize: 11,
                              color: tokens.color.ink500,
                              marginTop: 4,
                            }}
                          >
                            Leave blank if shift still in progress
                          </div>
                        )}
                      </FieldGroup>
                    </div>
                    <FieldGroup label="Reason (required)">
                      <textarea
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. App outage between 10:00–10:30; confirmed via radio"
                        style={{ ...inputCss, resize: "vertical", lineHeight: 1.5 }}
                      />
                    </FieldGroup>
                    {submitError && (
                      <div
                        style={{
                          fontSize: 12,
                          color: tokens.color.dangerInk,
                          background: tokens.color.dangerSoft,
                          padding: "8px 10px",
                          borderRadius: 6,
                        }}
                      >
                        {submitError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        accent={palette}
                        disabled={!reason || isAdjusting || !s}
                        onClick={async () => {
                          if (!s) return;
                          setSubmitError(null);
                          try {
                            const inT =
                              adjIn ||
                              (s.act_start != null ? fmtHr(s.act_start) : fmtHr(s.sch_start));

                            // Construct the ISO with the user's local TZ baked in,
                            // otherwise the backend treats "2026-04-29T12:20:00" as
                            // naive UTC and the display ends up an hour ahead.
                            const today = new Date();
                            const [hh1, mm1] = inT.split(":").map(Number);
                            const startLocal = new Date(
                              today.getFullYear(),
                              today.getMonth(),
                              today.getDate(),
                              hh1,
                              mm1,
                              0,
                            );
                            const startIso = startLocal.toISOString();

                            const outT = adjOut.trim();
                            let endIso: string | null = null;
                            let hours = 0;
                            if (outT) {
                              const [hh2, mm2] = outT.split(":").map(Number);
                              const endLocal = new Date(
                                today.getFullYear(),
                                today.getMonth(),
                                today.getDate(),
                                hh2,
                                mm2,
                                0,
                              );
                              endIso = endLocal.toISOString();
                              hours = Math.max(0, hh2 + mm2 / 60 - (hh1 + mm1 / 60));
                            }
                            await adjustTime({
                              shiftId: Number(s.id),
                              payload: {
                                adjusted_check_in_time: startIso,
                                adjusted_check_out_time: endIso ?? undefined,
                                adjusted_actual_hours: Math.round(hours * 100) / 100,
                                reason,
                                manager_signature: "manager",
                              },
                            });
                            setEditing(false);
                            setReason("");
                            setAdjIn("");
                            setAdjOut("");
                          } catch (err: unknown) {
                            const e = err as { response?: { data?: { detail?: string } }; message?: string };
                            setSubmitError(
                              e?.response?.data?.detail ||
                                e?.message ||
                                "Failed to save adjustment",
                            );
                          }
                        }}
                      >
                        {isAdjusting ? "Saving…" : "Save adjustment"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const systemEntries: { id: string; title: string; detail: string }[] = [];
                if (s.auto_checkout) {
                  systemEntries.push({
                    id: "sys-auto-checkout",
                    title: "Auto-checkout",
                    detail:
                      "System auto-checked the officer out after grace period — venue checks complete, GPS verified.",
                  });
                }
                if (s.auto_approved) {
                  systemEntries.push({
                    id: "sys-auto-approve",
                    title: "Auto-approved on check-out",
                    detail:
                      "Shift signature + GPS verified inside venue radius — no manager review required.",
                  });
                }
                const totalEntries = adjustments.length + systemEntries.length;
                return (
                  <>
              <SectionLabel>
                Audit trail · {isLoadingAdjustments ? "…" : totalEntries}
              </SectionLabel>
              {!isLoadingAdjustments && totalEntries === 0 ? (
                <div
                  style={{
                    padding: 14,
                    textAlign: "center",
                    fontSize: 12,
                    color: tokens.color.ink500,
                    background: tokens.color.ink50,
                    borderRadius: 8,
                  }}
                >
                  No adjustments recorded
                </div>
              ) : (
                <div
                  style={{
                    borderLeft: `2px solid ${tokens.color.ink200}`,
                    paddingLeft: 14,
                    marginLeft: 6,
                  }}
                >
                  {systemEntries.map((sys) => (
                    <div
                      key={sys.id}
                      style={{ position: "relative", paddingBottom: 12 }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: -21,
                          top: 4,
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          background: tokens.color.success,
                          border: "2px solid white",
                          boxShadow: `0 0 0 1px ${tokens.color.ink200}`,
                        }}
                      />
                      <div
                        style={{ fontSize: 12, fontWeight: 600, color: tokens.color.ink900 }}
                      >
                        {sys.title}
                      </div>
                      <div
                        style={{ fontSize: 11, color: tokens.color.ink500, marginTop: 1 }}
                      >
                        System · {s.checkout_at
                          ? new Date(s.checkout_at).toLocaleString([], {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "on shift completion"}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: tokens.color.ink600,
                          marginTop: 5,
                          lineHeight: 1.5,
                          padding: "8px 10px",
                          background: tokens.color.successSoft,
                          borderRadius: 6,
                        }}
                      >
                        {sys.detail}
                      </div>
                    </div>
                  ))}
                  {adjustments.map((a) => {
                    const fromIn = a.original_check_in_time
                      ? new Date(a.original_check_in_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";
                    const toIn = a.adjusted_check_in_time
                      ? new Date(a.adjusted_check_in_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";
                    const fromOut = a.original_check_out_time
                      ? new Date(a.original_check_out_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";
                    const toOut = a.adjusted_check_out_time
                      ? new Date(a.adjusted_check_out_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";
                    const at = new Date(a.created_at).toLocaleString([], {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <div key={a.id} style={{ position: "relative", paddingBottom: 12 }}>
                        <span
                          style={{
                            position: "absolute",
                            left: -21,
                            top: 4,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            background: palette.primary,
                            border: "2px solid white",
                            boxShadow: `0 0 0 1px ${tokens.color.ink200}`,
                          }}
                        />
                        <div
                          style={{ fontSize: 12, fontWeight: 600, color: tokens.color.ink900 }}
                        >
                          Manager #{a.adjusted_by}
                        </div>
                        <div style={{ fontSize: 11, color: tokens.color.ink500, marginTop: 1 }}>
                          {at} · in {fromIn} → {toIn} · out {fromOut} → {toOut}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: tokens.color.ink600,
                            marginTop: 5,
                            lineHeight: 1.5,
                            padding: "8px 10px",
                            background: tokens.color.ink50,
                            borderRadius: 6,
                          }}
                        >
                          {a.reason}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                  </>
                );
              })()}
            </div>

            <div
              style={{
                borderTop: `1px solid ${tokens.color.ink200}`,
                padding: "12px 18px",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                background: tokens.color.ink50,
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  !s ||
                  isApproving ||
                  s.status === "approved" ||
                  s.status === "on_duty" ||
                  s.status === "upcoming"
                }
                title={
                  s?.status === "on_duty"
                    ? "Officer hasn't checked out yet"
                    : s?.status === "upcoming"
                      ? "Shift hasn't started"
                      : undefined
                }
                onClick={async () => {
                  if (!s) return;
                  setSubmitError(null);
                  try {
                    await approveShift({
                      shiftId: Number(s.id),
                      approved: false,
                      managerNotes: "Rejected from Attendance drawer",
                    });
                    onClose();
                  } catch (err: unknown) {
                    const e = err as { response?: { data?: { detail?: string; error?: string } }; message?: string };
                    setSubmitError(
                      e?.response?.data?.detail ||
                        e?.response?.data?.error ||
                        e?.message ||
                        "Failed to reject shift",
                    );
                  }
                }}
              >
                Reject
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leading={<Icon name="bell" size={12} />}
                disabled
                title="Coming soon"
              >
                Notify officer
              </Button>
              <Button
                variant="primary"
                size="sm"
                accent={palette}
                leading={<Icon name="check" size={12} />}
                disabled={
                  !s ||
                  isApproving ||
                  s.status === "approved" ||
                  // Can't approve a shift that hasn't checked out yet —
                  // payroll would lock in hours that haven't been worked.
                  s.act_end == null
                }
                title={
                  !s
                    ? undefined
                    : s.status === "approved"
                      ? "Already approved"
                      : s.act_end == null
                        ? "Waiting for check-out — auto-approves on valid checkout, or use Mark Present + Edit to record an end time"
                        : undefined
                }
                onClick={async () => {
                  if (!s) return;
                  setSubmitError(null);
                  try {
                    await approveShift({
                      shiftId: Number(s.id),
                      approved: true,
                    });
                    onClose();
                  } catch (err: unknown) {
                    const e = err as { response?: { data?: { detail?: string; error?: string } }; message?: string };
                    setSubmitError(
                      e?.response?.data?.detail ||
                        e?.response?.data?.error ||
                        e?.message ||
                        "Failed to approve shift",
                    );
                  }
                }}
              >
                {isApproving
                  ? "Saving…"
                  : s?.status === "approved"
                    ? "Approved"
                    : s?.act_end == null
                      ? "Awaiting check-out"
                      : "Approve shift"}
              </Button>
            </div>
            {submitError && (
              <div
                style={{
                  padding: "8px 18px",
                  background: tokens.color.dangerSoft,
                  color: tokens.color.dangerInk,
                  fontSize: 12,
                  borderTop: `1px solid ${tokens.color.ink200}`,
                }}
              >
                {submitError}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputCss: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: 6,
  fontSize: 13,
  fontFamily: tokens.font.body,
  color: tokens.color.ink900,
  outline: "none",
};

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: tokens.color.ink600,
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: tokens.color.ink500,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function TimeBlock({
  label,
  sub,
  inT,
  outT,
  tone,
  muted,
}: {
  label: string;
  sub: string;
  inT: string;
  outT: string;
  tone?: "ok" | "warn" | "danger";
  muted?: boolean;
}) {
  const tones = {
    ok: { bg: tokens.color.successSoft, fg: tokens.color.successInk },
    warn: { bg: tokens.color.warnSoft, fg: tokens.color.warnInk },
    danger: { bg: tokens.color.dangerSoft, fg: tokens.color.dangerInk },
  };
  const palette = tone ? tones[tone] : { bg: tokens.color.ink50, fg: tokens.color.ink900 };
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        background: muted ? tokens.color.ink50 : palette.bg,
        border: `1px solid ${muted ? tokens.color.ink200 : palette.bg}`,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: muted ? tokens.color.ink600 : palette.fg,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 10,
          color: muted ? tokens.color.ink500 : palette.fg,
          opacity: 0.7,
          marginTop: 1,
        }}
      >
        {sub}
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 17,
          color: muted ? tokens.color.ink900 : palette.fg,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {inT}{" "}
        <span
          style={{
            fontSize: 12,
            color: muted ? tokens.color.ink500 : palette.fg,
            opacity: 0.6,
            fontWeight: 500,
          }}
        >
          →
        </span>{" "}
        {outT}
      </div>
    </div>
  );
}

function VerifyTile({
  icon,
  label,
  state,
  value,
}: {
  icon: IconName;
  label: string;
  state: "ok" | "bad" | "unknown";
  value: string;
}) {
  const color =
    state === "bad" ? tokens.color.danger : state === "unknown" ? tokens.color.ink500 : tokens.color.success;
  const bg =
    state === "bad"
      ? tokens.color.dangerSoft
      : state === "unknown"
        ? tokens.color.ink50
        : tokens.color.successSoft;
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        background: bg,
        border: `1px solid ${bg}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <Icon name={icon} size={12} /> {label}
      </div>
      <div style={{ fontSize: 12, color: tokens.color.ink600, marginTop: 4 }}>{value}</div>
    </div>
  );
}
