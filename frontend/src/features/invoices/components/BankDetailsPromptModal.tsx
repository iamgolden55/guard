// BankDetailsPromptModal — captures missing officer bank details inline so
// the admin can keep going with the email-payslip / mark-paid action they
// were trying to do. Triggered when the selected invoice's party.bank is null.
//
// On submit, the parent saves to the StaffProfile's nested bank_details and
// (typically) chains the original action (email payslip) immediately after.
import { useEffect, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Modal } from "../../../design-system/primitives/Modal";
import { tokens } from "../../../design-system/tokens";

export interface BankDetailsPayload {
  account_name: string;
  bank_name: string;
  sort_code: string;
  account_number: string;
}

export interface BankDetailsPromptModalProps {
  open: boolean;
  onClose: () => void;
  /** Officer name for the modal subject (e.g. "Ninioritse Great Eruwa"). */
  officerName: string;
  /** Display the action the admin was attempting (e.g. "Email payslip"). */
  pendingActionLabel?: string;
  /** Submits the bank details to the backend. Throws on failure. */
  onSubmit: (payload: BankDetailsPayload) => Promise<unknown>;
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

// UK sort code: 6 digits, render as "##-##-##".
function formatSortCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function BankDetailsPromptModal({
  open,
  onClose,
  officerName,
  pendingActionLabel,
  onSubmit,
}: BankDetailsPromptModalProps) {
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAccountName(officerName);
      setBankName("");
      setSortCode("");
      setAccountNumber("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, officerName]);

  const handleSubmit = async () => {
    setError(null);
    if (!accountName.trim()) return setError("Account name is required.");
    if (!bankName.trim()) return setError("Bank name is required.");

    const sortDigits = sortCode.replace(/\D/g, "");
    if (sortDigits.length !== 6) {
      return setError("Sort code must be 6 digits (e.g. 12-34-56).");
    }

    const accountDigits = accountNumber.replace(/\D/g, "");
    if (accountDigits.length !== 8) {
      return setError("Account number must be 8 digits.");
    }

    setSubmitting(true);
    try {
      await onSubmit({
        account_name: accountName.trim(),
        bank_name: bankName.trim(),
        sort_code: formatSortCode(sortDigits),
        account_number: accountDigits,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save bank details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Add bank details"
      description={
        pendingActionLabel
          ? `${officerName} has no bank details on file — add them to continue with ${pendingActionLabel.toLowerCase()}.`
          : `${officerName} has no bank details on file. Add them so future payslips can include the destination account.`
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Save & continue"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Account holder name">
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Name on the account"
            style={inputStyle}
            autoFocus
          />
        </Field>
        <Field label="Bank">
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g. Barclays Bank"
            style={inputStyle}
          />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 12 }}>
          <Field label="Sort code">
            <input
              type="text"
              value={sortCode}
              onChange={(e) => setSortCode(formatSortCode(e.target.value))}
              placeholder="12-34-56"
              inputMode="numeric"
              maxLength={8}
              style={{
                ...inputStyle,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                letterSpacing: "0.04em",
              }}
            />
          </Field>
          <Field label="Account number">
            <input
              type="text"
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              placeholder="12345678"
              inputMode="numeric"
              maxLength={8}
              style={{
                ...inputStyle,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                letterSpacing: "0.04em",
              }}
            />
          </Field>
        </div>
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
          The account number and sort code are stored encrypted and are visible
          only on the officer's payslip and to admins reviewing pay.
        </div>
      </div>
    </Modal>
  );
}
