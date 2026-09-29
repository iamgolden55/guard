// api.ts imports expo-constants (published as untransformed ESM) and the auth
// service; neither is under test here.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'http://test.invalid' } } },
}));
jest.mock('../../services/authService', () => ({ __esModule: true, default: {} }));
jest.mock('../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { ApiError, ApiTimeoutError, NetworkError } from '../../services/api';
import { logger } from '../logger';
import {
  describeShiftSaveError,
  humaniseShiftMessage,
  reportShiftSaveError,
} from '../shiftSaveError';

// REACT-NATIVE-Q / -N: a double-booking the server correctly refused was shown
// to the manager as "HTTP 400: non_field_errors: …" and sent to Sentry twice.

const OVERLAP =
  'This staff member already has a shift during this time: 2026-09-25 17:00 - 00:00 at Small Bar';

const refused = (body: unknown, status = 400) =>
  new ApiError(status, 'Bad Request', '/api/v1/shifts/', body);

beforeEach(() => jest.clearAllMocks());

describe('humaniseShiftMessage', () => {
  it('turns the overlap refusal into one plain line', () => {
    expect(humaniseShiftMessage(OVERLAP)).toBe(
      'Already on shift 17:00–00:00 at Small Bar on Fri 25 Sep.',
    );
  });

  it('keeps a venue name with spaces and punctuation', () => {
    expect(
      humaniseShiftMessage(
        'This staff member already has a shift during this time: 2027-07-15 18:00 - 01:00 at The Old Vic, Bristol',
      ),
    ).toBe('Already on shift 18:00–01:00 at The Old Vic, Bristol on Thu 15 Jul.');
  });

  it('leaves any other message as the server wrote it', () => {
    expect(humaniseShiftMessage('End time must be after start time.')).toBe(
      'End time must be after start time.',
    );
  });
});

describe('describeShiftSaveError', () => {
  it('shows the overlap from non_field_errors, and does not report it', () => {
    expect(describeShiftSaveError(refused({ non_field_errors: [OVERLAP] }))).toEqual({
      message: 'Already on shift 17:00–00:00 at Small Bar on Fri 25 Sep.',
      report: false,
    });
  });

  it('shows the overlap when the server keys it by field', () => {
    expect(describeShiftSaveError(refused({ staff_user: [OVERLAP] })).message).toBe(
      'Already on shift 17:00–00:00 at Small Bar on Fri 25 Sep.',
    );
  });

  it('shows other validation errors without field names or the status code', () => {
    const failure = describeShiftSaveError(
      refused({ end_time: ['End time must be after start time.'], venue: ['This field is required.'] }),
    );
    expect(failure).toEqual({
      message: 'End time must be after start time.\nThis field is required.',
      report: false,
    });
    expect(failure.message).not.toMatch(/HTTP|end_time|non_field_errors/);
  });

  it('shows the reason and skips the structured details of an unavailable officer', () => {
    const failure = describeShiftSaveError(
      refused({
        staff_unavailable: 'Sam is on leave on 25 Sep.',
        details: { staff_name: 'Sam', shift_date: '2026-09-25' },
      }),
    );
    expect(failure.message).toBe('Sam is on leave on 25 Sep.');
  });

  it('prefers detail when the server sends one, e.g. a 403', () => {
    expect(
      describeShiftSaveError(refused({ detail: 'You do not have permission to perform this action.' }, 403)),
    ).toEqual({ message: 'You do not have permission to perform this action.', report: false });
  });

  it('falls back to a plain sentence when a 400 has no body', () => {
    expect(describeShiftSaveError(refused(undefined))).toEqual({
      message: 'The shift could not be saved. Check the details and try again.',
      report: false,
    });
  });

  it('reports a 5xx, with a generic message', () => {
    expect(describeShiftSaveError(refused({ detail: 'Internal error' }, 500))).toEqual({
      message: 'The server had a problem saving the shift. Please try again in a moment.',
      report: true,
    });
  });

  it('reports 401 and 429: they are not the server judging the shift', () => {
    expect(describeShiftSaveError(refused({ detail: 'x' }, 401)).report).toBe(true);
    expect(describeShiftSaveError(refused({ detail: 'x' }, 429)).report).toBe(true);
  });

  it('reports a timeout, a lost connection and anything unexpected', () => {
    expect(describeShiftSaveError(new ApiTimeoutError('slow')).report).toBe(true);
    expect(describeShiftSaveError(new NetworkError('offline'))).toEqual({
      message: 'No connection. Check your signal and try again.',
      report: true,
    });
    expect(describeShiftSaveError(new TypeError('boom')).report).toBe(true);
  });
});

describe('reportShiftSaveError', () => {
  it('leaves only a breadcrumb for a refusal, never a Sentry error', () => {
    const shown = reportShiftSaveError('[ShiftsService] Error creating shift:', refused({ non_field_errors: [OVERLAP] }));
    expect(shown).toBe('Already on shift 17:00–00:00 at Small Bar on Fri 25 Sep.');
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('sends a real failure to Sentry with the original error', () => {
    const error = refused({ detail: 'Internal error' }, 502);
    reportShiftSaveError('[ShiftsService] Error creating shift:', error);
    expect(logger.error).toHaveBeenCalledWith('[ShiftsService] Error creating shift:', error);
  });

  it('sends a network failure to Sentry', () => {
    const error = new NetworkError('offline');
    reportShiftSaveError('[ShiftsService] Error updating shift:', error);
    expect(logger.error).toHaveBeenCalledWith('[ShiftsService] Error updating shift:', error);
  });
});
