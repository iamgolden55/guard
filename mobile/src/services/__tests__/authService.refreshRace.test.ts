/**
 * Several requests that hit an expired access token at once must share one
 * refresh.
 *
 * The server rotates refresh tokens and blacklists the old one. Each request
 * used to refresh on its own: the first refresh succeeded and saved a new
 * pair, the second sent the now-blacklisted token, was refused, and signed the
 * user out — deleting the pair the first had just saved. The app still looked
 * signed in, every request went out with no token ("Authentication
 * credentials were not provided"), and every screen said to sign in again
 * (Sentry REACT-NATIVE-Q/-S, build 18).
 *
 * These run against a fake server and keychain that behave like the real ones.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import authService from '../authService';
import apiService from '../api';

jest.mock('../../config/api.config', () => ({
  API_BASE_URL: 'https://api.test',
  API_ENDPOINTS: {
    AUTH: { LOGIN: '/api/v1/login/', REFRESH_TOKEN: '/api/v1/token/refresh/', PROFILE: '/api/v1/profiles/me' },
  },
  getAuthHeaders: () => ({}),
}));
jest.mock('../notificationService', () => ({
  __esModule: true,
  default: { unregisterPushToken: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../../utils/appVersion', () => ({
  appVersionHeaders: () => ({}),
  notifyUpdateRequired: jest.fn(),
  UPDATE_REQUIRED_STATUS: 426,
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), dismissAuthSession: jest.fn() }));

const post = jest.spyOn(axios, 'post');

/** The phone's keychain. */
let keychain: Record<string, string>;
/** The server: refresh tokens it still accepts, and the one live access token. */
let liveRefresh: Set<string>;
let liveAccess: string;
let issued: number;

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

beforeEach(() => {
  keychain = { accessToken: 'a0', refreshToken: 'r0', tokenAccessibilityMigrated: '1' };
  liveRefresh = new Set(['r0']);
  liveAccess = 'expired-by-now';
  issued = 0;

  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => keychain[key] ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
    keychain[key] = value;
  });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
    delete keychain[key];
  });

  // POST /token/refresh/: rotate, blacklisting the token that was sent.
  post.mockReset();
  post.mockImplementation(async (_url: string, body: any) => {
    await tick();
    if (!liveRefresh.has(body.refresh)) {
      throw { response: { status: 401, data: { detail: 'Token is blacklisted' } } };
    }
    liveRefresh.delete(body.refresh);
    issued += 1;
    liveAccess = `a${issued}`;
    liveRefresh.add(`r${issued}`);
    return { data: { access: liveAccess, refresh: `r${issued}` } };
  });

  // Any other endpoint: 200 with the live access token, else 401.
  global.fetch = jest.fn(async (_url: string, init: any) => {
    await tick();
    const auth = init?.headers?.Authorization;
    if (auth === `Bearer ${liveAccess}`) {
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    const detail = auth ? 'Given token not valid for any token type' : 'Authentication credentials were not provided.';
    return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ detail }) };
  }) as any;
});

describe('when the access token has expired', () => {
  it('three screens loading at once all get their data, and the session survives', async () => {
    const results = await Promise.all([
      apiService.get('/api/v1/shifts/my_shifts/'),
      apiService.get('/api/v1/shifts/available/'),
      apiService.get('/api/v1/users/team-members/'),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(keychain.accessToken).toBe('a1');
    expect(keychain.refreshToken).toBe('r1');
    // And the next request still works.
    await expect(apiService.get('/api/v1/shifts/my_shifts/')).resolves.toEqual({ ok: true });
  });

  it('concurrent refreshes share one request to the server', async () => {
    const tokens = await Promise.all([
      authService.refreshAccessToken(),
      authService.refreshAccessToken(),
    ]);
    expect(tokens).toEqual(['a1', 'a1']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(keychain.refreshToken).toBe('r1');
  });
});

describe('when a refresh is refused', () => {
  it('keeps the session if a newer refresh token was saved meanwhile', async () => {
    // Another path rotated the token while this refresh was on the wire.
    post.mockImplementationOnce(async () => {
      keychain.accessToken = 'a9';
      keychain.refreshToken = 'r9';
      throw { response: { status: 401, data: { detail: 'Token is blacklisted' } } };
    });
    const ended = jest.fn();
    const unsubscribe = authService.onSessionEnded(ended);

    await expect(authService.refreshAccessToken()).resolves.toBe('a9');

    unsubscribe();
    expect(keychain.refreshToken).toBe('r9');
    expect(ended).not.toHaveBeenCalled();
  });

  it('signs out and tells the app when the current refresh token is refused', async () => {
    liveRefresh.clear();
    const ended = jest.fn();
    const unsubscribe = authService.onSessionEnded(ended);

    await expect(authService.refreshAccessToken()).resolves.toBeNull();

    unsubscribe();
    expect(keychain.refreshToken).toBeUndefined();
    expect(keychain.accessToken).toBeUndefined();
    expect(ended).toHaveBeenCalledTimes(1);
  });
});
