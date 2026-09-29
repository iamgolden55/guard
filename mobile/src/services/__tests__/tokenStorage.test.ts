/**
 * Tokens saved before AFTER_FIRST_UNLOCK stay unreadable while the phone is
 * locked until they are re-added — an update keeps the old accessibility.
 */
import * as SecureStore from 'expo-secure-store';
import { migrateTokenAccessibility, TOKEN_STORE_OPTIONS } from '../tokenStorage';

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (SecureStore.getItemAsync as jest.Mock).mockImplementation((k) => Promise.resolve(store[k] ?? null));
  (SecureStore.setItemAsync as jest.Mock).mockReset().mockImplementation((k, v) => { store[k] = v; return Promise.resolve(); });
  (SecureStore.deleteItemAsync as jest.Mock).mockReset().mockImplementation((k) => { delete store[k]; return Promise.resolve(); });
});

it('re-adds existing tokens readable after first unlock', async () => {
  Object.assign(store, { accessToken: 'a', refreshToken: 'r' });
  await migrateTokenAccessibility();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'a', TOKEN_STORE_OPTIONS);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'r', TOKEN_STORE_OPTIONS);
  expect(store).toMatchObject({ accessToken: 'a', refreshToken: 'r' });
});

it('runs once', async () => {
  Object.assign(store, { accessToken: 'a', refreshToken: 'r' });
  await migrateTokenAccessibility();
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();
  await migrateTokenAccessibility();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
