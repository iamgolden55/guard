import * as SecureStore from 'expo-secure-store';

/**
 * Auth tokens are readable once the phone has been unlocked after a restart.
 *
 * The default (WHEN_UNLOCKED) made every keychain read throw "User
 * interaction is not allowed" while the phone was locked, so a request from a
 * backgrounded app failed, the refresh path read that as a dead session, and
 * the user was signed out (Sentry REACT-NATIVE-P).
 */
export const TOKEN_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const TOKEN_KEYS = ['accessToken', 'refreshToken'] as const;
type TokenKey = (typeof TOKEN_KEYS)[number];

export const setToken = (key: TokenKey, value: string) =>
  SecureStore.setItemAsync(key, value, TOKEN_STORE_OPTIONS);

/**
 * Re-save tokens written before TOKEN_STORE_OPTIONS existed. iOS only applies
 * accessibility when an item is added: an update keeps the old class, so the
 * item has to be deleted and written again. Run while the app is in the
 * foreground (launch), when the keychain is readable.
 */
const MIGRATION_FLAG = 'tokenAccessibilityMigrated';

export async function migrateTokenAccessibility(): Promise<void> {
  if (await SecureStore.getItemAsync(MIGRATION_FLAG)) return;
  for (const key of TOKEN_KEYS) {
    const value = await SecureStore.getItemAsync(key);
    if (value) {
      await SecureStore.deleteItemAsync(key);
      await setToken(key, value);
    }
  }
  await SecureStore.setItemAsync(MIGRATION_FLAG, '1', TOKEN_STORE_OPTIONS);
}
