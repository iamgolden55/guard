// NewShiftModal — create-or-edit shift form. Used by:
//   • SchedulingHeader's "+ New shift" button (create mode)
//   • SchedulingDrawer's "Edit shift" button (edit mode, prefilled)
//
// Submit calls createShift / updateShiftFull on the SchedulingState context;
// those run the mutation, toast, and invalidate the shifts query.
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type { Shift } from "../data/mocks";
import { useScheduling, type ShiftFormInput } from "../state/SchedulingState";
import settingsService, { type SystemSettings } from "../../../services/settingsService";

type PayRateMode = "static" | "special_event" | "custom";

export interface NewShiftModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, the modal opens in edit mode for this shift. Null = create. */
  editingShift?: Shift | null;
  /** Default date when creating (yyyy-mm-dd). Falls back to today. */
  defaultDate?: string;
}

const ROLE_OPTIONS = [
  { value: "", label: "(any)" },
  { value: "security_guard", label: "Security Guard (SG)" },
  { value: "door_supervisor", label: "Door Supervisor (DS)" },
  { value: "cctv_operator", label: "CCTV Operator (CCTV)" },
  { value: "close_protection", label: "Close Protection (CP)" },
];

function decimalToHHmm(decimal: number): string {
  const wholeHours = Math.floor(decimal);
  const minutes = Math.round((decimal - wholeHours) * 60);
  return `${String(wholeHours % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewShiftModal({
  open,
  onClose,
  editingShift,
  defaultDate,
}: NewShiftModalProps) {
  const { venues, officers, createShift, updateShiftFull, week } = useScheduling();
  const isEdit = !!editingShift;

  const [venueId, setVenueId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [officerId, setOfficerId] = useState<string>("");
  const [role, setRole] = useState("");
  const [breakMinutes, setBreakMinutes] = useState<string>("30");
  const [notes, setNotes] = useState("");
  const [officersNeeded, setOfficersNeeded] = useState<string>("1");
  const [payRateType, setPayRateType] = useState<PayRateMode>("static");
  const [customPayRate, setCustomPayRate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // System settings drive the dropdown labels — show live rates so the user
  // sees what they're picking. Falls back gracefully if the endpoint is down.
  const settingsQuery = useQuery<SystemSettings>({
    queryKey: ["system-settings"],
    queryFn: () => settingsService.getSettings(),
    staleTime: 5 * 60_000,
  });
  const defaultRate = Number(settingsQuery.data?.default_hourly_rate ?? 12.5) || 12.5;
  const specialRate = Number(settingsQuery.data?.special_event_pay_rate ?? 14.0) || 14.0;

  // Reset / prefill fields whenever the modal opens with new context.
  useEffect(() => {
    if (!open) return;
    if (editingShift) {
      setVenueId(editingShift.venueId);
      setOfficerId(editingShift.officerId ?? "");
      setDate(editingShift.date ?? week.days[editingShift.day]?.date ?? todayIso());
      setStartTime(decimalToHHmm(editingShift.start));
      // end can exceed 24 (next-day spillover); modulo into HH:mm.
      setEndTime(decimalToHHmm(editingShift.end));
      setRole("");
      setBreakMinutes("30");
      setNotes("");
      setOfficersNeeded("1");
      // Pre-select pay-rate mode from the persisted shift fields.
      if (editingShift.isSpecialEvent) {
        setPayRateType("special_event");
        setCustomPayRate("");
      } else if (editingShift.hourlyRate != null) {
        setPayRateType("custom");
        setCustomPayRate(String(editingShift.hourlyRate));
      } else {
        setPayRateType("static");
        setCustomPayRate("");
      }
    } else {
      setVenueId(venues[0]?.id ?? "");
      setOfficerId("");
      setDate(defaultDate ?? todayIso());
      setStartTime("09:00");
      setEndTime("17:00");
      setRole("");
      setBreakMinutes("30");
      setNotes("");
      setOfficersNeeded("1");
      setPayRateType("static");
      setCustomPayRate("");
    }
    setFormError(null);
  }, [open, editingShift, defaultDate, venues, week]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!venueId) {
      setFormError("Pick a venue.");
      return;
    }
    if (!date || !startTime || !endTime) {
      setFormError("Date, start and end times are all required.");
      return;
    }
    const seats = Math.max(1, Math.min(20, Number(officersNeeded) || 1));

    let customRateNumber: number | undefined;
    if (payRateType === "custom") {
      customRateNumber = Number(customPayRate);
      if (!customRateNumber || customRateNumber <= 0 || !Number.isFinite(customRateNumber)) {
        setFormError("Enter a custom rate above £0.");
        return;
      }
    }

    const input: ShiftFormInput = {
      venueId,
      officerId: officerId || null,
      date,
      startTime,
      endTime,
      requiredRole: role || undefined,
      breakMinutes: breakMinutes ? Number(breakMinutes) : undefined,
      notes: notes || undefined,
      officersNeeded: seats,
      payRateType,
      customPayRate: customRateNumber,
    };
    setSubmitting(true);
    try {
      if (isEdit && editingShift) {
        await updateShiftFull(editingShift.id, input);
      } else {
        await createShift(input);
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={isEdit ? "Edit shift" : "New shift"}
      description={
        isEdit
          ? "Change the venue, officer, time or break. Saved as draft."
          : "Add a shift for the week. Leave the officer empty to create an open shift."
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const form = document.getElementById("new-shift-form") as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            disabled={submitting}
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create shift"}
          </Button>
        </>
      }
    >
      <form
        id="new-shift-form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <Field label="Venue *">
          <select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            required
            style={selectStyle}
          >
            <option value="" disabled>
              Pick a venue…
            </option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.area ? ` · ${v.area}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date *">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Start *">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field label="End *">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Officer (leave empty for open shift)">
          <select
            value={officerId}
            onChange={(e) => setOfficerId(e.target.value)}
            style={selectStyle}
          >
            <option value="">(open shift — needs cover)</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.sia.level}
              </option>
            ))}
          </select>
        </Field>

        <Field label={isEdit ? "Officers needed (this slot)" : "Officers needed"}>
          <input
            type="number"
            min={1}
            max={20}
            value={officersNeeded}
            onChange={(e) => setOfficersNeeded(e.target.value)}
            style={inputStyle}
          />
          {Number(officersNeeded) > 1 && (
            <span
              style={{
                fontSize: 11,
                color: tokens.color.ink600,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              {isEdit
                ? `Saving will keep this shift and add ${Number(officersNeeded) - 1} new open seat${
                    Number(officersNeeded) - 1 === 1 ? "" : "s"
                  } to the same shift group. Existing seats aren't removed.`
                : officerId
                  ? `Creates ${officersNeeded} linked shifts in one group. ${
                      officers.find((o) => o.id === officerId)?.name ?? "Selected officer"
                    } fills the first seat; the remaining ${
                      Number(officersNeeded) - 1
                    } start as open seats.`
                  : `Creates ${officersNeeded} linked shifts in one group — all seats start as open. Drag staff onto each to assign.`}
            </span>
          )}
        </Field>

        <Field label="Required role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={selectStyle}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Pay rate">
          <select
            value={payRateType}
            onChange={(e) => setPayRateType(e.target.value as PayRateMode)}
            style={selectStyle}
          >
            <option value="static">Static rate (£{defaultRate.toFixed(2)}/hr)</option>
            <option value="special_event">
              Special event (£{specialRate.toFixed(2)}/hr)
            </option>
            <option value="custom">Custom rate</option>
          </select>
        </Field>

        {payRateType === "custom" && (
          <Field label="Custom hourly rate (£)">
            <input
              type="number"
              min={0}
              step={0.5}
              value={customPayRate}
              onChange={(e) => setCustomPayRate(e.target.value)}
              placeholder="e.g. 22.50"
              style={inputStyle}
              required
            />
          </Field>
        )}

        <Field label="Break (minutes)">
          <input
            type="number"
            min={0}
            max={180}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, fontFamily: tokens.font.body, resize: "vertical" }}
          />
        </Field>

        {formError && (
          <div
            style={{
              fontSize: 12.5,
              color: tokens.color.dangerInk,
              background: tokens.color.dangerSoft,
              border: "1px solid #fbd0d4",
              borderRadius: tokens.radius.md,
              padding: "8px 10px",
            }}
          >
            {formError}
          </div>
        )}
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: tokens.color.ink600,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.ink200}`,
  fontSize: 13.5,
  fontFamily: tokens.font.body,
  color: tokens.color.ink900,
  background: "white",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
