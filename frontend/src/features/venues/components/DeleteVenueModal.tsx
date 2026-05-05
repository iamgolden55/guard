import { useEffect, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Input } from "../../../design-system/primitives/Input";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { Venue } from "../../../types/venue";

export interface DeleteVenueModalProps {
  open: boolean;
  venue: Venue | null;
  onClose: () => void;
  onConfirm: (id: number) => Promise<void>;
  isSubmitting: boolean;
}

export function DeleteVenueModal({
  open,
  venue,
  onClose,
  onConfirm,
  isSubmitting,
}: DeleteVenueModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmation("");
      setSubmitError(null);
    }
  }, [open]);

  const expected = venue?.name ?? "";
  const matches = confirmation.trim() === expected.trim() && expected !== "";

  const handleConfirm = async () => {
    if (!venue?.id || !matches) return;
    setSubmitError(null);
    try {
      await onConfirm(venue.id);
      onClose();
    } catch {
      setSubmitError("Couldn't delete the venue. Please try again.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete venue"
      description={
        venue
          ? `This permanently deletes ${venue.name}. Past shifts at this venue keep their record but no new shifts can reference it.`
          : "Confirm to delete this venue."
      }
      size="sm"
      tone="danger"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!matches || isSubmitting}
          >
            {isSubmitting ? "Deleting…" : "Delete venue"}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: tokens.font.body,
          fontSize: 13.5,
          color: tokens.color.ink800,
        }}
      >
        {submitError && (
          <div
            role="alert"
            style={{
              background: tokens.color.dangerSoft,
              color: tokens.color.dangerInk,
              border: `1px solid ${tokens.color.danger}33`,
              borderRadius: tokens.radius.md,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {submitError}
          </div>
        )}
        <p style={{ margin: 0 }}>
          Type{" "}
          <strong style={{ color: tokens.color.ink900 }}>{expected}</strong>{" "}
          to confirm.
        </p>
        <Input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={expected}
          autoFocus
        />
        <p style={{ margin: 0, color: tokens.color.ink500, fontSize: 12 }}>
          This action cannot be undone.
        </p>
      </div>
    </Modal>
  );
}
