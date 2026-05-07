// ProfileFormModal — create or edit a ComplianceProfile.
// Lean form: name, description, override thresholds (optional), warning
// thresholds, approval flags. Region selection is read-only when editing
// (the working_hours_regulation FK is a major schema decision — keep that
// out of v1 to avoid breaking existing profiles).
import { useEffect, useState, type ChangeEvent } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { Input } from "../../../design-system/primitives/Input";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";
import type {
  ComplianceProfile,
  WorkingHoursRegulation,
} from "../../../types/compliance";

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

const SELECT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink900,
  background: "white",
  border: `1px solid ${tokens.color.ink300}`,
  borderRadius: tokens.radius.md,
  outline: "none",
};

interface FormState {
  name: string;
  description: string;
  override_max_daily_hours: string;
  override_max_weekly_hours: string;
  override_max_consecutive_days: string;
  daily_hours_warning_threshold: string;
  weekly_hours_warning_threshold: string;
  auto_approve_overtime: boolean;
  require_manager_approval: boolean;
  notify_on_violations: boolean;
  working_hours_regulation: string;
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    override_max_daily_hours: "",
    override_max_weekly_hours: "",
    override_max_consecutive_days: "",
    daily_hours_warning_threshold: "",
    weekly_hours_warning_threshold: "",
    auto_approve_overtime: false,
    require_manager_approval: true,
    notify_on_violations: true,
    working_hours_regulation: "",
  };
}

function fromProfile(p: ComplianceProfile): FormState {
  return {
    name: p.name,
    description: p.description ?? "",
    override_max_daily_hours: p.override_max_daily_hours ?? "",
    override_max_weekly_hours: p.override_max_weekly_hours ?? "",
    override_max_consecutive_days:
      p.override_max_consecutive_days != null
        ? String(p.override_max_consecutive_days)
        : "",
    daily_hours_warning_threshold: p.daily_hours_warning_threshold ?? "",
    weekly_hours_warning_threshold: p.weekly_hours_warning_threshold ?? "",
    auto_approve_overtime: p.auto_approve_overtime ?? false,
    require_manager_approval: p.require_manager_approval ?? true,
    notify_on_violations: p.notify_on_violations ?? true,
    working_hours_regulation: String(p.working_hours_regulation ?? ""),
  };
}

export interface ProfileFormModalProps {
  open: boolean;
  profile: ComplianceProfile | null;
  regulations: WorkingHoursRegulation[];
  onClose: () => void;
  onSubmit: (
    payload: Partial<ComplianceProfile> & { id?: number },
  ) => Promise<void>;
  isSubmitting: boolean;
}

export function ProfileFormModal({
  open,
  profile,
  regulations,
  onClose,
  onSubmit,
  isSubmitting,
}: ProfileFormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(profile ? fromProfile(profile) : emptyForm());
    setError(null);
    setShowHelp(false);
  }, [open, profile]);

  const isEdit = profile != null;

  const update =
    <K extends keyof FormState>(key: K) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const target = e.target;
      const value =
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.value;
      setForm((prev) => ({ ...prev, [key]: value as FormState[K] }));
    };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!isEdit && !form.working_hours_regulation) {
      setError("Pick a working-hours regulation to base this profile on.");
      return;
    }

    const payload: Partial<ComplianceProfile> & { id?: number } = {
      ...(isEdit ? { id: profile?.id } : {}),
      name: form.name.trim(),
      description: form.description.trim(),
      auto_approve_overtime: form.auto_approve_overtime,
      require_manager_approval: form.require_manager_approval,
      notify_on_violations: form.notify_on_violations,
    };

    // Only include numeric overrides when filled — empty string means "no override".
    if (form.override_max_daily_hours)
      payload.override_max_daily_hours = form.override_max_daily_hours;
    if (form.override_max_weekly_hours)
      payload.override_max_weekly_hours = form.override_max_weekly_hours;
    if (form.override_max_consecutive_days)
      payload.override_max_consecutive_days = Number.parseInt(
        form.override_max_consecutive_days,
        10,
      );
    if (form.daily_hours_warning_threshold)
      payload.daily_hours_warning_threshold = form.daily_hours_warning_threshold;
    if (form.weekly_hours_warning_threshold)
      payload.weekly_hours_warning_threshold =
        form.weekly_hours_warning_threshold;

    if (!isEdit && form.working_hours_regulation) {
      payload.working_hours_regulation = Number.parseInt(
        form.working_hours_regulation,
        10,
      );
    }

    try {
      await onSubmit(payload);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't save profile. Please try again.",
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit compliance profile" : "New compliance profile"}
      description={
        isEdit
          ? "Update thresholds and approval rules for this profile."
          : "Profiles bundle a working-hours regulation with custom thresholds."
      }
      size="lg"
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
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create profile"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <HelpToggle open={showHelp} onToggle={() => setShowHelp((v) => !v)} />
        {showHelp && <HelpPanel />}

        <div>
          <label htmlFor="profile-name" style={FIELD_LABEL}>
            Name <span style={{ color: tokens.color.danger }}>*</span>
          </label>
          <Input
            id="profile-name"
            value={form.name}
            onChange={update("name")}
            placeholder="UK standard"
          />
        </div>

        <div>
          <label htmlFor="profile-description" style={FIELD_LABEL}>
            Description
          </label>
          <textarea
            id="profile-description"
            value={form.description}
            onChange={update("description")}
            placeholder="When should this profile apply, and what makes it different?"
            rows={3}
            style={TEXTAREA_STYLE}
          />
        </div>

        {!isEdit && (
          <div>
            <label htmlFor="profile-region" style={FIELD_LABEL}>
              Working-hours regulation{" "}
              <span style={{ color: tokens.color.danger }}>*</span>
            </label>
            <select
              id="profile-region"
              value={form.working_hours_regulation}
              onChange={update("working_hours_regulation")}
              style={SELECT_STYLE}
            >
              <option value="">Select a regulation…</option>
              {regulations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.country_code?.toUpperCase()} ·{" "}
                  {r.country_name ?? `Regulation #${r.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <NumberField
            label="Max daily hrs (override)"
            value={form.override_max_daily_hours}
            onChange={update("override_max_daily_hours")}
            placeholder="e.g. 12"
          />
          <NumberField
            label="Max weekly hrs (override)"
            value={form.override_max_weekly_hours}
            onChange={update("override_max_weekly_hours")}
            placeholder="e.g. 48"
          />
          <NumberField
            label="Max consecutive days"
            value={form.override_max_consecutive_days}
            onChange={update("override_max_consecutive_days")}
            placeholder="e.g. 6"
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <NumberField
            label="Daily warning %"
            value={form.daily_hours_warning_threshold}
            onChange={update("daily_hours_warning_threshold")}
            placeholder="e.g. 80"
            min={50}
            max={99}
            hint="% of daily limit before a warning fires (50–99)."
          />
          <NumberField
            label="Weekly warning %"
            value={form.weekly_hours_warning_threshold}
            onChange={update("weekly_hours_warning_threshold")}
            placeholder="e.g. 85"
            min={50}
            max={99}
            hint="% of weekly limit before a warning fires (50–99)."
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Toggle
            label="Auto-approve overtime"
            description="Skip manager approval when overtime stays under thresholds."
            checked={form.auto_approve_overtime}
            onChange={update("auto_approve_overtime")}
          />
          <Toggle
            label="Require manager approval"
            description="All overtime must be approved before counting toward payroll."
            checked={form.require_manager_approval}
            onChange={update("require_manager_approval")}
          />
          <Toggle
            label="Notify on violations"
            description="Email recipients listed in the profile when a violation lands."
            checked={form.notify_on_violations}
            onChange={update("notify_on_violations")}
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
              whiteSpace: "pre-line",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <div style={FIELD_LABEL}>{label}</div>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
      />
      {hint && (
        <div style={{ fontSize: 11, color: tokens.color.ink500, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        cursor: "pointer",
        padding: "10px 12px",
        background: tokens.color.ink50,
        border: `1px solid ${tokens.color.ink100}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 3 }}
      />
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: tokens.font.display,
            fontWeight: 600,
            fontSize: 13,
            color: tokens.color.ink900,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 12,
            color: tokens.color.ink600,
            marginTop: 2,
          }}
        >
          {description}
        </span>
      </span>
    </label>
  );
}

// ── Tutorial / "Learn how this works" panel ───────────────────────────────

function HelpToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        padding: "6px 10px",
        background: open ? tokens.color.ink100 : tokens.color.ink50,
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.md,
        cursor: "pointer",
        color: tokens.color.ink800,
        fontFamily: tokens.font.body,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <Icon name="info" size={13} />
      {open ? "Hide tutorial" : "Learn how this works"}
      <Icon name={open ? "chevron-down" : "chevron-right"} size={12} />
    </button>
  );
}

function HelpPanel() {
  const sectionTitle: React.CSSProperties = {
    fontFamily: tokens.font.display,
    fontWeight: 700,
    fontSize: 13,
    color: tokens.color.ink900,
    margin: "12px 0 6px",
  };
  const para: React.CSSProperties = {
    fontFamily: tokens.font.body,
    fontSize: 12.5,
    lineHeight: 1.55,
    color: tokens.color.ink700,
    margin: 0,
  };
  const list: React.CSSProperties = {
    ...para,
    margin: 0,
    paddingLeft: 18,
  };
  const code: React.CSSProperties = {
    fontFamily: tokens.font.mono,
    fontSize: 11.5,
    background: "white",
    border: `1px solid ${tokens.color.ink200}`,
    padding: "1px 5px",
    borderRadius: 4,
    color: tokens.color.ink800,
  };

  return (
    <div
      style={{
        background: tokens.color.ink50,
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.md,
        padding: "14px 16px",
      }}
    >
      <div style={{ ...sectionTitle, marginTop: 0 }}>What this page does</div>
      <p style={para}>
        Compliance enforces working-time rules on staff schedules and check-ins.
        Three pieces work together:
      </p>
      <ol style={list}>
        <li>
          <strong>Working-hours regulations</strong> — country defaults (e.g.{" "}
          <span style={code}>GB · United Kingdom</span> ships statutory limits:
          13h/day, 48h/week, 6 consecutive days). You don't create these — pick
          one as the base.
        </li>
        <li>
          <strong>This profile</strong> — your overrides on top of the base.
          Optional stricter limits, warning thresholds, auto-approval and
          notification rules.
        </li>
        <li>
          <strong>Violations</strong> — when a scheduled or worked shift breaches
          the active profile, the system logs a violation. Resolve them from the
          Violations tab.
        </li>
      </ol>

      <div style={sectionTitle}>How to set this profile up</div>
      <ol style={list}>
        <li>
          <strong>Name</strong> it (e.g. "Standard UK Operation").
        </li>
        <li>
          <strong>Pick a regulation</strong> matching the country you operate in.
        </li>
        <li>
          <strong>Override the limits</strong> only if you want stricter than the
          regulation. Leave blank to use the regulation's defaults.
        </li>
        <li>
          <strong>Set warning %s</strong> — values 50–99. <span style={code}>80</span>{" "}
          means "warn at 80% of the daily limit, before a hard violation."
        </li>
        <li>
          <strong>Approval rules</strong> — usually keep "Require manager
          approval" on so questionable shifts go through review.
        </li>
        <li>
          Save → then <strong>Set Active</strong> from the Profiles list. Only
          one profile can be active at a time.
        </li>
      </ol>

      <div style={sectionTitle}>Field cheatsheet</div>
      <ul style={list}>
        <li>
          <strong>Max daily/weekly hrs (override)</strong> — only fill if you
          want stricter than the regulation; blank = regulation default.
        </li>
        <li>
          <strong>Max consecutive days</strong> — same idea; e.g. 6 means staff
          can't be scheduled 7+ days in a row.
        </li>
        <li>
          <strong>Daily/Weekly warning %</strong> — early-warning threshold
          before a violation. Typical: 80–85.
        </li>
        <li>
          <strong>Auto-approve overtime</strong> — skips manager review when
          overtime stays within thresholds. Off by default.
        </li>
        <li>
          <strong>Notify on violations</strong> — emails the recipients listed on
          the profile when a violation lands.
        </li>
      </ul>
    </div>
  );
}
