// ResolveIncidentModal — manager confirms incident resolution.
// Optional follow-up flag + notes. Submit calls
// POST /api/v1/incidents/{id}/resolve/.
import { useEffect, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { IncidentReport } from "../../../services/incidentService";

export interface ResolveIncidentModalProps {
  open: boolean;
  incident: IncidentReport | null;
  onClose: () => void;
  onSubmit: (
    id: number,
    payload: { followup_notes?: string; requires_followup?: boolean },
  ) => Promise<void>;
  isSubmitting: boolean;
}

export function ResolveIncidentModal({
  open,
  incident,
  onClose,
  onSubmit,
  isSubmitting,
}: ResolveIncidentModalProps) {
  const [requiresFollowup, setRequiresFollowup] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRequiresFollowup(incident?.requires_followup ?? false);
    setNotes(incident?.followup_notes ?? "");
    setError(null);
  }, [open, incident]);

  const handleSubmit = async () => {
    if (!incident) return;
    if (requiresFollowup && !notes.trim()) {
      setError("Add a note describing the required follow-up.");
      return;
    }
    try {
      await onSubmit(incident.id, {
        requires_followup: requiresFollowup,
        followup_notes: notes.trim(),
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
      title="Mark incident resolved"
      description={
        incident?.venue_name
          ? `${incident.venue_name} · Incident #${incident.id}`
          : `Incident #${incident?.id ?? ""}`
      }
      size="sm"
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
            {isSubmitting ? "Working…" : "Mark resolved"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            checked={requiresFollowup}
            onChange={(e) => setRequiresFollowup(e.target.checked)}
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
              Requires follow-up
            </span>
            <span
              style={{
                display: "block",
                fontSize: 12,
                color: tokens.color.ink600,
                marginTop: 2,
              }}
            >
              Flag this incident for review even after resolution.
            </span>
          </span>
        </label>

        <div>
          <label
            htmlFor="resolve-notes"
            style={{
              display: "block",
              fontFamily: tokens.font.body,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: tokens.color.ink500,
              marginBottom: 6,
            }}
          >
            Notes {requiresFollowup ? "(required)" : "(optional)"}
          </label>
          <textarea
            id="resolve-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Summary of resolution, follow-up actions, or context for future reviewers."
            rows={5}
            style={{
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
            }}
          />
        </div>

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
