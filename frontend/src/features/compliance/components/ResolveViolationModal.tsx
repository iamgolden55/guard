// ResolveViolationModal — manager confirms violation resolution.
// Notes required. Optional "exception granted" path adds an exception reason.
import { useEffect, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type {
  ComplianceViolation,
  ViolationResolution,
} from "../../../types/compliance";

const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontFamily: tokens.font.body,
  fontSize: 13,
  lineHeight: 1.5,
  color: tokens.color.ink900,
  background: "white",
  border: `1px solid ${tokens.color.ink300}`,
  borderRadius: tokens.radius.md,
  resize: "vertical",
  outline: "none",
};

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontFamily: tokens.font.body,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: tokens.color.ink500,
  marginBottom: 6,
};

export interface ResolveViolationModalProps {
  open: boolean;
  violation: ComplianceViolation | null;
  onClose: () => void;
  onSubmit: (id: number, resolution: ViolationResolution) => Promise<void>;
  isSubmitting: boolean;
}

export function ResolveViolationModal({
  open,
  violation,
  onClose,
  onSubmit,
  isSubmitting,
}: ResolveViolationModalProps) {
  const [notes, setNotes] = useState("");
  const [exception, setException] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setException(false);
    setReason("");
    setError(null);
  }, [open]);

  const handleSubmit = async () => {
    if (!violation) return;
    if (!notes.trim()) {
      setError("Resolution notes are required.");
      return;
    }
    if (exception && !reason.trim()) {
      setError("Exception reason is required when granting an exception.");
      return;
    }
    try {
      await onSubmit(violation.id, {
        resolution_notes: notes.trim(),
        exception_granted: exception,
        exception_reason: exception ? reason.trim() : undefined,
      });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't resolve. Please try again.",
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resolve violation"
      description={
        violation
          ? `${violation.violation_type_display ?? violation.violation_type} · ${violation.user_data?.full_name ?? `User #${violation.user}`}`
          : ""
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Working…" : "Confirm resolution"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label htmlFor="resolution-notes" style={FIELD_LABEL}>
            Resolution notes <span style={{ color: tokens.color.danger }}>*</span>
          </label>
          <textarea
            id="resolution-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe how this breach was resolved or why it should be dismissed."
            rows={4}
            style={TEXTAREA_STYLE}
          />
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={exception}
            onChange={(e) => setException(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span
              style={{
                display: "block",
                fontFamily: tokens.font.display,
                fontWeight: 600,
                fontSize: 13,
                color: tokens.color.ink900,
              }}
            >
              Grant exception
            </span>
            <span
              style={{
                display: "block",
                fontSize: 12,
                color: tokens.color.ink600,
                marginTop: 2,
              }}
            >
              Allow this breach as a one-off. Logged separately for audits.
            </span>
          </span>
        </label>

        {exception && (
          <div>
            <label htmlFor="exception-reason" style={FIELD_LABEL}>
              Exception reason{" "}
              <span style={{ color: tokens.color.danger }}>*</span>
            </label>
            <textarea
              id="exception-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this exception is acceptable in this case."
              rows={3}
              style={TEXTAREA_STYLE}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: tokens.color.dangerInk,
              background: tokens.color.dangerSoft,
              border: `1px solid ${tokens.color.danger}40`,
              borderRadius: tokens.radius.md,
              padding: "8px 12px",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
