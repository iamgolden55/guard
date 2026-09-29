import { currentLicence, isLicenceVerified, licenceState } from '../siaLicence';

// Midday on 15 Mar 2027, local time.
const NOW = new Date(2027, 2, 15, 12, 0, 0);

describe('licenceState', () => {
  it('is still active on its expiry day, expired the day after', () => {
    expect(licenceState({ status: 'valid', expiry_date: '2027-06-15' }, NOW)).toBe('active');
    expect(licenceState({ status: 'valid', expiry_date: '2027-03-15' }, NOW)).toBe('expiring');
    expect(licenceState({ status: 'valid', expiry_date: '2027-03-14' }, NOW)).toBe('expired');
  });

  it('warns within 30 days', () => {
    expect(licenceState({ status: 'valid', expiry_date: '2027-04-10' }, NOW)).toBe('expiring');
    expect(licenceState({ status: 'valid', expiry_date: '2027-04-20' }, NOW)).toBe('active');
  });

  it('trusts an expired or pending status over a future date', () => {
    expect(licenceState({ status: 'expired', expiry_date: '2030-01-01' }, NOW)).toBe('expired');
    expect(licenceState({ status: 'pending', expiry_date: '2030-01-01' }, NOW)).toBe('pending');
  });

  it('has no state without a licence', () => {
    expect(licenceState(null, NOW)).toBeNull();
  });
});

describe('currentLicence', () => {
  it('prefers a checked in-date licence over a newer pending or an expired one', () => {
    const picked = currentLicence(
      [
        { license_number: 'expired', status: 'valid', expiry_date: '2026-01-01' },
        { license_number: 'pending', status: 'pending', expiry_date: '2030-01-01' },
        { license_number: 'good', status: 'valid', expiry_date: '2028-01-01' },
      ],
      NOW,
    );
    expect(picked?.license_number).toBe('good');
  });

  it('among expired licences, shows the latest', () => {
    const picked = currentLicence(
      [
        { license_number: 'older', status: 'expired', expiry_date: '2025-01-01' },
        { license_number: 'newer', status: 'expired', expiry_date: '2026-06-01' },
      ],
      NOW,
    );
    expect(picked?.license_number).toBe('newer');
  });

  it('is null with no licences', () => {
    expect(currentLicence([], NOW)).toBeNull();
    expect(currentLicence(undefined, NOW)).toBeNull();
  });
});

it('only a checked, in-date licence counts as verified', () => {
  expect(isLicenceVerified({ status: 'valid', expiry_date: '2028-01-01' }, NOW)).toBe(true);
  expect(isLicenceVerified({ status: 'pending', expiry_date: '2028-01-01' }, NOW)).toBe(false);
  expect(isLicenceVerified({ status: 'valid', expiry_date: '2026-01-01' }, NOW)).toBe(false);
  expect(isLicenceVerified(null, NOW)).toBe(false);
});
