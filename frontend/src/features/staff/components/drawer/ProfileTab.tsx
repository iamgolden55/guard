import { useState } from "react";
import { Button } from "../../../../design-system/primitives/Button";
import { tokens } from "../../../../design-system/tokens";
import type { StaffRow } from "../StaffTable";

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13.5,
          color: tokens.color.ink900,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export interface ProfileTabProps {
  row: StaffRow;
  employmentTypeOptions: string[];
  onUpdateEmploymentType?: (
    userId: number,
    staffProfileId: number | null,
    value: string | null,
  ) => Promise<void>;
  onUpdatePayFrequency?: (
    staffProfileId: number,
    value: "weekly" | "monthly",
  ) => Promise<void>;
  onApprove?: (row: StaffRow) => Promise<void>;
  onDelete?: (row: StaffRow) => Promise<void>;
  onUnlockAccount?: (row: StaffRow) => Promise<{ was_locked: boolean }>;
  isUnlockingAccount?: boolean;
  isMutating: boolean;
}

export function ProfileTab({
  row,
  employmentTypeOptions,
  onUpdateEmploymentType,
  onUpdatePayFrequency,
  onApprove,
  onDelete,
  onUnlockAccount,
  isUnlockingAccount,
  isMutating,
}: ProfileTabProps) {
  const [employment, setEmployment] = useState<string>(row.employmentType ?? "");
  const [employmentSaving, setEmploymentSaving] = useState(false);
  const [employmentError, setEmploymentError] = useState<string | null>(null);
  const [payFreqSaving, setPayFreqSaving] = useState(false);
  const [payFreqError, setPayFreqError] = useState<string | null>(null);
  const [unlockNotice, setUnlockNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const handleUnlock = async () => {
    if (!onUnlockAccount) return;
    setUnlockNotice(null);
    try {
      const result = await onUnlockAccount(row);
      setUnlockNotice({
        tone: "success",
        text: result.was_locked
          ? `${row.fullName}'s account has been unlocked.`
          : `${row.fullName} had no active lockout. Failed-attempt counter reset.`,
      });
      window.setTimeout(() => setUnlockNotice(null), 6000);
    } catch (err) {
      const errData = (err as { response?: { data?: unknown } } | undefined)?.response?.data;
      const message =
        errData && typeof errData === "object" && !Array.isArray(errData) && "error" in errData
          ? String((errData as { error: unknown }).error)
          : "Couldn't unlock account. Try again in a moment.";
      setUnlockNotice({ tone: "danger", text: message });
      window.setTimeout(() => setUnlockNotice(null), 6000);
    }
  };

  const handleSaveEmployment = async () => {
    if (!onUpdateEmploymentType) return;
    setEmploymentError(null);
    setEmploymentSaving(true);
    try {
      await onUpdateEmploymentType(row.id, row.staffProfileId ?? null, employment || null);
    } catch (err) {
      setEmploymentError(
        err instanceof Error
          ? err.message
          : "Couldn't save employment type. Try again.",
      );
    } finally {
      setEmploymentSaving(false);
    }
  };

  const handleSetPayFrequency = async (next: "weekly" | "monthly") => {
    if (!onUpdatePayFrequency || !row.staffProfileId || next === row.payFrequency) return;
    setPayFreqError(null);
    setPayFreqSaving(true);
    try {
      await onUpdatePayFrequency(row.staffProfileId, next);
    } catch {
      setPayFreqError("Couldn't save pay frequency. Try again.");
    } finally {
      setPayFreqSaving(false);
    }
  };

  const employmentDirty = (row.employmentType ?? "") !== employment;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px 24px",
        }}
      >
        <Row label="Full name">{row.fullName}</Row>
        <Row label="Email">{row.email || "—"}</Row>
        <Row label="Joined">{formatDate(row.joined)}</Row>
        <Row label="Status">{row.isPending ? "Pending approval" : "Active"}</Row>
      </div>

      <div
        style={{
          paddingTop: 16,
          borderTop: `1px solid ${tokens.color.ink200}`,
        }}
      >
        <div
          style={{
            fontFamily: tokens.font.body,
            fontWeight: 700,
            fontSize: 10.5,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tokens.color.ink500,
            marginBottom: 8,
          }}
        >
          Employment type
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={employment}
            onChange={(e) => setEmployment(e.target.value)}
            disabled={!onUpdateEmploymentType || employmentSaving}
            style={{
              flex: 1,
              height: 36,
              padding: "0 12px",
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: tokens.radius.md,
              background: "white",
              fontFamily: tokens.font.body,
              fontSize: 13.5,
              color: tokens.color.ink900,
            }}
          >
            <option value="">Not set</option>
            {employmentTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveEmployment}
            disabled={!employmentDirty || employmentSaving}
          >
            {employmentSaving ? "Saving…" : "Save"}
          </Button>
        </div>
        {employmentError && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: tokens.color.dangerInk,
              fontFamily: tokens.font.body,
            }}
          >
            {employmentError}
          </div>
        )}
      </div>

      <div
        style={{
          paddingTop: 16,
          borderTop: `1px solid ${tokens.color.ink200}`,
        }}
      >
        <div
          style={{
            fontFamily: tokens.font.body,
            fontWeight: 700,
            fontSize: 10.5,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tokens.color.ink500,
            marginBottom: 8,
          }}
        >
          Pay frequency
        </div>
        <div
          role="tablist"
          aria-label="Pay frequency"
          style={{
            display: "inline-flex",
            background: tokens.color.ink100,
            borderRadius: 999,
            padding: 3,
          }}
        >
          {(["weekly", "monthly"] as const).map((opt) => {
            const active = opt === row.payFrequency;
            return (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={
                  payFreqSaving ||
                  !onUpdatePayFrequency ||
                  !row.staffProfileId ||
                  active
                }
                onClick={() => handleSetPayFrequency(opt)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: tokens.font.body,
                  border: "none",
                  borderRadius: 999,
                  cursor: active || payFreqSaving ? "default" : "pointer",
                  background: active ? "white" : "transparent",
                  color: active ? tokens.color.ink900 : tokens.color.ink600,
                  boxShadow: active ? `0 1px 2px ${tokens.color.ink200}` : "none",
                  textTransform: "capitalize",
                  transition: "all .12s",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: payFreqError ? tokens.color.dangerInk : tokens.color.ink500,
            fontFamily: tokens.font.body,
            lineHeight: 1.5,
          }}
        >
          {payFreqError
            ? payFreqError
            : row.payFrequency === "weekly"
              ? "Invoices roll up into the weekly W-runs each Monday."
              : "Invoices roll up into the monthly M-runs on the 1st of each month."}
        </div>
      </div>

      <div
        style={{
          paddingTop: 16,
          borderTop: `1px solid ${tokens.color.ink200}`,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {row.isPending && onApprove && (
          <Button
            variant="primary"
            size="md"
            onClick={() => onApprove(row)}
            disabled={isMutating}
          >
            Approve staff member
          </Button>
        )}
        {!row.isPending && onUnlockAccount && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => void handleUnlock()}
            disabled={isUnlockingAccount}
          >
            {isUnlockingAccount ? "Unlocking…" : "Unlock account"}
          </Button>
        )}
        {onDelete && (
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              const ok = window.confirm(
                `Deactivate ${row.fullName}?\n\n` +
                  `They will lose access immediately. Their shift history, invoices, ` +
                  `and other records are preserved for 30 days, then permanently removed.\n\n` +
                  `If they have an in-progress shift, they need to check out first.`,
              );
              if (ok) void onDelete(row);
            }}
            disabled={isMutating}
          >
            Remove from team
          </Button>
        )}
      </div>
      {unlockNotice && (
        <div
          style={{
            fontSize: 12,
            color: unlockNotice.tone === "danger" ? tokens.color.dangerInk : tokens.color.ink700,
            background:
              unlockNotice.tone === "danger"
                ? `${tokens.color.danger}11`
                : `${tokens.color.ink100}`,
            border: `1px solid ${
              unlockNotice.tone === "danger" ? `${tokens.color.danger}33` : tokens.color.ink200
            }`,
            borderRadius: tokens.radius.md,
            padding: "8px 10px",
            fontFamily: tokens.font.body,
          }}
        >
          {unlockNotice.text}
        </div>
      )}
    </div>
  );
}
