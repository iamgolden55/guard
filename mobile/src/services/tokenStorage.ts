import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';

/**
 * Where the auth tokens live, and the one way to read and write them.
 *
 * Tokens are readable once the phone has been unlocked after a restart.
 * The default (WHEN_UNLOCKED) made every keychain read throw "User
 * interaction is not allowed" while the phone was locked, so a request from a
 * backgrounded app failed, the refresh path read that as a dead session, and
 * the user was signed out (Sentry REACT-NATIVE-P).
 */
export const TOKEN_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const TOKEN_KEYS = ['accessToken', 'refreshToken'] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];

/** Where a token is parked while the accessibility migration re-adds it. */
const backupKey = (key: TokenKey) => `${key}.migrationBackup`;

/**
 * Tokens the server issued that could not be written to the keychain yet.
 *
 * The backend rotates refresh tokens and blacklists the old one, so once a
 * refresh succeeds the only valid refresh token is the new one. If writing it
 * fails, dropping it (or failing the refresh) signs the user out on the next
 * refresh just the same. It is kept here instead, served to every reader, and
 * written again on each read until the keychain accepts it.
 */
const unsaved: Partial<Record<TokenKey, string>> = {};

export const setToken = (key: TokenKey, value: string) =>
  SecureStore.setItemAsync(key, value, TOKEN_STORE_OPTIONS);

/**
 * Every read, save, clear and migration runs one at a time.
 *
 * Without this, a write still in flight when the user logged out finished
 * after the logout's delete and put the refresh token back, so the next
 * launch signed them straight in again; and each concurrent reader started
 * its own write of the same waiting token. Functions below that are only
 * called from inside the queue must not queue again (it would wait on itself).
 */
let queue: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function flushUnsaved(): Promise<void> {
  // Refresh token first: a stored refresh token that works is what keeps the
  // session; a stale stored access token only costs one more refresh.
  for (const key of ['refreshToken', 'accessToken'] as const) {
    const value = unsaved[key];
    if (value === undefined) continue;
    await setToken(key, value);
    if (unsaved[key] === value) delete unsaved[key];
  }
}

/**
 * The current token: one still waiting to be saved, else the keychain's, else
 * a migration backup left by an interrupted launch. Throws when the keychain
 * can't be read (the caller decides what that means).
 */
export function readToken(key: TokenKey): Promise<string | null> {
  return oneAtATime(async () => {
    if (unsaved.accessToken !== undefined || unsaved.refreshToken !== undefined) {
      try {
        await flushUnsaved();
      } catch {
        // Still not writable; keep serving the in-memory copy.
      }
    }
    const pending = unsaved[key];
    if (pending !== undefined) return pending;
    const stored = await SecureStore.getItemAsync(key);
    if (stored) return stored;
    return await SecureStore.getItemAsync(backupKey(key));
  });
}

/**
 * Save a token pair from a login or a refresh (a refresh may omit `refresh`).
 * Refresh token first, so a failure part-way never leaves the keychain holding
 * a blacklisted refresh token beside a new access token. Replaces anything
 * still waiting to be saved. Returns false when the keychain refused; the
 * tokens are then kept in memory (see `unsaved`) and every reader gets them.
 */
export function saveTokens(access: string, refresh?: string): Promise<boolean> {
  return oneAtATime(async () => {
    delete unsaved.refreshToken;
    if (refresh !== undefined) unsaved.refreshToken = refresh;
    unsaved.accessToken = access;
    try {
      await flushUnsaved();
      return true;
    } catch (error) {
      logger.warn('[tokenStorage] Could not save refreshed tokens; keeping them in memory', error);
      return false;
    }
  });
}

/** Forget the tokens everywhere: memory, keychain and any migration backup. */
export function clearTokens(): Promise<void> {
  return oneAtATime(async () => {
    for (const key of TOKEN_KEYS) {
      delete unsaved[key];
      await SecureStore.deleteItemAsync(key);
      await SecureStore.deleteItemAsync(backupKey(key));
    }
  });
}

/**
 * Re-save tokens written before TOKEN_STORE_OPTIONS existed. iOS only applies
 * accessibility when an item is added: an update keeps the old class, so the
 * item has to be deleted and written again. Run while the app is in the
 * foreground (launch), when the keychain is readable.
 *
 * Deleting before re-adding is the risky moment: a failed write, or the app
 * being killed in between, would lose the token and sign the user out. So each
 * token is first copied to a separate backup item (new, so it gets
 * AFTER_FIRST_UNLOCK), and the backup is removed only once the re-added token
 * reads back. A failed backup leaves the original untouched; an interrupted
 * run is finished from the backup on the next launch, and `readToken` falls
 * back to it meanwhile.
 */
const MIGRATION_FLAG = 'tokenAccessibilityMigrated';

export function migrateTokenAccessibility(): Promise<void> {
  return oneAtATime(migrate);
}

async function migrate(): Promise<void> {
  if (await SecureStore.getItemAsync(MIGRATION_FLAG)) return;
  for (const key of TOKEN_KEYS) {
    const backup = await SecureStore.getItemAsync(backupKey(key));
    const value = (await SecureStore.getItemAsync(key)) ?? backup;
    if (!value) continue;
    if (backup !== value) {
      await SecureStore.setItemAsync(backupKey(key), value, TOKEN_STORE_OPTIONS);
    }
    await SecureStore.deleteItemAsync(key);
    await setToken(key, value);
    if ((await SecureStore.getItemAsync(key)) !== value) {
      throw new Error(`Re-saved ${key} did not read back; backup kept`);
    }
    await SecureStore.deleteItemAsync(backupKey(key));
  }
  await SecureStore.setItemAsync(MIGRATION_FLAG, '1', TOKEN_STORE_OPTIONS);
}
