// SIA licence rules shared by the drawer tab and the directory table.
//
// Status comes from the server: a licence is only "Verified" once an approver
// has signed it off, which is what `is_eligible_for_shifts()` reads. The pill
// used to be derived from the expiry date alone, so a licence nobody had
// verified read "Valid" while the officer could not be booked onto a shift.
import type { PillTone } from "../../../design-system/primitives/Pill";
import type { SIALicenseRecord } from "../hooks/useStaffData";

export const CARD_MAX_BYTES = 10 * 1024 * 1024;
export const CARD_ACCEPT = "image/jpeg,image/png,application/pdf";
const CARD_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

function isoFor(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Today as a local YYYY-MM-DD. Dates are compared as strings because
 * `new Date("2026-09-17")` is UTC midnight, which moves the day either side of
 * Greenwich.
 */
export function todayIso(): string {
  return isoFor(new Date());
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoFor(d);
}

/** The card prints the number in groups; the record stores the 16 digits. */
export function normaliseLicenceNumber(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function isValidLicenceNumber(value: string): boolean {
  return /^[0-9]{16}$/.test(normaliseLicenceNumber(value));
}

/** Mirrors the server's checks so a bad file is caught before a 10 MB upload. */
export function validateCardFile(file: File): string | null {
  if (!CARD_TYPES.has(file.type)) {
    if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
      return "iPhone HEIC photos can't be uploaded. Export the photo as a JPEG, or screenshot it, and upload that.";
    }
    return "The card must be a JPEG, PNG or PDF.";
  }
  if (file.size > CARD_MAX_BYTES) return "The card must be 10 MB or smaller.";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type SiaStatusKind =
  | "expired"
  | "pending"
  | "expiring"
  | "verified"
  | "unknown";

export interface SiaStatus {
  kind: SiaStatusKind;
  tone: PillTone;
  label: string;
  /** Pending, in date, and waiting on an approver. */
  canVerify: boolean;
}

export function siaStatusFor(
  lic: Pick<SIALicenseRecord, "status" | "expiry_date">,
): SiaStatus {
  const expiry = lic.expiry_date?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    return { kind: "unknown", tone: "neutral", label: "Unknown", canVerify: false };
  }
  // The server treats a licence as in date through its expiry day.
  if (expiry < todayIso()) {
    return { kind: "expired", tone: "danger", label: "Expired", canVerify: false };
  }
  // Anything not signed off — including an `expired` record whose dates were
  // since corrected — needs an approver; approving re-derives the status.
  if (lic.status !== "valid") {
    return {
      kind: "pending",
      tone: "info",
      label: "Pending verification",
      canVerify: true,
    };
  }
  if (expiry < addDaysIso(90)) {
    return { kind: "expiring", tone: "warning", label: "Expiring soon", canVerify: false };
  }
  return { kind: "verified", tone: "positive", label: "Verified", canVerify: false };
}
