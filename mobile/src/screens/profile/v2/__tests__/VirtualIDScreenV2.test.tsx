/**
 * The Virtual ID read `sia_license_number` / `sia_license_expiry`, which the
 * API has never sent: every officer's card showed no licence number, the
 * licence as "Expired", and a QR code claiming `verified: true`. It reads the
 * profile's `sia_licenses` list now.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

const mockState: { auth: { user: any } } = { auth: { user: null } };
const mockQrValues: string[] = [];

jest.mock('react-redux', () => ({
  useSelector: (select: (s: any) => any) => select(mockState),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-brightness', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.5)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = require('react-native');
  return ({ value }: { value: string }) => {
    mockQrValues.push(value);
    return <Text>qr</Text>;
  };
});

import VirtualIDScreen from '../VirtualIDScreenV2';

const iso = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

const officer = (sia_licenses: any[]) => ({
  id: 7,
  first_name: 'Sam',
  last_name: 'Officer',
  staff_profile: { profile_image_url: null, sia_licenses },
});

beforeEach(() => {
  mockQrValues.length = 0;
});

it('shows the in-date licence as active, with its number and a verified QR', () => {
  mockState.auth.user = officer([
    { license_number: '1111222233334444', expiry_date: iso(-10), status: 'expired' },
    { license_number: '5555666677778888', expiry_date: iso(200), status: 'valid' },
  ]);
  const screen = render(<VirtualIDScreen />);
  expect(screen.getAllByText('5555666677778888').length).toBeGreaterThan(0);
  expect(screen.getByText('Active')).toBeTruthy();
  expect(screen.queryByText('Expired')).toBeNull();
  const qr = JSON.parse(mockQrValues[mockQrValues.length - 1]);
  expect(qr).toMatchObject({ license: '5555666677778888', verified: true });
});

it('shows an expired licence as expired, and the QR does not claim it is verified', () => {
  mockState.auth.user = officer([
    { license_number: '1111222233334444', expiry_date: iso(-1), status: 'valid' },
  ]);
  const screen = render(<VirtualIDScreen />);
  expect(screen.getByText('Expired')).toBeTruthy();
  const qr = JSON.parse(mockQrValues[mockQrValues.length - 1]);
  expect(qr.verified).toBe(false);
});

it('does not present a licence still awaiting a check as verified', () => {
  mockState.auth.user = officer([
    { license_number: '9999000011112222', expiry_date: iso(300), status: 'pending' },
  ]);
  const screen = render(<VirtualIDScreen />);
  expect(screen.getByText('Awaiting check')).toBeTruthy();
  expect(JSON.parse(mockQrValues[mockQrValues.length - 1]).verified).toBe(false);
});

it('with no licence, claims nothing', () => {
  mockState.auth.user = officer([]);
  render(<VirtualIDScreen />);
  const qr = JSON.parse(mockQrValues[mockQrValues.length - 1]);
  expect(qr.verified).toBe(false);
  expect(qr.license).toBeUndefined();
});
