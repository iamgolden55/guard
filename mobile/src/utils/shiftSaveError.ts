/**
 * What a manager is told when creating or editing a shift fails, and whether
 * Sentry hears about it.
 *
 * A double-booking came back as HTTP 400 `non_field_errors: "This staff member
 * already has a shift during this time: 2026-09-25 17:00 - 00:00 at Small Bar"`.
 * The manager saw "HTTP 400: non_field_errors: …", and the one tap was reported
 * to Sentry twice as an app error (REACT-NATIVE-Q from the service, -N from the
 * list screen re-logging the slice error). The server was right; nothing broke.
 *
 * The rule, one place for the service, the slice and the tests:
 * - the server refused (a 4xx that isn't about the session or rate limits) →
 *   show its reason in plain words; a breadcrumb, not a Sentry event;
 * - anything else (5xx, timeout, no connection, an unexpected throw) → a
 *   generic message and a Sentry error, because that is a real failure.
 */
import { ApiError, ApiTimeoutError, NetworkError } from '../services/api';
import { logger } from './logger';

export interface ShiftSaveFailure {
  message: string;
  /** True when this is a real failure worth a Sentry event. */
  report: boolean;
}

// 401 means the session broke and 408/429 mean "try again": none is the server
// judging the shift, so they are reported like any other failure.
const NOT_A_REFUSAL = new Set([401, 408, 429]);

// Fields whose value is structured context, not something to show.
const IGNORED_FIELDS = new Set(['details', 'unavailable_count', 'code']);

const OVERLAP =
  /already has a shift during this time:\s*(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}) - (\d{2}:\d{2}) at (.+?)\.?$/i;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Already on shift 18:00–01:00 at Small Bar on Thu 25 Sep." for the overlap refusal. */
export function humaniseShiftMessage(text: string): string {
  const match = OVERLAP.exec(text.trim());
  if (!match) return text.trim();
  const [, year, month, day, start, end, venue] = match;
  // The date is a calendar date from the server; build it in UTC so the
  // phone's own timezone can't move it to the neighbouring day.
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const when = `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return `Already on shift ${start}–${end} at ${venue.trim()} on ${when}.`;
}

function messagesIn(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(messagesIn);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !IGNORED_FIELDS.has(key))
      .flatMap(([, v]) => messagesIn(v));
  }
  return [];
}

/** The server's reasons, in order, from any DRF error body. */
export function serverReasons(body: unknown): string[] {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const { detail, error, message } = body as Record<string, unknown>;
    const lead = [detail, error, message].find((v) => typeof v === 'string' && v.trim());
    if (lead) return [lead as string];
  }
  return messagesIn(body);
}

export function describeShiftSaveError(error: unknown): ShiftSaveFailure {
  if (error instanceof ApiTimeoutError) {
    return {
      message:
        'The server took too long to answer. Check the shift list before trying again, in case it was saved.',
      report: true,
    };
  }
  if (error instanceof NetworkError) {
    return { message: 'No connection. Check your signal and try again.', report: true };
  }
  if (error instanceof ApiError) {
    const status = error.statusCode;
    if (status >= 400 && status < 500 && !NOT_A_REFUSAL.has(status)) {
      const reasons = Array.from(new Set(serverReasons(error.response).map(humaniseShiftMessage)));
      return {
        message: reasons.length ? reasons.join('\n') : 'The shift could not be saved. Check the details and try again.',
        report: false,
      };
    }
    return {
      message: 'The server had a problem saving the shift. Please try again in a moment.',
      report: true,
    };
  }
  return { message: 'Something went wrong saving the shift. Please try again.', report: true };
}

/**
 * Log a failed shift save: a Sentry error for a real failure, only a
 * breadcrumb for a refusal. Returns the message to show.
 */
export function reportShiftSaveError(context: string, error: unknown): string {
  const failure = describeShiftSaveError(error);
  if (failure.report) {
    logger.error(context, error);
  } else {
    logger.warn(`${context} refused: ${failure.message}`);
  }
  return failure.message;
}
