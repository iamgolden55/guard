/**
 * App warnings reach Sentry Logs, without the user's secrets.
 *
 * A warning used to be only a breadcrumb, which reaches Sentry only if an
 * error follows. The incident report the server refused with a 400 was logged
 * as a warning and left no trace anywhere. Warnings now go to Sentry Logs too;
 * these pin what is sent, and that tokens and personal fields are not.
 */
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  logger: { warn: jest.fn(), error: jest.fn() },
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

import { ApiError } from '../../services/api';
import { logAttributes, logger } from '../logger';

jest.mock('../../services/authService', () => ({ __esModule: true, default: {} }));
jest.mock('../../config/api.config', () => ({ API_BASE_URL: 'https://api.test' }));
jest.mock('../appVersion', () => ({
  appVersionHeaders: () => ({}),
  notifyUpdateRequired: jest.fn(),
  UPDATE_REQUIRED_STATUS: 426,
}));

const Sentry = jest.requireMock('@sentry/react-native');
const mockSentryLogger = Sentry.logger;
const mockInit = Sentry.init;

beforeEach(() => {
  mockSentryLogger.warn.mockReset();
  mockSentryLogger.error.mockReset();
});

it('turns on JS logs when Sentry starts', () => {
  logger.initSentry('https://key@sentry.test/1');
  expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ enableLogs: true, logsOrigin: 'js' }));
});

it('sends a warning to Sentry Logs with its details', () => {
  logger.warn('[SyncService] Action rejected by server', { type: 'create_incident', status: 400 });

  expect(mockSentryLogger.warn).toHaveBeenCalledWith('[SyncService] Action rejected by server', {
    type: 'create_incident',
    status: 400,
  });
});

it("keeps the server's reason from an ApiError", () => {
  const error = new ApiError(400, 'Bad Request', '/api/v1/incidents/', {
    actions_taken: ['This field may not be blank.'],
  });
  logger.warn('[SyncService] Action rejected by server', { error });

  const [, attributes] = mockSentryLogger.warn.mock.calls[0];
  const sent = JSON.parse(attributes.error);
  expect(sent).toMatchObject({
    name: 'ApiError',
    status: 400,
    response: { actions_taken: ['This field may not be blank.'] },
  });
});

it('never sends the bearer token from an axios error', () => {
  const axiosError = Object.assign(new Error('Request failed with status code 401'), {
    code: 'ERR_BAD_REQUEST',
    config: { headers: { Authorization: 'Bearer secret-access-token' } },
    request: { _headers: { authorization: 'Bearer secret-access-token' } },
    response: {
      status: 401,
      data: { detail: 'Given token not valid for any token type' },
      headers: { 'set-cookie': 'refresh_token=secret-refresh' },
      config: { headers: { Authorization: 'Bearer secret-access-token' } },
    },
  });
  logger.warn('[ShiftsService] Error fetching shifts', axiosError);

  const sent = JSON.stringify(mockSentryLogger.warn.mock.calls[0][1]);
  expect(sent).not.toContain('secret');
  expect(mockSentryLogger.warn.mock.calls[0][1]).toMatchObject({
    status: 401,
    code: 'ERR_BAD_REQUEST',
    message: 'Request failed with status code 401',
  });
  expect(sent).toContain('Given token not valid');
});

it('drops tokens and personal fields at any depth', () => {
  const attributes = logAttributes([
    {
      userId: 7,
      refreshToken: 'r-secret',
      profile: { email: 'officer@test.test', phone_number: '07700', name: 'Officer' },
      tokens: { access: 'a-secret', refresh: 'r-secret' },
    },
  ]);

  const sent = JSON.stringify(attributes);
  expect(sent).not.toContain('secret');
  expect(sent).not.toContain('officer@test.test');
  expect(sent).not.toContain('07700');
  expect(attributes.userId).toBe(7);
  expect(JSON.parse(attributes.profile as string)).toEqual({ name: 'Officer' });
});

it('also sends errors to Sentry Logs, so the timeline is complete', () => {
  logger.error('[IncidentForm] Failed to submit incident', { error: new Error('offline') });
  expect(mockSentryLogger.error).toHaveBeenCalledWith(
    '[IncidentForm] Failed to submit incident',
    expect.objectContaining({ error: expect.stringContaining('offline') }),
  );
});
