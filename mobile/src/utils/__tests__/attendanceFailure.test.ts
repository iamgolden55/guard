// api.ts imports expo-constants (published as untransformed ESM) and the auth
// service; neither is under test here.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'http://test.invalid' } } },
}));
jest.mock('../../services/authService', () => ({ __esModule: true, default: {} }));

import { ApiError, ApiTimeoutError, NetworkError } from '../../services/api';
import { classifyAttendanceFailure } from '../attendanceFailure';

// AUDIT-2026-09-17 P0-B: every failed check-in used to be reported to the
// officer as "saved locally", including refusals, and none was queued.

describe('classifyAttendanceFailure', () => {
  it('queues a timeout', () => {
    expect(classifyAttendanceFailure(new ApiTimeoutError('slow'), 'check_in')).toEqual({
      kind: 'queue',
      reason: 'timeout',
    });
  });

  it('queues a request that never reached the server', () => {
    expect(classifyAttendanceFailure(new NetworkError('offline'), 'check_in')).toEqual({
      kind: 'queue',
      reason: 'offline',
    });
  });

  it('queues a 5xx — the API restarting is not a refusal', () => {
    const error = new ApiError(502, 'Bad Gateway', '/api/v1/shifts/1/check_in/');
    expect(classifyAttendanceFailure(error, 'check_in')).toEqual({
      kind: 'queue',
      reason: 'server_unavailable',
    });
  });

  it('reports a 4xx as a refusal with the server reason, and does not queue it', () => {
    const error = new ApiError(400, 'Bad Request', '/api/v1/shifts/1/check_in/', {
      detail: 'Location verification failed',
    });
    expect(classifyAttendanceFailure(error, 'check_in')).toEqual({
      kind: 'refused',
      message: 'Location verification failed',
    });
  });

  it('treats the already_checked_in code as done', () => {
    const error = new ApiError(400, 'Bad Request', '/x', {
      detail: 'Shift already checked in',
      code: 'already_checked_in',
    });
    expect(classifyAttendanceFailure(error, 'check_in')).toEqual({ kind: 'already_done' });
  });

  it('falls back to the prose for an older backend without the code', () => {
    const error = new ApiError(400, 'Bad Request', '/x', { detail: 'Shift already checked in' });
    expect(classifyAttendanceFailure(error, 'check_in')).toEqual({ kind: 'already_done' });
  });

  it('does not mistake a check-out code for a completed check-in', () => {
    const error = new ApiError(400, 'Bad Request', '/x', {
      detail: 'Not checked in',
      code: 'already_checked_out',
    });
    expect(classifyAttendanceFailure(error, 'check_in').kind).toBe('refused');
  });

  it('queues anything unexpected rather than dropping it', () => {
    expect(classifyAttendanceFailure(new Error('boom'), 'check_in')).toEqual({
      kind: 'queue',
      reason: 'unknown',
    });
  });
});
