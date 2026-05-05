// AdjustHoursModal — captures adjusted check-in/out times + reason for one shift.
//
// Backend endpoint: POST /api/v1/shifts/{shiftId}/adjust_time/ (existing, see
// backend/shifts/views.py:1405). The TimeAdjustment post_save signal then fires
// Invoice.recalculate_from_shifts which re-emits OT/special line items.
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { InvoiceLineItem } from "../data/mocks";

export interface AdjustHoursModalProps {
  open: boolean;
  onClose: () => void;
  items: InvoiceLineItem[];
  onSubmit: (payload: {
    shiftId: number;
    adjustedCheckIn: string;
    adjustedCheckOut: string;
    adjustedHours: number;
    reason: string;
  }) => Promise<unknown>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink900,
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: 8,
  outline: "none",
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Convert an ISO timestamp from the API into the YYYY-MM-DDTHH:MM string a
 * `<input type="datetime-local">` expects. Returns "" for null/undefined. */
function isoToLocalDtl(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({
  label,
  children,
}: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: tokens.color.ink600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function AdjustHoursModal({
  open,
  onClose,
  items,
  onSubmit,
}: AdjustHoursModalProps) {
  // Only shift-backed items can be adjusted.
  const adjustable = useMemo(
    () => items.filter((i) => i.shiftId != null && i.shiftId > 0),
    [items],
  );
  const uniqueShifts = useMemo(() => {
    const seen = new Map<number, InvoiceLineItem>();
    for (const it of adjustable) {
      if (it.shiftId != null && !seen.has(it.shiftId)) seen.set(it.shiftId, it);
    }
    return Array.from(seen.entries());
  }, [adjustable]);

  const [shiftId, setShiftId] = useState<string>("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map shiftId -> item, so swapping the dropdown reprefills cleanly.
  const itemByShiftId = useMemo(() => {
    const m = new Map<number, InvoiceLineItem>();
    for (const [id, it] of uniqueShifts) m.set(id, it);
    return m;
  }, [uniqueShifts]);

  const selectedItem = shiftId ? itemByShiftId.get(Number(shiftId)) : undefined;
  const currentHrs = selectedItem?.hrs ?? null;

  useEffect(() => {
    if (open) {
      const firstId = uniqueShifts[0]?.[0]?.toString() ?? "";
      setShiftId(firstId);
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, uniqueShifts]);

  // Prefill the datetime fields whenever the selected shift changes (including
  // on initial open). If the shift has no recorded time, leave the field blank
  // so the manager can still record from scratch.
  useEffect(() => {
    if (!open) return;
    setCheckIn(isoToLocalDtl(selectedItem?.checkInTime ?? null));
    setCheckOut(isoToLocalDtl(selectedItem?.checkOutTime ?? null));
  }, [open, selectedItem]);

  const handleSubmit = async () => {
    setError(null);
    if (!shiftId) {
      setError("Pick a shift to adjust.");
      return;
    }
    if (!checkIn || !checkOut) {
      setError("Both check-in and check-out times are required.");
      return;
    }
    if (!reason.trim()) {
      setError("Give a reason for the adjustment.");
      return;
    }
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const durationMs = endDate.getTime() - startDate.getTime();
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      setError("Check-out must be after check-in.");
      return;
    }
    const adjustedHours = Math.round((durationMs / 3_600_000) * 100) / 100;
    if (adjustedHours > 24) {
      setError("Adjusted hours cannot exceed 24.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        shiftId: Number(shiftId),
        adjustedCheckIn: startDate.toISOString(),
        adjustedCheckOut: endDate.toISOString(),
        adjustedHours,
        reason: reason.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Adjust hours"
      description="Override check-in / check-out times for a shift. Triggers an invoice recalculation."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save adjustment"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {uniqueShifts.length === 0 ? (
          <div style={{ fontSize: 13, color: tokens.color.ink600 }}>
            This officer's invoice has no shift-backed line items to adjust.
          </div>
        ) : (
          <Field label="Shift">
            <select
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              style={inputStyle}
            >
              {uniqueShifts.map(([id, it]) => {
                const hrs =
                  it.hrs != null
                    ? `${it.hrs.toFixed(2)}h logged`
                    : "no time logged";
                return (
                  <option key={id} value={id}>
                    {it.date} · {it.venue || "Site"} · {hrs}
                  </option>
                );
              })}
            </select>
          </Field>
        )}
        {selectedItem && (
          <div
            style={{
              fontSize: 12,
              color: tokens.color.ink600,
              padding: "8px 10px",
              borderRadius: 6,
              background: tokens.color.ink100,
              border: `1px solid ${tokens.color.ink200}`,
            }}
          >
            {currentHrs != null ? (
              <>
                Currently logged: <strong>{currentHrs.toFixed(2)}h</strong>
                {selectedItem.checkInTime && selectedItem.checkOutTime ? (
                  <>
                    {" "}
                    (
                    {new Date(selectedItem.checkInTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    →{" "}
                    {new Date(selectedItem.checkOutTime).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                    )
                  </>
                ) : null}
                . Edit the times below to correct them.
              </>
            ) : (
              <>No time recorded for this shift yet — enter both ends below.</>
            )}
          </div>
        )}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="Adjusted check-in">
            <input
              type="datetime-local"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Adjusted check-out">
            <input
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <Field label="Reason">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Officer signed in 15 min early at front desk."
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: tokens.font.body,
            }}
          />
        </Field>
        {error && (
          <div style={{ fontSize: 12.5, color: tokens.color.dangerInk }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
