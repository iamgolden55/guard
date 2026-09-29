/**
 * Staff were being signed out by things that don't end a session: a phone
 * locked in a pocket (keychain "User interaction is not allowed", Sentry
 * REACT-NATIVE-P), a timeout, or a slow Render response. These pin that only
 * the server rejecting the refresh token signs the user out.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import authService, { SessionUnavailableError } from '../authService';

jest.mock('../../config/api.config', () => ({
  API_ENDPOINTS: {
    AUTH: { LOGIN: '/api/v1/login/', REFRESH_TOKEN: '/api/v1/token/refresh/', PROFILE: '/api/v1/profiles/me' },
  },
  getAuthHeaders: () => ({}),
}));
jest.mock('../notificationService', () => ({
  __esModule: true,
  default: { unregisterPushToken: jest.fn(() => Promise.resolve()) },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), dismissAuthSession: jest.fn() }));
jest.mock('../tokenStorage', () => ({
  setToken: jest.fn(() => Promise.resolve()),
  migrateTokenAccessibility: jest.fn(() => Promise.resolve()),
}));

const post = jest.spyOn(axios, 'post');
const get = jest.spyOn(axios, 'get');
const getItem = SecureStore.getItemAsync as jest.Mock;
const deleteItem = SecureStore.deleteItemAsync as jest.Mock;

const jwt = (exp: number) =>
  `h.${Buffer.from(JSON.stringify({ user_id: 1, exp })).toString('base64')}.s`;
const VALID = jwt(Date.now() / 1000 + 3600);
const EXPIRED = jwt(Date.now() / 1000 - 60);

const keychain = (tokens: Record<string, string | null>) =>
  getItem.mockImplementation((key: string) => Promise.resolve(tokens[key] ?? null));
const lockedKeychain = () =>
  getItem.mockRejectedValue(new Error("Calling the 'getValueWithKeyAsync' function has failed"));
const signedOut = () => deleteItem.mock.calls.some(([key]) => key === 'refreshToken');

beforeEach(() => {
  jest.useRealTimers();
  post.mockReset();
  get.mockReset();
  getItem.mockReset();
  deleteItem.mockReset();
});

describe('refreshAccessToken', () => {
  it('returns the new token and keeps the session', async () => {
    keychain({ refreshToken: 'r' });
    post.mockResolvedValueOnce({ data: { access: 'new', refresh: 'r2' } });
    await expect(authService.refreshAccessToken()).resolves.toBe('new');
    expect(signedOut()).toBe(false);
  });

  it.each([400, 401])('signs out when the server rejects the refresh token (%s)', async (status) => {
    keychain({ refreshToken: 'r' });
    post.mockRejectedValueOnce({ response: { status } });
    await expect(authService.refreshAccessToken()).resolves.toBeNull();
    expect(signedOut()).toBe(true);
  });

  it.each([
    ['a timeout', { code: 'ECONNABORTED', message: 'timeout' }],
    ['no connection', { message: 'Network Error' }],
    ['a server error', { response: { status: 502 } }],
  ])('keeps the session on %s', async (_label, error) => {
    keychain({ refreshToken: 'r' });
    post.mockRejectedValueOnce(error);
    await expect(authService.refreshAccessToken()).rejects.toBeInstanceOf(SessionUnavailableError);
    expect(signedOut()).toBe(false);
  });

  it('keeps the session when the keychain is locked', async () => {
    lockedKeychain();
    await expect(authService.refreshAccessToken()).rejects.toBeInstanceOf(SessionUnavailableError);
    expect(post).not.toHaveBeenCalled();
    expect(signedOut()).toBe(false);
  });
});

describe('restoreSession at launch', () => {
  it('signs in with a valid token', async () => {
    keychain({ accessToken: VALID, refreshToken: 'r' });
    get.mockResolvedValueOnce({ data: { id: 7 } });
    await expect(authService.restoreSession()).resolves.toMatchObject({ status: 'signed-in', user: { id: 7 } });
  });

  it('is signed out with no tokens', async () => {
    keychain({});
    await expect(authService.restoreSession()).resolves.toEqual({ status: 'signed-out' });
  });

  it('is unavailable, not signed out, when the keychain is locked', async () => {
    lockedKeychain();
    await expect(authService.restoreSession()).resolves.toMatchObject({ status: 'unavailable' });
    expect(signedOut()).toBe(false);
  });

  it('is unavailable, not signed out, when the refresh times out', async () => {
    keychain({ accessToken: EXPIRED, refreshToken: 'r' });
    post.mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout' });
    await expect(authService.restoreSession()).resolves.toMatchObject({ status: 'unavailable' });
    expect(signedOut()).toBe(false);
  });

  it('is signed out when the refresh token is rejected', async () => {
    keychain({ accessToken: EXPIRED, refreshToken: 'r' });
    post.mockRejectedValueOnce({ response: { status: 401 } });
    await expect(authService.restoreSession()).resolves.toEqual({ status: 'signed-out' });
  });

  it('retries a slow profile and then signs in', async () => {
    jest.useFakeTimers();
    keychain({ accessToken: VALID, refreshToken: 'r' });
    get
      .mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout' })
      .mockResolvedValueOnce({ data: { id: 7 } });
    const result = authService.restoreSession();
    await jest.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ status: 'signed-in' });
  });

  it('is unavailable after the profile keeps failing', async () => {
    jest.useFakeTimers();
    keychain({ accessToken: VALID, refreshToken: 'r' });
    get.mockRejectedValue({ response: { status: 503 } });
    const result = authService.restoreSession();
    await jest.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ status: 'unavailable' });
    expect(get).toHaveBeenCalledTimes(3);
    expect(signedOut()).toBe(false);
  });

  it('is signed out when the profile is refused after a refresh', async () => {
    keychain({ accessToken: VALID, refreshToken: 'r' });
    get.mockRejectedValueOnce({ response: { status: 401 } });
    await expect(authService.restoreSession()).resolves.toEqual({ status: 'signed-out' });
    expect(signedOut()).toBe(true);
  });
});
