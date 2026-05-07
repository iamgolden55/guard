// EditInvoiceModal — light-touch editor for an invoice's note field.
//
// Note shows on the payslip + activity timeline and is useful for capturing
// re-issue context (e.g. "Re-issued after CCTV review of Wed check-in").
// To adjust hours, the manager uses the Payroll page → expand officer →
// Adjust hours, since that flow lives next to the per-tier breakdown.
import { useEffect, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { InvoiceRecord } from "../data/mocks";

export interface EditInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceRecord | null;
  /** Save the new note. Throws on backend failure. */
  onSaveNote: (note: string) => Promise<unknown>;
}

export function EditInvoiceModal({
  open,
  onClose,
  invoice,
  onSaveNote,
}: EditInvoiceModalProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote(invoice?.note ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [open, invoice]);

  if (!invoice) return null;

  const original = (invoice.note ?? "").trim();
  const dirty = original !== note.trim();

  const handleSave = async () => {
    setError(null);
    if (!dirty) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onSaveNote(note.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Edit invoice"
      description={`${invoice.id} · ${invoice.party.name} · ${invoice.periodStart} → ${invoice.periodEnd}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : dirty ? "Save changes" : "Done"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: tokens.color.ink600,
              fontFamily: tokens.font.body,
            }}
          >
            Note
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Re-issued after CCTV review of Wednesday's check-in."
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
          <span
            style={{
              fontSize: 11.5,
              color: tokens.color.ink500,
              fontFamily: tokens.font.body,
              lineHeight: 1.5,
              marginTop: 2,
            }}
          >
            Shows on the printed payslip and activity log. To correct hours
            that triggered a rejection, open the Payroll page → expand the
            officer's row → Adjust hours.
          </span>
        </label>

        {error && (
          <div style={{ fontSize: 12.5, color: tokens.color.dangerInk }}>{error}</div>
        )}
      </div>
    </Modal>
  );
}
