// RejectInvoiceModal — captures a reason and submits a reject mutation.
// Reused by Invoices right-pane "Resolve & re-issue" → reject flow and by the
// payroll OfficersTable inline "Reject invoice" action.
import { useEffect, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";

export interface RejectInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  /** Submit handler — receives the trimmed reason. Throws on backend failure. */
  onSubmit: (reason: string) => Promise<unknown>;
  title?: string;
  description?: string;
  /** Display label for the row being rejected, e.g. "Invoice INV-2026-0481" */
  subject?: string;
}

export function RejectInvoiceModal({
  open,
  onClose,
  onSubmit,
  title = "Reject invoice",
  description = "Tell the team why this can't be paid as-is.",
  subject,
}: RejectInvoiceModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please enter a reason.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Rejecting…" : "Reject"}
          </Button>
        </>
      }
    >
      {subject && (
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginBottom: 8,
            fontFamily: tokens.font.mono,
          }}
        >
          {subject}
        </div>
      )}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Hours dispute — please re-confirm with site manager."
        rows={4}
        autoFocus
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: tokens.font.body,
          fontSize: 13.5,
          color: tokens.color.ink900,
          background: "white",
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: 8,
          resize: "vertical",
          outline: "none",
        }}
      />
      {error && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12.5,
            color: tokens.color.dangerInk,
          }}
        >
          {error}
        </div>
      )}
    </Modal>
  );
}
