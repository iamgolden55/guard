/**
 * Tokens saved before AFTER_FIRST_UNLOCK stay unreadable while the phone is
 * locked until they are re-added — an update keeps the old accessibility.
 */
import * as SecureStore from 'expo-secure-store';
import {
  clearTokens,
  migrateTokenAccessibility,
  readToken,
  saveTokens,
  TOKEN_STORE_OPTIONS,
} from '../tokenStorage';

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const store: Record<string, string> = {};
const setItem = SecureStore.setItemAsync as jest.Mock;
const locked = () => Promise.reject(new Error("Calling the 'setValueWithKeyAsync' function has failed"));

beforeEach(async () => {
  for (const k of Object.keys(store)) delete store[k];
  (SecureStore.getItemAsync as jest.Mock).mockImplementation((k) => Promise.resolve(store[k] ?? null));
  (SecureStore.setItemAsync as jest.Mock).mockReset().mockImplementation((k, v) => { store[k] = v; return Promise.resolve(); });
  (SecureStore.deleteItemAsync as jest.Mock).mockReset().mockImplementation((k) => { delete store[k]; return Promise.resolve(); });
  await clearTokens(); // module state: nothing left waiting from a previous test
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();
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

// CodeRabbit on #16: the migration deleted each token before re-adding it, so a
// failed write, or the app being killed in between, lost the token and signed
// the user out — the very thing #16 set out to stop.
describe('migration never loses a token', () => {
  it('keeps the token when re-adding it fails, and finishes on the next launch', async () => {
    Object.assign(store, { accessToken: 'a', refreshToken: 'r' });
    setItem.mockImplementation((k, v) => {
      if (k === 'refreshToken') return locked();
      store[k] = v;
      return Promise.resolve();
    });
    await expect(migrateTokenAccessibility()).rejects.toThrow();
    // The original is gone, but every reader still gets the token.
    expect(store.refreshToken).toBeUndefined();
    await expect(readToken('refreshToken')).resolves.toBe('r');
    expect(store.tokenAccessibilityMigrated).toBeUndefined();

    setItem.mockImplementation((k, v) => { store[k] = v; return Promise.resolve(); });
    await migrateTokenAccessibility();
    expect(store).toEqual({ accessToken: 'a', refreshToken: 'r', tokenAccessibilityMigrated: '1' });
  });

  it('touches nothing when the backup cannot be written', async () => {
    Object.assign(store, { accessToken: 'a', refreshToken: 'r' });
    setItem.mockImplementation(() => locked());
    await expect(migrateTokenAccessibility()).rejects.toThrow();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(store).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('restores a token the app was killed in the middle of re-adding', async () => {
    // Backup written, original deleted, then the process died.
    Object.assign(store, { accessToken: 'a', 'refreshToken.migrationBackup': 'r' });
    await expect(readToken('refreshToken')).resolves.toBe('r');
    await migrateTokenAccessibility();
    expect(store).toEqual({ accessToken: 'a', refreshToken: 'r', tokenAccessibilityMigrated: '1' });
  });

  it('prefers the live token over a stale backup', async () => {
    Object.assign(store, { refreshToken: 'new', 'refreshToken.migrationBackup': 'old' });
    await migrateTokenAccessibility();
    expect(store.refreshToken).toBe('new');
    expect(store['refreshToken.migrationBackup']).toBeUndefined();
  });
});

// CodeRabbit on #16: a refresh whose tokens could not be saved still reported
// success, and readers kept loading the old tokens from the keychain. The
// server has already blacklisted the old refresh token by then.
describe('saveTokens', () => {
  it('writes the refresh token before the access token', async () => {
    await expect(saveTokens('a2', 'r2')).resolves.toBe(true);
    expect(setItem.mock.calls.map(([k]) => k)).toEqual(['refreshToken', 'accessToken']);
    expect(store).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('keeps unsaved tokens in memory for every reader, then saves them once it can', async () => {
    Object.assign(store, { accessToken: 'a1', refreshToken: 'r1' });
    setItem.mockImplementation(() => locked());
    await expect(saveTokens('a2', 'r2')).resolves.toBe(false);
    expect(store).toMatchObject({ accessToken: 'a1', refreshToken: 'r1' });
    await expect(readToken('accessToken')).resolves.toBe('a2');
    await expect(readToken('refreshToken')).resolves.toBe('r2');

    setItem.mockImplementation((k, v) => { store[k] = v; return Promise.resolve(); });
    await expect(readToken('accessToken')).resolves.toBe('a2');
    expect(store).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('never leaves a new access token beside the old refresh token', async () => {
    Object.assign(store, { accessToken: 'a1', refreshToken: 'r1' });
    setItem.mockImplementation((k, v) => {
      if (k === 'refreshToken') return locked();
      store[k] = v;
      return Promise.resolve();
    });
    await saveTokens('a2', 'r2');
    // The refresh write failed first, so the access write was never tried.
    expect(store).toMatchObject({ accessToken: 'a1', refreshToken: 'r1' });
    await expect(readToken('refreshToken')).resolves.toBe('r2');
  });

  it('a new login replaces tokens still waiting to be saved', async () => {
    setItem.mockImplementation(() => locked());
    await saveTokens('stale-a', 'stale-r');
    setItem.mockImplementation((k, v) => { store[k] = v; return Promise.resolve(); });
    await saveTokens('login-a', 'login-r');
    await expect(readToken('refreshToken')).resolves.toBe('login-r');
    expect(store).toMatchObject({ accessToken: 'login-a', refreshToken: 'login-r' });
  });

  it('clearTokens forgets memory, keychain and backups', async () => {
    Object.assign(store, { accessToken: 'a', 'refreshToken.migrationBackup': 'r' });
    setItem.mockImplementation(() => locked());
    await saveTokens('a2', 'r2');
    await clearTokens();
    await expect(readToken('accessToken')).resolves.toBeNull();
    await expect(readToken('refreshToken')).resolves.toBeNull();
  });
});
