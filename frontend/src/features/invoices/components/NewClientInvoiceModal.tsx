// NewClientInvoiceModal — captures venue + billing period for a new client
// invoice. The backend pulls every approved shift at that venue over the
// period and turns each into a line item priced at the shift's effective
// hourly rate. The result is a draft the manager can edit / issue / void.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import shiftService from "../../../services/shiftService";
import type { Venue } from "../../../types/venue";

export interface NewClientInvoicePayload {
  venueId: string | number;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

export interface NewClientInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewClientInvoicePayload) => Promise<unknown>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink900,
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: 8,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: tokens.color.ink600,
  marginBottom: 4,
  fontFamily: tokens.font.body,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

// Default period = current ISO week (Mon..Sun). Mirrors the weekly cron's
// natural cadence so a manager's "default" billing period matches payroll's.
function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

export function NewClientInvoiceModal({
  open,
  onClose,
  onSubmit,
}: NewClientInvoiceModalProps) {
  const venuesQuery = useQuery<Venue[]>({
    queryKey: ["venues"],
    queryFn: () => shiftService.getVenues(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const [venueId, setVenueId] = useState<string>("");
  const [{ start, end }, setRange] = useState(defaultPeriod);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setVenueId("");
      setRange(defaultPeriod());
      setNotes("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const venues = useMemo(
    () =>
      (venuesQuery.data ?? [])
        .filter((v) => v.is_active && v.id != null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [venuesQuery.data],
  );

  const handleSubmit = async () => {
    setError(null);
    if (!venueId) return setError("Pick a venue.");
    if (!start || !end) return setError("Set a billing period.");
    if (end < start) return setError("End date must be on or after start date.");
    setSubmitting(true);
    try {
      await onSubmit({ venueId, periodStart: start, periodEnd: end, notes: notes.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="New client invoice"
      description="Pulls approved shifts from the selected venue over the chosen period and builds a draft invoice you can review and send."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Generating…" : "Create draft"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Venue">
          {venuesQuery.isLoading ? (
            <div
              style={{
                ...inputStyle,
                color: tokens.color.ink500,
                fontStyle: "italic",
              }}
            >
              Loading venues…
            </div>
          ) : venues.length === 0 ? (
            <div
              style={{
                ...inputStyle,
                color: tokens.color.ink500,
                fontStyle: "italic",
              }}
            >
              No active venues. Add one from the Venues page first.
            </div>
          ) : (
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              style={inputStyle}
              autoFocus
            >
              <option value="">Choose a venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name}
                  {v.city ? ` · ${v.city}` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Period start">
            <input
              type="date"
              value={start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Period end">
            <input
              type="date"
              value={end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any context for the client — appears on the invoice and in the audit log."
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: tokens.font.body,
            }}
          />
        </Field>

        {error && (
          <div style={{ fontSize: 12.5, color: tokens.color.dangerInk }}>{error}</div>
        )}

        <div
          style={{
            fontSize: 11.5,
            color: tokens.color.ink500,
            background: tokens.color.ink50,
            padding: 10,
            borderRadius: 6,
            lineHeight: 1.5,
          }}
        >
          The draft uses the security company's default 20% VAT rate. Edit the
          note before issuing if you need to call out anything specific to the
          client. Period dates can be any range; a typical billing cycle is one
          week or one calendar month.
        </div>
      </div>
    </Modal>
  );
}
