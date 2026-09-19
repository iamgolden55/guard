/**
 * What to do when an attendance request (check-in / check-out) fails.
 *
 * The check-in screen used to tell the officer "saved locally, will sync" on
 * every failure — including a server that had definitively refused the
 * check-in — while queueing nothing. The shift then showed as active on the
 * phone, the server's no-show job flagged it 30 minutes later, and the officer
 * was paid nothing for a shift they worked (AUDIT-2026-09-17 P0-B).
 *
 * The rule, one place for both screens and the tests:
 * - the server answered with a 4xx → it refused. Say why; queue nothing,
 *   because replaying a refusal only produces the same refusal;
 * - the server answered "already done" → nothing to do;
 * - anything else (timeout, no network, a 5xx while the API restarts, an
 *   unexpected throw) → queue it so it replays when the device is back online.
 */
import { ApiError, ApiTimeoutError, NetworkError } from '../services/api';

export type AttendanceAction = 'check_in' | 'check_out';

export type AttendanceFailure =
  | { kind: 'already_done' }
  | { kind: 'refused'; message: string }
  | { kind: 'queue'; reason: 'timeout' | 'offline' | 'server_unavailable' | 'unknown' };

const ALREADY_DONE: Record<AttendanceAction, { code: string; prose: string }> = {
  check_in: { code: 'already_checked_in', prose: 'already checked in' },
  check_out: { code: 'already_checked_out', prose: 'already checked out' },
};

export function serverMessage(error: ApiError): string {
  return (
    error.response?.detail ||
    error.response?.error ||
    error.statusText ||
    'Unknown error'
  );
}

export function classifyAttendanceFailure(
  error: unknown,
  action: AttendanceAction,
): AttendanceFailure {
  if (error instanceof ApiTimeoutError) {
    return { kind: 'queue', reason: 'timeout' };
  }
  if (error instanceof NetworkError) {
    return { kind: 'queue', reason: 'offline' };
  }
  if (error instanceof ApiError) {
    const message = serverMessage(error);
    const done = ALREADY_DONE[action];
    // Match the server's machine-readable code; the prose check is a fallback
    // for an older backend.
    if (error.response?.code === done.code || message.toLowerCase().includes(done.prose)) {
      return { kind: 'already_done' };
    }
    if (error.statusCode >= 500) {
      return { kind: 'queue', reason: 'server_unavailable' };
    }
    return { kind: 'refused', message };
  }
  return { kind: 'queue', reason: 'unknown' };
}
