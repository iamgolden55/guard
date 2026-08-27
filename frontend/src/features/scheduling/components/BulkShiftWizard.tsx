// BulkShiftWizard — three-step modal (Config → Preview → Result) that drives
// the POST /api/v1/shifts/shifts/bulk_create/ endpoint with a preview phase.
// Plain useState (matches NewShiftModal). No Formik / RHF.
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import schedulerService, {
  type BulkCreateCommitResponse,
  type BulkCreateExplicitPayload,
  type BulkCreatePayload,
  type BulkCreatePreviewResponse,
  type BulkCreatePreviewShift,
  type BulkCreateSlotStatus,
} from "../../../services/schedulerService";
import settingsService, {
  type SystemSettings,
} from "../../../services/settingsService";
import { useScheduling, type SchedulingToast } from "../state/SchedulingState";

const ROLE_OPTIONS = [
  { value: "", label: "(any)" },
  { value: "security_guard", label: "Security Guard (SG)" },
  { value: "door_supervisor", label: "Door Supervisor (DS)" },
  { value: "cctv_operator", label: "CCTV Operator (CCTV)" },
  { value: "close_protection", label: "Close Protection (CP)" },
];

const DAYS: Array<{ idx: number; short: string; long: string }> = [
  { idx: 0, short: "Mon", long: "Monday" },
  { idx: 1, short: "Tue", long: "Tuesday" },
  { idx: 2, short: "Wed", long: "Wednesday" },
  { idx: 3, short: "Thu", long: "Thursday" },
  { idx: 4, short: "Fri", long: "Friday" },
  { idx: 5, short: "Sat", long: "Saturday" },
  { idx: 6, short: "Sun", long: "Sunday" },
];

type Step = "config" | "preview" | "result";
type DateRangePreset = "this_week" | "next_4_weeks" | "custom";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function todayIso(): string {
  return isoDate(new Date());
}

// Anchor Monday in local time so day-of-week math matches the chip indices.
function mondayOf(d: Date): Date {
  const day = d.getDay();
  // JS Date#getDay returns 0=Sun..6=Sat; we want 0=Mon..6=Sun.
  const offsetFromMonday = (day + 6) % 7;
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - offsetFromMonday);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

function presetRange(preset: DateRangePreset, today: Date): { start: string; end: string } {
  if (preset === "this_week") {
    const mon = mondayOf(today);
    return { start: isoDate(mon), end: isoDate(addDays(mon, 6)) };
  }
  if (preset === "next_4_weeks") {
    return { start: isoDate(today), end: isoDate(addDays(today, 27)) };
  }
  return { start: isoDate(today), end: isoDate(today) };
}

function formatDateHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (s: string) => {
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return s;
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

export interface BulkShiftWizardProps {
  open: boolean;
  onClose: () => void;
  /** Optional: filter the scheduler to only `status=open` shifts after commit.
   *  Wired as a no-op for now; the wizard still toasts the count regardless. */
  onViewOpenSlots?: () => void;
  /** "recurrence" = original pattern-based flow. "custom" = per-row flow where
   *  each shift has its own date/venue/time/staff. Defaults to "recurrence" so
   *  existing callers behave identically. */
  mode?: "recurrence" | "custom";
}

const CUSTOM_ROW_CAP = 200;

type CustomRow = {
  id: string;
  date: string;
  venue_id: number | null;
  start_time: string;
  end_time: string;
  staff_users: number[];
  officers_needed: number;
};

type CustomDefaults = {
  staffUserIds: number[];
  role: string;
  hourlyRate: string;
  billRate: string;
  isSpecialEvent: boolean;
  publishAndNotify: boolean;
  notes: string;
};

function makeCustomRow(defaults: CustomDefaults): CustomRow {
  return {
    id: crypto.randomUUID(),
    date: todayIso(),
    venue_id: null,
    start_time: "09:00",
    end_time: "17:00",
    staff_users: [],
    officers_needed: Math.max(1, defaults.staffUserIds.length),
  };
}

function initialCustomDefaults(defaultHourly: number): CustomDefaults {
  return {
    staffUserIds: [],
    role: "",
    hourlyRate: defaultHourly ? defaultHourly.toFixed(2) : "",
    billRate: "",
    isSpecialEvent: false,
    publishAndNotify: false,
    notes: "",
  };
}

// "YYYY-MM-DD" + "HH:MM" → ISO datetime in local time, then .toISOString() so
// the backend (which parses tz-aware) sees the correct UTC instant.
function toIsoDatetime(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mn] = time.split(":").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, h ?? 0, mn ?? 0, 0, 0);
  return dt.toISOString();
}

// end < start means the row's end time falls on the next calendar day.
function rowCrossesMidnight(row: CustomRow): boolean {
  const [sh, sm] = row.start_time.split(":").map(Number);
  const [eh, em] = row.end_time.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  return (eh ?? 0) * 60 + (em ?? 0) < (sh ?? 0) * 60 + (sm ?? 0);
}

function addOneDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + 1);
  return isoDate(dt);
}

export function BulkShiftWizard({
  open,
  onClose,
  onViewOpenSlots,
  mode = "recurrence",
}: BulkShiftWizardProps) {
  const { venues, officers, showToast } = useScheduling();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("config");

  const [venueId, setVenueId] = useState("");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("this_week");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("04:00");
  const [officersNeeded, setOfficersNeeded] = useState("3");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [billRate, setBillRate] = useState("");
  const [notes, setNotes] = useState("");
  const [publishOnCreate, setPublishOnCreate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkCreatePreviewResponse | null>(null);

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<BulkCreateCommitResponse | null>(null);

  const [editedShifts, setEditedShifts] = useState<BulkCreatePreviewShift[]>([]);
  const [editedIds, setEditedIds] = useState<Set<string>>(() => new Set());

  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  const [customDefaults, setCustomDefaults] = useState<CustomDefaults>(() =>
    initialCustomDefaults(12.5),
  );
  // preview_group_id → venue id from the originating row, used in custom mode
  // so each preview row displays its own venue (rather than a single shared one).
  const [venueByRow, setVenueByRow] = useState<Map<string, number>>(() => new Map());

  const settingsQuery = useQuery<SystemSettings>({
    queryKey: ["system-settings"],
    queryFn: () => settingsService.getSettings(),
    staleTime: 5 * 60_000,
  });
  const defaultHourly = Number(settingsQuery.data?.default_hourly_rate ?? 12.5) || 12.5;

  // defaultHourly is intentionally excluded — we only want to seed the form
  // when the modal opens or the venue list changes, not when the settings
  // cache refreshes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: defaultHourly is a seed value, not a reactive trigger
  useEffect(() => {
    if (!open) return;
    setStep("config");
    setVenueId(venues[0]?.id ?? "");
    const range = presetRange("this_week", new Date());
    setDatePreset("this_week");
    setStartDate(range.start);
    setEndDate(range.end);
    setDaysOfWeek([]);
    setStartTime("20:00");
    setEndTime("04:00");
    setOfficersNeeded("3");
    setSelectedStaff([]);
    setRole("");
    setHourlyRate(defaultHourly ? defaultHourly.toFixed(2) : "");
    setBillRate("");
    setNotes("");
    setPublishOnCreate(false);
    setFormError(null);
    setPreviewError(null);
    setPreview(null);
    setCommitError(null);
    setCommitResult(null);
    setPreviewLoading(false);
    setCommitting(false);
    setEditedShifts([]);
    setEditedIds(new Set());
    const freshDefaults = initialCustomDefaults(defaultHourly);
    setCustomDefaults(freshDefaults);
    setCustomRows([makeCustomRow(freshDefaults)]);
    setVenueByRow(new Map());
  }, [open, venues]);

  const officersNeededNum = Math.max(0, Number(officersNeeded) || 0);
  const staffNumericIds = useMemo(
    () =>
      selectedStaff
        .map((id) => Number(id.replace(/^u/, "")))
        .filter((n) => Number.isFinite(n) && n > 0),
    [selectedStaff],
  );

  const toggleDay = (idx: number) => {
    setDaysOfWeek((curr) =>
      curr.includes(idx) ? curr.filter((d) => d !== idx) : [...curr, idx].sort((a, b) => a - b),
    );
  };

  const toggleStaff = (officerId: string) => {
    setSelectedStaff((curr) => {
      if (curr.includes(officerId)) return curr.filter((id) => id !== officerId);
      if (officersNeededNum > 0 && curr.length >= officersNeededNum) return curr;
      return [...curr, officerId];
    });
  };

  const applyDatePreset = (preset: DateRangePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const range = presetRange(preset, new Date());
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  // end_time < start_time means the shift wraps past midnight — the backend
  // adds a day to the end. Surface it inline so admins don't get surprised.
  const crossesMidnight = useMemo(() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
    return (eh ?? 0) * 60 + (em ?? 0) < (sh ?? 0) * 60 + (sm ?? 0);
  }, [startTime, endTime]);

  const validate = (): string | null => {
    if (!venueId) return "Pick a venue.";
    if (!startDate || !endDate) return "Choose a start and end date.";
    if (startDate > endDate) return "End date must be on or after the start date.";
    if (daysOfWeek.length === 0) return "Pick at least one day of the week.";
    if (!startTime || !endTime) return "Start and end times are required.";
    if (startTime === endTime) return "Start and end times can't be identical.";
    if (officersNeededNum < 1) return "Officers needed must be at least 1.";
    if (staffNumericIds.length > officersNeededNum) {
      return `You've assigned ${staffNumericIds.length} staff but only ${officersNeededNum} officer${officersNeededNum === 1 ? "" : "s"} needed per shift.`;
    }
    return null;
  };

  const buildPayload = (): BulkCreatePayload => {
    const payload: BulkCreatePayload = {
      mode: "recurrence",
      venue: Number(venueId),
      start_date: startDate,
      end_date: endDate,
      days_of_week: daysOfWeek,
      start_time: startTime,
      end_time: endTime,
      officers_needed: officersNeededNum,
      is_published: publishOnCreate,
      send_notifications: publishOnCreate,
    };
    if (staffNumericIds.length > 0) payload.staff_users = staffNumericIds;
    if (role) payload.required_security_role = role;
    if (notes.trim()) payload.notes = notes.trim();
    const hr = Number(hourlyRate);
    if (hourlyRate && Number.isFinite(hr) && hr > 0) payload.hourly_rate = hr.toFixed(2);
    const br = Number(billRate);
    if (billRate && Number.isFinite(br) && br > 0) payload.bill_rate = br.toFixed(2);
    return payload;
  };

  const validateCustom = (): string | null => {
    if (customRows.length === 0) return "Add at least one shift.";
    if (customRows.length > CUSTOM_ROW_CAP) {
      return `You can schedule up to ${CUSTOM_ROW_CAP} shifts at a time.`;
    }
    for (let i = 0; i < customRows.length; i += 1) {
      const r = customRows[i];
      if (!r) continue;
      const idx = i + 1;
      if (!r.date) return `Row ${idx}: pick a date.`;
      if (r.venue_id == null) return `Row ${idx}: pick a venue.`;
      if (!r.start_time || !r.end_time)
        return `Row ${idx}: start and end times are required.`;
      if (r.start_time === r.end_time)
        return `Row ${idx}: start and end times can't be identical.`;
      const staffCount = r.staff_users.length || customDefaults.staffUserIds.length;
      if (r.officers_needed < Math.max(1, staffCount)) {
        return `Row ${idx}: officers needed (${r.officers_needed}) is less than assigned staff (${staffCount}).`;
      }
    }
    return null;
  };

  const buildCustomExplicitPayload = (): BulkCreateExplicitPayload => {
    const hr = Number(customDefaults.hourlyRate);
    const br = Number(customDefaults.billRate);
    const rateContext = {
      required_security_role: customDefaults.role || undefined,
      hourly_rate:
        customDefaults.hourlyRate && Number.isFinite(hr) && hr > 0
          ? hr.toFixed(2)
          : undefined,
      bill_rate:
        customDefaults.billRate && Number.isFinite(br) && br > 0
          ? br.toFixed(2)
          : undefined,
      notes: customDefaults.notes.trim() || undefined,
      is_special_event: customDefaults.isSpecialEvent || undefined,
    };
    return {
      mode: "explicit",
      is_published: customDefaults.publishAndNotify,
      send_notifications: customDefaults.publishAndNotify,
      shifts: customRows.map((r) => {
        const endDate = rowCrossesMidnight(r) ? addOneDay(r.date) : r.date;
        const staffUsers = r.staff_users.length
          ? r.staff_users
          : customDefaults.staffUserIds;
        return {
          venue: r.venue_id ?? 0,
          start_time: toIsoDatetime(r.date, r.start_time),
          end_time: toIsoDatetime(endDate, r.end_time),
          staff_users: staffUsers,
          officers_needed: r.officers_needed,
          ...rateContext,
        };
      }),
    };
  };

  const goToPreview = async () => {
    if (mode === "custom") {
      const err = validateCustom();
      if (err) {
        setFormError(err);
        return;
      }
      setFormError(null);
      setPreviewError(null);
      setPreview(null);
      setVenueByRow(new Map());
      setPreviewLoading(true);
      setStep("preview");
      try {
        const payload = buildCustomExplicitPayload();
        const res = await schedulerService.bulkCreateShifts(payload, { preview: true });
        // Zip customRows[i] ↔ res.shifts[i] — backend preserves array order for
        // explicit mode, so this 1:1 mapping is safe.
        const map = new Map<string, number>();
        res.shifts.forEach((shift, i) => {
          const venueId = customRows[i]?.venue_id;
          if (venueId != null) map.set(shift.preview_group_id, venueId);
        });
        setVenueByRow(map);
        setPreview(res);
        setEditedShifts(res.shifts.map(cloneShift));
        setEditedIds(new Set());
      } catch (e) {
        setPreviewError(extractErrorMessage(e) ?? "Couldn't load preview.");
      } finally {
        setPreviewLoading(false);
      }
      return;
    }

    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setPreviewError(null);
    setPreview(null);
    setPreviewLoading(true);
    setStep("preview");
    try {
      const res = await schedulerService.bulkCreateShifts(buildPayload(), { preview: true });
      setPreview(res);
      setEditedShifts(res.shifts.map(cloneShift));
      setEditedIds(new Set());
    } catch (e) {
      setPreviewError(extractErrorMessage(e) ?? "Couldn't load preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const buildExplicitPayload = (): BulkCreateExplicitPayload => {
    const useCustom = mode === "custom";
    const effHourly = useCustom ? customDefaults.hourlyRate : hourlyRate;
    const effBill = useCustom ? customDefaults.billRate : billRate;
    const effRole = useCustom ? customDefaults.role : role;
    const effNotes = useCustom ? customDefaults.notes : notes;
    const effPublish = useCustom ? customDefaults.publishAndNotify : publishOnCreate;
    const hr = Number(effHourly);
    const br = Number(effBill);
    const rateContext = {
      required_security_role: effRole || undefined,
      hourly_rate:
        effHourly && Number.isFinite(hr) && hr > 0 ? hr.toFixed(2) : undefined,
      bill_rate: effBill && Number.isFinite(br) && br > 0 ? br.toFixed(2) : undefined,
      notes: effNotes.trim() || undefined,
    };
    return {
      mode: "explicit",
      is_published: effPublish,
      send_notifications: effPublish,
      shifts: editedShifts.map((s) => {
        const staffUsers = s.slots
          .map((slot) => slot.staff_user)
          .filter((id): id is number => id != null);
        // In custom mode each row carries its own venue id (looked up via
        // venueByRow), so edits/removals stay venue-correct on re-submit.
        const venueForRow = useCustom
          ? venueByRow.get(s.preview_group_id) ?? Number(venueId)
          : Number(venueId);
        return {
          venue: venueForRow,
          start_time: s.start,
          end_time: s.end,
          staff_users: staffUsers,
          officers_needed: s.slots.length,
          ...rateContext,
        };
      }),
    };
  };

  const commit = async () => {
    setCommitError(null);
    setCommitting(true);
    try {
      // Custom mode is always explicit (the row shape can't be expressed as a
      // recurrence). Recurrence mode only switches to explicit if the admin
      // hand-edited preview rows.
      const payload: BulkCreatePayload =
        mode === "custom" || hasEdits ? buildExplicitPayload() : buildPayload();
      const res = await schedulerService.bulkCreateShifts(payload);
      setCommitResult(res);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["scheduling", "shifts"] });
      const newOpenAfterEdit = res.skipped_assignments > originalConflictSlots;
      const publishedNow =
        mode === "custom" ? customDefaults.publishAndNotify : publishOnCreate;
      const toast: Omit<SchedulingToast, "id"> = {
        tone: "success",
        title:
          res.created === 1
            ? "1 shift created"
            : `${res.created} shifts created`,
        body: newOpenAfterEdit
          ? `${res.skipped_assignments} slot${res.skipped_assignments === 1 ? "" : "s"} became open after your edits — check the scheduler to fill them.`
          : res.skipped_assignments > 0
            ? `${res.skipped_assignments} assignment${res.skipped_assignments === 1 ? "" : "s"} dropped — those slots are open.`
            : publishedNow
              ? "Published and staff notified."
              : "Saved as drafts. Publish when you're ready.",
      };
      showToast(toast);
    } catch (e) {
      setCommitError(extractErrorMessage(e) ?? "Couldn't create shifts.");
    } finally {
      setCommitting(false);
    }
  };

  const resetToStep1 = () => {
    setStep("config");
    setPreview(null);
    setPreviewError(null);
    setCommitResult(null);
    setCommitError(null);
    setEditedShifts([]);
    setEditedIds(new Set());
    setVenueByRow(new Map());
  };

  const closeWizard = () => {
    if (committing || previewLoading) return;
    onClose();
  };

  const originalCount = preview?.shifts.length ?? 0;
  const rowsRemoved = preview ? originalCount - editedShifts.length : 0;
  const hasEdits = editedIds.size > 0 || rowsRemoved > 0;

  const editedSummary = useMemo(() => {
    const totals = { to_create: 0, assigned_slots: 0, conflict_slots: 0, open_slots: 0 };
    if (!preview) return totals;
    totals.to_create = editedShifts.length;
    for (const s of editedShifts) {
      const isEdited = editedIds.has(s.preview_group_id);
      for (const slot of s.slots) {
        if (slot.staff_user == null) {
          totals.open_slots += 1;
        } else if (isEdited) {
          // Edited rows: validation badges are unreliable; count filled slots
          // optimistically as assigned pending server re-validation.
          totals.assigned_slots += 1;
        } else if (slot.status === "ok") {
          totals.assigned_slots += 1;
        } else if (slot.status === "conflict") {
          totals.conflict_slots += 1;
        }
      }
    }
    return totals;
  }, [editedShifts, editedIds, preview]);

  const originalConflictSlots = preview?.summary.conflict_slots ?? 0;
  const commitButtonLabel = preview
    ? editedSummary.to_create === 0
      ? "Nothing to create"
      : hasEdits && originalConflictSlots > 0
        ? `Create ${editedSummary.to_create} shifts`
        : editedSummary.open_slots + editedSummary.conflict_slots > 0
          ? `Create ${editedSummary.to_create} shifts — keep ${editedSummary.open_slots + editedSummary.conflict_slots} open`
          : `Create ${editedSummary.to_create} shifts`
    : "Create shifts";

  const customValidationError = mode === "custom" ? validateCustom() : null;
  const customPreviewDisabled = mode === "custom" && customValidationError !== null;

  const renderFooter = () => {
    if (step === "config") {
      return (
        <>
          <Button variant="ghost" onClick={closeWizard}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={goToPreview}
            disabled={customPreviewDisabled}
          >
            {mode === "custom" ? "Preview & validate →" : "Preview →"}
          </Button>
        </>
      );
    }
    if (step === "preview") {
      return (
        <>
          <Button variant="ghost" onClick={resetToStep1} disabled={committing}>
            ← Back
          </Button>
          <Button
            variant="primary"
            onClick={commit}
            disabled={
              previewLoading || committing || !preview || editedSummary.to_create === 0
            }
          >
            {committing ? "Creating…" : commitButtonLabel}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button variant="ghost" onClick={resetToStep1}>
          Schedule more
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onViewOpenSlots?.();
            onClose();
          }}
        >
          {commitResult && commitResult.created - commitResult.skipped_assignments < commitResult.created
            ? "View open slots"
            : "Done"}
        </Button>
      </>
    );
  };

  const stepTitle =
    step === "config"
      ? mode === "custom"
        ? "Custom shifts"
        : "Bulk schedule shifts"
      : step === "preview"
        ? "Review before creating"
        : "Shifts created";
  const stepDescription =
    step === "config"
      ? mode === "custom"
        ? "Add one shift per row. Each row can target a different venue, date and time. We'll check conflicts before creating."
        : "Set a recurring pattern. We'll expand the dates, check for conflicts, then create the shifts as drafts."
      : step === "preview"
        ? "Conflict slots will be created as open (unassigned) so the shift still exists."
        : undefined;

  return (
    <Modal
      open={open}
      onClose={closeWizard}
      title={stepTitle}
      description={stepDescription}
      size="lg"
      footer={renderFooter()}
    >
      <StepDots step={step} />

      {step === "config" && mode === "recurrence" && (
        <ConfigStep
          venues={venues}
          officers={officers}
          venueId={venueId}
          setVenueId={setVenueId}
          datePreset={datePreset}
          applyDatePreset={applyDatePreset}
          startDate={startDate}
          setStartDate={(v) => {
            setStartDate(v);
            setDatePreset("custom");
          }}
          endDate={endDate}
          setEndDate={(v) => {
            setEndDate(v);
            setDatePreset("custom");
          }}
          daysOfWeek={daysOfWeek}
          toggleDay={toggleDay}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          crossesMidnight={crossesMidnight}
          officersNeeded={officersNeeded}
          setOfficersNeeded={setOfficersNeeded}
          selectedStaff={selectedStaff}
          toggleStaff={toggleStaff}
          role={role}
          setRole={setRole}
          hourlyRate={hourlyRate}
          setHourlyRate={setHourlyRate}
          billRate={billRate}
          setBillRate={setBillRate}
          notes={notes}
          setNotes={setNotes}
          publishOnCreate={publishOnCreate}
          setPublishOnCreate={setPublishOnCreate}
          formError={formError}
          defaultHourly={defaultHourly}
          officersNeededNum={officersNeededNum}
        />
      )}

      {step === "config" && mode === "custom" && (
        <CustomConfigStep
          venues={venues}
          officers={officers}
          rows={customRows}
          setRows={setCustomRows}
          defaults={customDefaults}
          setDefaults={setCustomDefaults}
          defaultHourly={defaultHourly}
          formError={formError}
          validationError={customValidationError}
        />
      )}

      {step === "preview" && (
        <PreviewStep
          loading={previewLoading}
          error={previewError}
          preview={preview}
          editedShifts={editedShifts}
          editedIds={editedIds}
          editedSummary={editedSummary}
          officers={officers}
          officerNameById={(id) =>
            officers.find((o) => o.id === `u${id}`)?.name ?? `Staff #${id}`
          }
          venueName={
            venues.find((v) => v.id === venueId)?.name ?? "Venue"
          }
          venueByRow={mode === "custom" ? venueByRow : undefined}
          venueNameById={(vid) =>
            venues.find((v) => v.id === String(vid))?.name ?? `Venue #${vid}`
          }
          commitError={commitError}
          onEditTime={(groupId, startIso, endIso) => {
            setEditedShifts((curr) =>
              curr.map((s) =>
                s.preview_group_id === groupId
                  ? { ...s, start: startIso, end: endIso }
                  : s,
              ),
            );
            setEditedIds((curr) => {
              const next = new Set(curr);
              next.add(groupId);
              return next;
            });
          }}
          onSlotChange={(groupId, slotIdx, staffUserId) => {
            setEditedShifts((curr) =>
              curr.map((s) => {
                if (s.preview_group_id !== groupId) return s;
                const nextSlots = s.slots.map((slot, i) =>
                  i === slotIdx
                    ? { ...slot, staff_user: staffUserId, status: "ok" as BulkCreateSlotStatus, reason: undefined }
                    : slot,
                );
                return { ...s, slots: nextSlots };
              }),
            );
            setEditedIds((curr) => {
              const next = new Set(curr);
              next.add(groupId);
              return next;
            });
          }}
          onRemoveRow={(groupId) => {
            setEditedShifts((curr) => curr.filter((s) => s.preview_group_id !== groupId));
            setEditedIds((curr) => {
              const next = new Set(curr);
              next.delete(groupId);
              return next;
            });
          }}
        />
      )}

      {step === "result" && commitResult && (
        <ResultStep
          created={commitResult.created}
          skipped={commitResult.skipped_assignments}
          publishOnCreate={publishOnCreate}
        />
      )}
    </Modal>
  );
}

function extractErrorMessage(e: unknown): string | null {
  if (!e) return null;
  // axios error shape
  const anyErr = e as {
    response?: { data?: Record<string, unknown> | string };
    message?: string;
  };
  const data = anyErr.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.error === "string") return data.error;
    const firstFieldErrors = Object.values(data).find(
      (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "string",
    ) as string[] | undefined;
    if (firstFieldErrors) return firstFieldErrors[0];
  }
  return anyErr.message ?? null;
}

interface ConfigStepProps {
  venues: ReturnType<typeof useScheduling>["venues"];
  officers: ReturnType<typeof useScheduling>["officers"];
  venueId: string;
  setVenueId: (v: string) => void;
  datePreset: DateRangePreset;
  applyDatePreset: (p: DateRangePreset) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  daysOfWeek: number[];
  toggleDay: (idx: number) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  crossesMidnight: boolean;
  officersNeeded: string;
  setOfficersNeeded: (v: string) => void;
  selectedStaff: string[];
  toggleStaff: (id: string) => void;
  role: string;
  setRole: (v: string) => void;
  hourlyRate: string;
  setHourlyRate: (v: string) => void;
  billRate: string;
  setBillRate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  publishOnCreate: boolean;
  setPublishOnCreate: (v: boolean) => void;
  formError: string | null;
  defaultHourly: number;
  officersNeededNum: number;
}

function ConfigStep(p: ConfigStepProps) {
  const assignedCount = p.selectedStaff.length;
  const openSlotsPerShift = Math.max(0, p.officersNeededNum - assignedCount);
  const staffAssignmentHint =
    p.officersNeededNum === 0
      ? "Set officers needed first."
      : assignedCount === p.officersNeededNum
        ? `${assignedCount} of ${p.officersNeededNum} needed assigned`
        : `${assignedCount} of ${p.officersNeededNum} — ${openSlotsPerShift} slot${openSlotsPerShift === 1 ? "" : "s"} will be open per shift`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Venue *">
        <select
          value={p.venueId}
          onChange={(e) => p.setVenueId(e.target.value)}
          style={selectStyle}
        >
          <option value="" disabled>
            Pick a venue…
          </option>
          {p.venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.area ? ` · ${v.area}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Date range *">
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <Chip
            active={p.datePreset === "this_week"}
            onClick={() => p.applyDatePreset("this_week")}
          >
            This week
          </Chip>
          <Chip
            active={p.datePreset === "next_4_weeks"}
            onClick={() => p.applyDatePreset("next_4_weeks")}
          >
            Next 4 weeks
          </Chip>
          <Chip
            active={p.datePreset === "custom"}
            onClick={() => p.applyDatePreset("custom")}
          >
            Custom
          </Chip>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <SubLabel>From</SubLabel>
            <input
              type="date"
              value={p.startDate}
              onChange={(e) => p.setStartDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <SubLabel>To</SubLabel>
            <input
              type="date"
              value={p.endDate}
              onChange={(e) => p.setEndDate(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </Field>

      <Field label="Days of week *">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAYS.map((d) => (
            <Chip
              key={d.idx}
              active={p.daysOfWeek.includes(d.idx)}
              onClick={() => p.toggleDay(d.idx)}
              title={d.long}
            >
              {d.short}
            </Chip>
          ))}
        </div>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Start time *">
          <input
            type="time"
            value={p.startTime}
            onChange={(e) => p.setStartTime(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="End time *">
          <input
            type="time"
            value={p.endTime}
            onChange={(e) => p.setEndTime(e.target.value)}
            style={inputStyle}
          />
          {p.crossesMidnight && (
            <span style={hintStyle}>(crosses midnight)</span>
          )}
        </Field>
      </div>

      <Field label="Officers needed per shift *">
        <input
          type="number"
          min={1}
          max={50}
          value={p.officersNeeded}
          onChange={(e) => p.setOfficersNeeded(e.target.value)}
          style={{ ...inputStyle, maxWidth: 140 }}
        />
      </Field>

      <Field label="Assign staff (optional)">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            maxHeight: 180,
            overflowY: "auto",
            padding: "4px 2px",
          }}
        >
          {p.officers.length === 0 ? (
            <span style={hintStyle}>No approved staff yet.</span>
          ) : (
            p.officers.map((o) => {
              const active = p.selectedStaff.includes(o.id);
              const disabled =
                !active &&
                p.officersNeededNum > 0 &&
                p.selectedStaff.length >= p.officersNeededNum;
              return (
                <Chip
                  key={o.id}
                  active={active}
                  onClick={() => !disabled && p.toggleStaff(o.id)}
                  disabled={disabled}
                  title={`${o.name} · ${o.sia.level}`}
                >
                  {o.name}
                </Chip>
              );
            })
          )}
        </div>
        <span style={{ ...hintStyle, marginTop: 6 }}>{staffAssignmentHint}</span>
      </Field>

      <Field label="Required role">
        <select
          value={p.role}
          onChange={(e) => p.setRole(e.target.value)}
          style={selectStyle}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label={`Hourly pay (£) — default £${p.defaultHourly.toFixed(2)}`}>
          <input
            type="number"
            min={0}
            step={0.25}
            value={p.hourlyRate}
            onChange={(e) => p.setHourlyRate(e.target.value)}
            placeholder={p.defaultHourly.toFixed(2)}
            style={inputStyle}
          />
        </Field>
        <Field label="Bill rate (£)">
          <input
            type="number"
            min={0}
            step={0.25}
            value={p.billRate}
            onChange={(e) => p.setBillRate(e.target.value)}
            placeholder="leave blank"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={p.notes}
          onChange={(e) => p.setNotes(e.target.value)}
          rows={3}
          style={{ ...inputStyle, fontFamily: tokens.font.body, resize: "vertical" }}
        />
      </Field>

      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "10px 12px",
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.md,
          background: tokens.color.ink50,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={p.publishOnCreate}
          onChange={(e) => p.setPublishOnCreate(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tokens.color.ink900 }}>
            Publish & notify staff immediately on create
          </div>
          <div style={{ fontSize: 11.5, color: tokens.color.ink600, marginTop: 2, lineHeight: 1.4 }}>
            Off: shifts are created as drafts. Use the existing Publish action to notify staff later.
          </div>
        </div>
      </label>

      {p.formError && <InlineError>{p.formError}</InlineError>}
    </div>
  );
}

interface PreviewStepProps {
  loading: boolean;
  error: string | null;
  preview: BulkCreatePreviewResponse | null;
  editedShifts: BulkCreatePreviewShift[];
  editedIds: Set<string>;
  editedSummary: {
    to_create: number;
    assigned_slots: number;
    conflict_slots: number;
    open_slots: number;
  };
  officers: ReturnType<typeof useScheduling>["officers"];
  officerNameById: (id: number) => string;
  venueName: string;
  /** Custom-mode: maps preview_group_id → venue id so each row can display its
   *  own venue. Absent in recurrence mode (all rows share `venueName`). */
  venueByRow?: Map<string, number>;
  venueNameById?: (id: number) => string;
  commitError: string | null;
  onEditTime: (groupId: string, startIso: string, endIso: string) => void;
  onSlotChange: (groupId: string, slotIdx: number, staffUserId: number | null) => void;
  onRemoveRow: (groupId: string) => void;
}

function PreviewStep({
  loading,
  error,
  preview,
  editedShifts,
  editedIds,
  editedSummary,
  officers,
  officerNameById,
  venueName,
  venueByRow,
  venueNameById,
  commitError,
  onEditTime,
  onSlotChange,
  onRemoveRow,
}: PreviewStepProps) {
  if (loading) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center", color: tokens.color.ink600 }}>
        <div
          style={{
            width: 28,
            height: 28,
            margin: "0 auto 12px",
            border: `3px solid ${tokens.color.ink200}`,
            borderTopColor: tokens.color.ink700,
            borderRadius: "50%",
            animation: "ms-spin 0.9s linear infinite",
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600 }}>Expanding pattern and checking conflicts…</div>
        <style>{"@keyframes ms-spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }
  if (error) {
    return <InlineError>{error}</InlineError>;
  }
  if (!preview) {
    return <div style={{ color: tokens.color.ink600, fontSize: 13 }}>No preview yet.</div>;
  }

  const shiftsByDate = new Map<string, BulkCreatePreviewShift[]>();
  for (const s of editedShifts) {
    const list = shiftsByDate.get(s.date) ?? [];
    list.push(s);
    shiftsByDate.set(s.date, list);
  }
  const sortedDates = Array.from(shiftsByDate.keys()).sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          padding: "10px 12px",
          background: tokens.color.ink50,
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.md,
        }}
      >
        <Counter
          label="Total shifts"
          value={editedSummary.to_create}
          tone="ink"
        />
        <Counter label="Assigned" value={editedSummary.assigned_slots} tone="ok" symbol="✓" />
        <Counter
          label="Conflicts"
          value={editedSummary.conflict_slots}
          tone="warn"
          symbol="⚠"
        />
        <Counter label="Open" value={editedSummary.open_slots} tone="mute" symbol="○" />
      </div>

      {commitError && <InlineError>{commitError}</InlineError>}

      {editedSummary.to_create === 0 && (
        <div style={{ fontSize: 13, color: tokens.color.ink600 }}>
          No shifts left. Go back and widen the date range or pick more days.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sortedDates.map((date) => {
          const dateShifts = shiftsByDate.get(date) ?? [];
          return (
            <div
              key={date}
              style={{
                border: `1px solid ${tokens.color.ink200}`,
                borderRadius: tokens.radius.md,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  background: tokens.color.ink50,
                  borderBottom: `1px solid ${tokens.color.ink200}`,
                  fontSize: 12,
                  fontWeight: 700,
                  color: tokens.color.ink800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{formatDateHeading(date)}</span>
                <span style={{ fontWeight: 500, color: tokens.color.ink600 }}>
                  {dateShifts.length} shift{dateShifts.length === 1 ? "" : "s"}
                </span>
              </div>
              {dateShifts.map((shift) => {
                const rowVenueId = venueByRow?.get(shift.preview_group_id);
                const rowVenueName =
                  rowVenueId != null && venueNameById
                    ? venueNameById(rowVenueId)
                    : venueName;
                return (
                <EditableShiftRow
                  key={shift.preview_group_id}
                  shift={shift}
                  edited={editedIds.has(shift.preview_group_id)}
                  venueName={rowVenueName}
                  officers={officers}
                  officerNameById={officerNameById}
                  onEditTime={(startIso, endIso) =>
                    onEditTime(shift.preview_group_id, startIso, endIso)
                  }
                  onSlotChange={(slotIdx, staffUserId) =>
                    onSlotChange(shift.preview_group_id, slotIdx, staffUserId)
                  }
                  onRemove={() => onRemoveRow(shift.preview_group_id)}
                />
                );
              })}
            </div>
          );
        })}
      </div>

      {(editedSummary.conflict_slots > 0 || editedSummary.open_slots > 0) && (
        <div
          style={{
            fontSize: 12,
            color: tokens.color.ink600,
            padding: "8px 10px",
            background: tokens.color.ink50,
            border: `1px dashed ${tokens.color.ink300}`,
            borderRadius: tokens.radius.md,
            lineHeight: 1.5,
          }}
        >
          Conflict slots will be created as open (unassigned) — the shift is still created so you can
          assign someone else later.
        </div>
      )}
    </div>
  );
}

interface CustomConfigStepProps {
  venues: ReturnType<typeof useScheduling>["venues"];
  officers: ReturnType<typeof useScheduling>["officers"];
  rows: CustomRow[];
  setRows: React.Dispatch<React.SetStateAction<CustomRow[]>>;
  defaults: CustomDefaults;
  setDefaults: React.Dispatch<React.SetStateAction<CustomDefaults>>;
  defaultHourly: number;
  formError: string | null;
  validationError: string | null;
}

function CustomConfigStep({
  venues,
  officers,
  rows,
  setRows,
  defaults,
  setDefaults,
  defaultHourly,
  formError,
  validationError,
}: CustomConfigStepProps) {
  const atCap = rows.length >= CUSTOM_ROW_CAP;

  const toggleDefaultStaff = (officerId: string) => {
    const numericId = Number(officerId.replace(/^u/, ""));
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    setDefaults((d) => {
      const next = d.staffUserIds.includes(numericId)
        ? d.staffUserIds.filter((id) => id !== numericId)
        : [...d.staffUserIds, numericId];
      return { ...d, staffUserIds: next };
    });
  };

  const updateRow = (id: string, patch: Partial<CustomRow>) => {
    setRows((curr) => curr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((curr) => curr.filter((r) => r.id !== id));
  };

  const addRow = () => {
    if (atCap) return;
    setRows((curr) => [...curr, makeCustomRow(defaults)]);
  };

  const toggleRowStaff = (rowId: string, officerId: string) => {
    const numericId = Number(officerId.replace(/^u/, ""));
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    setRows((curr) =>
      curr.map((r) => {
        if (r.id !== rowId) return r;
        const next = r.staff_users.includes(numericId)
          ? r.staff_users.filter((id) => id !== numericId)
          : [...r.staff_users, numericId];
        return { ...r, staff_users: next };
      }),
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section
        style={{
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.md,
          padding: 14,
          background: tokens.color.ink50,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tokens.color.ink600,
          }}
        >
          Defaults (apply to rows without overrides)
        </div>

        <Field label="Default staff">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              maxHeight: 140,
              overflowY: "auto",
              padding: "4px 2px",
            }}
          >
            {officers.length === 0 ? (
              <span style={hintStyle}>No approved staff yet.</span>
            ) : (
              officers.map((o) => {
                const numericId = Number(o.id.replace(/^u/, ""));
                const active = defaults.staffUserIds.includes(numericId);
                return (
                  <Chip
                    key={o.id}
                    active={active}
                    onClick={() => toggleDefaultStaff(o.id)}
                    title={`${o.name} · ${o.sia.level}`}
                  >
                    {o.name}
                  </Chip>
                );
              })
            )}
          </div>
          <span style={{ ...hintStyle, marginTop: 6 }}>
            Rows with no staff of their own inherit this list at submit time.
          </span>
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Default role">
            <select
              value={defaults.role}
              onChange={(e) => setDefaults((d) => ({ ...d, role: e.target.value }))}
              style={selectStyle}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Field label={`Hourly pay (£) — default £${defaultHourly.toFixed(2)}`}>
            <input
              type="number"
              min={0}
              step={0.25}
              value={defaults.hourlyRate}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, hourlyRate: e.target.value }))
              }
              placeholder={defaultHourly.toFixed(2)}
              style={inputStyle}
            />
          </Field>
          <Field label="Bill rate (£)">
            <input
              type="number"
              min={0}
              step={0.25}
              value={defaults.billRate}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, billRate: e.target.value }))
              }
              placeholder="leave blank"
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={defaults.notes}
            onChange={(e) => setDefaults((d) => ({ ...d, notes: e.target.value }))}
            rows={2}
            style={{ ...inputStyle, fontFamily: tokens.font.body, resize: "vertical" }}
          />
        </Field>

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "10px 12px",
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            background: "white",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={defaults.publishAndNotify}
            onChange={(e) =>
              setDefaults((d) => ({ ...d, publishAndNotify: e.target.checked }))
            }
            style={{ marginTop: 2 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tokens.color.ink900 }}>
              Publish & notify staff immediately on create
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: tokens.color.ink600,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              Off: shifts are created as drafts and notifications stay quiet.
            </div>
          </div>
        </label>

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "10px 12px",
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            background: "white",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={defaults.isSpecialEvent}
            onChange={(e) =>
              setDefaults((d) => ({ ...d, isSpecialEvent: e.target.checked }))
            }
            style={{ marginTop: 2 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tokens.color.ink900 }}>
              Special event rate
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: tokens.color.ink600,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              Marks every row in this batch as a special event for pay-rate calculation.
            </div>
          </div>
        </label>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: tokens.color.ink600,
            }}
          >
            Shifts ({rows.length})
          </div>
          <span style={{ fontSize: 11.5, color: tokens.color.ink500 }}>
            Up to {CUSTOM_ROW_CAP} per submit
          </span>
        </div>

        {rows.map((row, idx) => (
          <CustomRowCard
            key={row.id}
            index={idx + 1}
            row={row}
            venues={venues}
            officers={officers}
            inheritedStaffCount={defaults.staffUserIds.length}
            onUpdate={(patch) => updateRow(row.id, patch)}
            onRemove={() => removeRow(row.id)}
            onToggleStaff={(officerId) => toggleRowStaff(row.id, officerId)}
            removable={rows.length > 1}
          />
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={atCap}
          style={{
            padding: "10px 12px",
            border: `1px dashed ${atCap ? tokens.color.ink200 : tokens.color.ink400}`,
            borderRadius: tokens.radius.md,
            background: "white",
            color: atCap ? tokens.color.ink500 : tokens.color.ink800,
            fontSize: 13,
            fontWeight: 600,
            cursor: atCap ? "not-allowed" : "pointer",
            fontFamily: tokens.font.body,
          }}
        >
          {atCap ? `Row cap reached (${CUSTOM_ROW_CAP})` : "+ Add shift"}
        </button>
      </section>

      {(formError || validationError) && (
        <InlineError>{formError ?? validationError}</InlineError>
      )}
    </div>
  );
}

interface CustomRowCardProps {
  index: number;
  row: CustomRow;
  venues: ReturnType<typeof useScheduling>["venues"];
  officers: ReturnType<typeof useScheduling>["officers"];
  inheritedStaffCount: number;
  onUpdate: (patch: Partial<CustomRow>) => void;
  onRemove: () => void;
  onToggleStaff: (officerId: string) => void;
  removable: boolean;
}

function CustomRowCard({
  index,
  row,
  venues,
  officers,
  inheritedStaffCount,
  onUpdate,
  onRemove,
  onToggleStaff,
  removable,
}: CustomRowCardProps) {
  const crosses = rowCrossesMidnight(row);
  const effectiveStaffCount = row.staff_users.length || inheritedStaffCount;
  const staffShortfall = row.officers_needed > effectiveStaffCount;

  return (
    <div
      style={{
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.md,
        padding: 12,
        background: "white",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tokens.color.ink500,
          }}
        >
          Row {index}
        </span>
        <input
          type="date"
          value={row.date}
          onChange={(e) => onUpdate({ date: e.target.value })}
          style={{ ...inputStyle, fontSize: 12.5, padding: "6px 8px" }}
        />
        <select
          value={row.venue_id == null ? "" : String(row.venue_id)}
          onChange={(e) =>
            onUpdate({
              venue_id: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          style={{ ...selectStyle, fontSize: 12.5, padding: "6px 8px", flex: 1, minWidth: 160 }}
        >
          <option value="" disabled>
            Pick venue…
          </option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.area ? ` · ${v.area}` : ""}
            </option>
          ))}
        </select>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove row ${index}`}
            style={{
              ...pencilButtonStyle,
              marginLeft: "auto",
              color: tokens.color.dangerInk,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              role="img"
            >
              <title>Remove this row</title>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="time"
          value={row.start_time}
          onChange={(e) => onUpdate({ start_time: e.target.value })}
          style={{ ...inputStyle, fontSize: 12.5, padding: "6px 8px", width: 110 }}
        />
        <span style={{ color: tokens.color.ink500 }}>–</span>
        <input
          type="time"
          value={row.end_time}
          onChange={(e) => onUpdate({ end_time: e.target.value })}
          style={{ ...inputStyle, fontSize: 12.5, padding: "6px 8px", width: 110 }}
        />
        {crosses && (
          <span style={{ fontSize: 11.5, color: tokens.color.ink600 }}>
            (crosses midnight)
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, color: tokens.color.ink600 }}>Officers</span>
          <input
            type="number"
            min={1}
            max={50}
            value={row.officers_needed}
            onChange={(e) =>
              onUpdate({ officers_needed: Math.max(1, Number(e.target.value) || 1) })
            }
            style={{ ...inputStyle, fontSize: 12.5, padding: "6px 8px", width: 70 }}
          />
        </span>
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: tokens.color.ink600,
            marginBottom: 6,
          }}
        >
          Staff (overrides default)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {officers.length === 0 ? (
            <span style={hintStyle}>No approved staff yet.</span>
          ) : (
            officers.map((o) => {
              const numericId = Number(o.id.replace(/^u/, ""));
              const active = row.staff_users.includes(numericId);
              return (
                <Chip
                  key={o.id}
                  active={active}
                  onClick={() => onToggleStaff(o.id)}
                  title={`${o.name} · ${o.sia.level}`}
                >
                  {o.name}
                </Chip>
              );
            })
          )}
        </div>
        <span style={{ ...hintStyle, marginTop: 6 }}>
          {row.staff_users.length === 0
            ? inheritedStaffCount > 0
              ? `Will inherit ${inheritedStaffCount} default staff at submit.`
              : "No staff selected — slots will be created open."
            : `${row.staff_users.length} selected`}
          {staffShortfall &&
            ` · ${row.officers_needed - effectiveStaffCount} slot${
              row.officers_needed - effectiveStaffCount === 1 ? "" : "s"
            } will be open`}
        </span>
      </div>
    </div>
  );
}

function cloneShift(s: BulkCreatePreviewShift): BulkCreatePreviewShift {
  return {
    ...s,
    slots: s.slots.map((slot) => ({ ...slot })),
  };
}

function isoToTimeHHmm(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "00:00";
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

// Replace HH:mm on an existing ISO datetime, preserving its date in local time.
function setTimeOnIso(iso: string, hhmm: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const [h, m] = hhmm.split(":").map(Number);
  const next = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), h ?? 0, m ?? 0, 0, 0);
  return next.toISOString();
}

interface EditableShiftRowProps {
  shift: BulkCreatePreviewShift;
  edited: boolean;
  venueName: string;
  officers: ReturnType<typeof useScheduling>["officers"];
  officerNameById: (id: number) => string;
  onEditTime: (startIso: string, endIso: string) => void;
  onSlotChange: (slotIdx: number, staffUserId: number | null) => void;
  onRemove: () => void;
}

function EditableShiftRow({
  shift,
  edited,
  venueName,
  officers,
  officerNameById,
  onEditTime,
  onSlotChange,
  onRemove,
}: EditableShiftRowProps) {
  const [editingTime, setEditingTime] = useState(false);
  const [draftStart, setDraftStart] = useState(() => isoToTimeHHmm(shift.start));
  const [draftEnd, setDraftEnd] = useState(() => isoToTimeHHmm(shift.end));
  const [removing, setRemoving] = useState(false);
  const startInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingTime) {
      setDraftStart(isoToTimeHHmm(shift.start));
      setDraftEnd(isoToTimeHHmm(shift.end));
      window.setTimeout(() => startInputRef.current?.focus(), 0);
    }
  }, [editingTime, shift.start, shift.end]);

  const draftCrossesMidnight = useMemo(() => {
    const [sh, sm] = draftStart.split(":").map(Number);
    const [eh, em] = draftEnd.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
    return (eh ?? 0) * 60 + (em ?? 0) < (sh ?? 0) * 60 + (sm ?? 0);
  }, [draftStart, draftEnd]);

  const commitTimeEdit = () => {
    if (!draftStart || !draftEnd || draftStart === draftEnd) {
      setEditingTime(false);
      return;
    }
    const newStartIso = setTimeOnIso(shift.start, draftStart);
    // The end-date anchor is whichever the original shift used (may already be
    // next day for overnight shifts). If the new draft crosses midnight, push
    // end forward by 1 day from the start's date.
    const startDt = new Date(newStartIso);
    let endDt = new Date(setTimeOnIso(shift.end, draftEnd));
    if (draftCrossesMidnight) {
      const base = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate() + 1);
      const [eh, em] = draftEnd.split(":").map(Number);
      endDt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), eh ?? 0, em ?? 0, 0, 0);
    } else {
      endDt = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate(),
        ...(draftEnd.split(":").map(Number) as [number, number]), 0, 0);
    }
    onEditTime(newStartIso, endDt.toISOString());
    setEditingTime(false);
  };

  const cancelTimeEdit = () => setEditingTime(false);

  const handleRemoveClick = () => {
    setRemoving(true);
    window.setTimeout(onRemove, 150);
  };

  const slotsLocked = shift.slots.length;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderTop: `1px solid ${tokens.color.ink100}`,
        opacity: removing ? 0 : 1,
        transition: "opacity 150ms ease",
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          color: tokens.color.ink700,
          marginBottom: 6,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {editingTime ? (
          <>
            <input
              ref={startInputRef}
              type="time"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTimeEdit();
                if (e.key === "Escape") cancelTimeEdit();
              }}
              style={timeInputStyle}
            />
            <span style={{ color: tokens.color.ink500 }}>–</span>
            <input
              type="time"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTimeEdit();
                if (e.key === "Escape") cancelTimeEdit();
              }}
              style={timeInputStyle}
            />
            <button
              type="button"
              onClick={commitTimeEdit}
              aria-label="Save time"
              style={iconButtonStyle("ok")}
            >
              ✓
            </button>
            <button
              type="button"
              onClick={cancelTimeEdit}
              aria-label="Cancel time edit"
              style={iconButtonStyle("ghost")}
            >
              ✕
            </button>
            {draftCrossesMidnight && (
              <span style={{ fontSize: 11.5, color: tokens.color.ink600 }}>(crosses midnight)</span>
            )}
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600, color: tokens.color.ink900 }}>
              {formatTimeRange(shift.start, shift.end)}
            </span>
            <button
              type="button"
              onClick={() => setEditingTime(true)}
              aria-label="Edit time"
              style={pencilButtonStyle}
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
              >
                <title>Edit time</title>
                <path d="M4 20h4L20 8l-4-4L4 16v4z" />
              </svg>
            </button>
            <span style={{ color: tokens.color.ink500 }}>· {venueName}</span>
            {edited && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: tokens.color.warnInk,
                  background: tokens.color.warnSoft,
                  border: "1px solid #fad48a",
                  padding: "2px 6px",
                  borderRadius: tokens.radius.pill,
                }}
              >
                Edited
              </span>
            )}
            <button
              type="button"
              onClick={handleRemoveClick}
              aria-label="Remove this date"
              style={{ ...pencilButtonStyle, marginLeft: "auto", color: tokens.color.dangerInk }}
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
              >
                <title>Remove this date</title>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {shift.slots.map((slot, idx) => (
          <SlotChipEditor
            key={`${shift.preview_group_id}-${idx}`}
            slot={slot}
            edited={edited}
            officers={officers}
            officerNameById={officerNameById}
            // Filter out other slots' assignments to prevent assigning the same
            // officer to two seats on the same shift.
            disabledIds={shift.slots
              .map((s, i) => (i !== idx && s.staff_user != null ? s.staff_user : null))
              .filter((id): id is number => id != null)}
            onPick={(staffUserId) => onSlotChange(idx, staffUserId)}
          />
        ))}
      </div>
      {edited && (
        <div
          style={{
            fontSize: 11.5,
            color: tokens.color.ink500,
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          Will be re-checked on save ({slotsLocked} slot{slotsLocked === 1 ? "" : "s"})
        </div>
      )}
    </div>
  );
}

interface SlotChipEditorProps {
  slot: BulkCreatePreviewShift["slots"][number];
  edited: boolean;
  officers: ReturnType<typeof useScheduling>["officers"];
  officerNameById: (id: number) => string;
  disabledIds: number[];
  onPick: (staffUserId: number | null) => void;
}

function SlotChipEditor({
  slot,
  edited,
  officers,
  officerNameById,
  disabledIds,
  onPick,
}: SlotChipEditorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Edited rows have stale slot statuses, so we render a neutral grey pill
  // until the server re-validates on commit.
  const effectiveStatus: BulkCreateSlotStatus | "muted" = edited
    ? "muted"
    : slot.status;
  const label =
    slot.status === "open"
      ? "(open slot)"
      : slot.staff_user
        ? officerNameById(slot.staff_user)
        : "(open slot)";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          style={{
            ...slotPillStyle(effectiveStatus),
            cursor: "pointer",
            font: "inherit",
          }}
          title={!edited ? slot.reason : undefined}
        >
          <span aria-hidden>{slotSymbol(effectiveStatus)}</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {label}
          </span>
          {!edited && slot.status === "conflict" && slot.reason && (
            <span style={{ fontStyle: "italic", fontWeight: 400, opacity: 0.8 }}>
              · {slot.reason}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          style={{
            background: "white",
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            boxShadow: tokens.shadow.md,
            padding: 6,
            width: 240,
            fontFamily: tokens.font.body,
            zIndex: tokens.z.overlay,
          }}
        >
          <input
            type="text"
            placeholder="Search staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            ref={(el) => {
              if (el) window.setTimeout(() => el.focus(), 0);
            }}
            style={{
              ...inputStyle,
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 6,
              fontSize: 12.5,
              padding: "6px 8px",
            }}
          />
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <button
              type="button"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
              style={popoverItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.color.ink50;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ color: tokens.color.ink600 }}>Unassign / leave open</span>
            </button>
            {officers
              .filter((o) => {
                if (!query) return true;
                return o.name.toLowerCase().includes(query.toLowerCase());
              })
              .map((o) => {
                const numericId = Number(o.id.replace(/^u/, ""));
                const isDisabled = disabledIds.includes(numericId);
                const isCurrent = slot.staff_user === numericId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onPick(numericId);
                      setOpen(false);
                    }}
                    style={{
                      ...popoverItemStyle,
                      opacity: isDisabled ? 0.45 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      background: isCurrent ? tokens.color.ink50 : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled) e.currentTarget.style.background = tokens.color.ink100;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isCurrent
                        ? tokens.color.ink50
                        : "transparent";
                    }}
                  >
                    <span style={{ color: tokens.color.ink900, fontWeight: 500 }}>{o.name}</span>
                    {isDisabled && (
                      <span style={{ fontSize: 10.5, color: tokens.color.ink500, marginLeft: 8 }}>
                        already in shift
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface ResultStepProps {
  created: number;
  skipped: number;
  publishOnCreate: boolean;
}

function ResultStep({ created, skipped, publishOnCreate }: ResultStepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <ResultTile value={created} label={created === 1 ? "shift created" : "shifts created"} tone="ok" />
        {skipped > 0 && (
          <ResultTile
            value={skipped}
            label={skipped === 1 ? "open slot remaining" : "open slots remaining"}
            tone="warn"
          />
        )}
      </div>
      <div style={{ fontSize: 13, color: tokens.color.ink600, lineHeight: 1.5 }}>
        {publishOnCreate
          ? "Shifts have been published and assigned staff have been notified."
          : "Shifts saved as drafts. Use Publish week in the scheduler header when you're ready to notify staff."}
      </div>
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["config", "preview", "result"];
  const idx = order.indexOf(step);
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {order.map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i <= idx ? tokens.color.ink800 : tokens.color.ink200,
            transition: `background ${tokens.motion.fast}`,
          }}
        />
      ))}
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
  symbol,
}: {
  label: string;
  value: number;
  tone: "ink" | "ok" | "warn" | "mute";
  symbol?: string;
}) {
  const colors = {
    ink: { fg: tokens.color.ink900, sub: tokens.color.ink600 },
    ok: { fg: tokens.color.successInk, sub: tokens.color.ink600 },
    warn: { fg: tokens.color.warnInk, sub: tokens.color.ink600 },
    mute: { fg: tokens.color.ink700, sub: tokens.color.ink500 },
  }[tone];
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 100 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: colors.sub,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: tokens.font.display,
          color: colors.fg,
          letterSpacing: "-0.01em",
        }}
      >
        {symbol ? <span style={{ marginRight: 6 }}>{symbol}</span> : null}
        {value}
      </span>
    </div>
  );
}

function ResultTile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "ok" | "warn";
}) {
  const bg = tone === "ok" ? tokens.color.successSoft : tokens.color.warnSoft;
  const fg = tone === "ok" ? tokens.color.successInk : tokens.color.warnInk;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 180,
        padding: "16px 18px",
        background: bg,
        borderRadius: tokens.radius.md,
        border: `1px solid ${tone === "ok" ? "#bce0c5" : "#fad48a"}`,
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          fontFamily: tokens.font.display,
          color: fg,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: fg, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

type SlotPillTone = BulkCreateSlotStatus | "muted";

const SLOT_PALETTE: Record<
  SlotPillTone,
  { bg: string; fg: string; border: string; symbol: string }
> = {
  ok: {
    bg: tokens.color.successSoft,
    fg: tokens.color.successInk,
    border: "#bce0c5",
    symbol: "✓",
  },
  conflict: {
    bg: tokens.color.warnSoft,
    fg: tokens.color.warnInk,
    border: "#fad48a",
    symbol: "⚠",
  },
  open: {
    bg: tokens.color.ink100,
    fg: tokens.color.ink700,
    border: tokens.color.ink200,
    symbol: "○",
  },
  muted: {
    bg: tokens.color.ink100,
    fg: tokens.color.ink700,
    border: tokens.color.ink200,
    symbol: "•",
  },
};

function slotPillStyle(tone: SlotPillTone): React.CSSProperties {
  const p = SLOT_PALETTE[tone];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: tokens.radius.pill,
    background: p.bg,
    color: p.fg,
    border: `1px solid ${p.border}`,
    fontSize: 12,
    fontWeight: 600,
    maxWidth: "100%",
  };
}

function slotSymbol(tone: SlotPillTone): string {
  return SLOT_PALETTE[tone].symbol;
}

function Chip({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "6px 12px",
        borderRadius: tokens.radius.pill,
        border: `1px solid ${active ? tokens.color.ink900 : tokens.color.ink300}`,
        background: active ? tokens.color.ink900 : "white",
        color: active ? "white" : tokens.color.ink800,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        fontFamily: tokens.font.body,
        transition: `background ${tokens.motion.fast}, border-color ${tokens.motion.fast}`,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
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

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: tokens.color.ink500,
      }}
    >
      {children}
    </span>
  );
}

function InlineError({ children }: { children: React.ReactNode }) {
  return (
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

const hintStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: tokens.color.ink600,
  marginTop: 4,
  lineHeight: 1.4,
};

const timeInputStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.color.ink300}`,
  fontSize: 12.5,
  fontFamily: tokens.font.body,
  color: tokens.color.ink900,
  background: "white",
};

function iconButtonStyle(tone: "ok" | "ghost"): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm,
    border:
      tone === "ok"
        ? `1px solid ${tokens.color.successInk}`
        : `1px solid ${tokens.color.ink300}`,
    background: tone === "ok" ? tokens.color.successSoft : "white",
    color: tone === "ok" ? tokens.color.successInk : tokens.color.ink700,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: 0,
  };
}

const pencilButtonStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: tokens.radius.sm,
  border: "1px solid transparent",
  background: "transparent",
  color: tokens.color.ink600,
  cursor: "pointer",
  padding: 0,
};

const popoverItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  padding: "7px 9px",
  borderRadius: tokens.radius.sm,
  fontSize: 12.5,
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: tokens.font.body,
  color: tokens.color.ink800,
};
