/**
 * Which SIA licence to show for an officer, and what state it is in.
 *
 * The API sends a profile's licences as `sia_licenses` (a list). The Virtual
 * ID and Edit Profile screens read `sia_license_number` / `sia_license_expiry`,
 * fields the API has never sent, so every officer's Virtual ID showed no
 * licence number and the licence as "Expired", and its QR code claimed
 * `verified: true` regardless. One place for all three profile screens.
 */

export interface SiaLicence {
  id?: number;
  license_number?: string | null;
  license_type?: string | null;
  expiry_date?: string | null;
  status?: string | null; // 'valid' | 'pending' | 'expired'
}

export type LicenceState = 'active' | 'expiring' | 'pending' | 'expired';

export const LICENCE_STATE_LABEL: Record<LicenceState, string> = {
  active: 'Active',
  expiring: 'Expiring soon',
  pending: 'Awaiting check',
  expired: 'Expired',
};

const EXPIRING_DAYS = 30;

/** Today as YYYY-MM-DD in the phone's own calendar. */
function today(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A licence is good through the whole of its expiry date. */
function isPastExpiry(licence: SiaLicence, now: Date): boolean {
  const expiry = licence.expiry_date?.slice(0, 10);
  return !!expiry && expiry < today(now);
}

export function licenceState(licence: SiaLicence | null | undefined, now = new Date()): LicenceState | null {
  if (!licence) return null;
  if (licence.status === 'expired' || isPastExpiry(licence, now)) return 'expired';
  if (licence.status === 'pending') return 'pending';
  const expiry = licence.expiry_date?.slice(0, 10);
  if (expiry) {
    const [y, m, d] = expiry.split('-').map(Number);
    const endOfExpiryDay = new Date(y, m - 1, d, 23, 59, 59);
    const daysLeft = (endOfExpiryDay.getTime() - now.getTime()) / 86_400_000;
    if (daysLeft <= EXPIRING_DAYS) return 'expiring';
  }
  return 'active';
}

const RANK: Record<LicenceState, number> = { active: 0, expiring: 1, pending: 2, expired: 3 };

/**
 * The licence to show: a checked, in-date one first, then one awaiting a
 * check, then the most recently expired. Ties go to the later expiry.
 */
export function currentLicence(
  licences: SiaLicence[] | null | undefined,
  now = new Date(),
): SiaLicence | null {
  if (!licences || licences.length === 0) return null;
  return [...licences].sort((a, b) => {
    const byState = RANK[licenceState(a, now)!] - RANK[licenceState(b, now)!];
    if (byState !== 0) return byState;
    return (b.expiry_date ?? '').localeCompare(a.expiry_date ?? '');
  })[0];
}

/** Whether a licence may be presented as verified (checked and in date). */
export function isLicenceVerified(licence: SiaLicence | null | undefined, now = new Date()): boolean {
  const state = licenceState(licence, now);
  return state === 'active' || state === 'expiring';
}
