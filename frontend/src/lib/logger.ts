/**
 * Frontend logger.
 *
 * `src/` carried 250 raw `console.*` calls, 67 of them `console.log`. Two
 * problems with that: debug chatter ships to production and shows customer
 * data to anyone who opens devtools, and errors go to a console nobody is
 * watching instead of to monitoring.
 *
 * Same shape as the mobile logger (`mobile/src/utils/logger.ts`) so the two
 * codebases read alike: `debug` is development-only, `warn` and `error` always
 * run and forward to `monitoring`, which is a no-op stub today and becomes
 * Sentry when it is re-enabled — at which point every call site here starts
 * reporting without further work.
 */
import { captureException, captureMessage } from './monitoring';

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /** Development only. Stripped from production builds. */
  debug(message: string, ...args: unknown[]): void {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /** Development only; use for expected, uninteresting milestones. */
  info(message: string, ...args: unknown[]): void {
    if (isDevelopment) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /** Something recoverable that somebody should eventually look at. */
  warn(message: string, ...args: unknown[]): void {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, ...args);
    }
    captureMessage(message);
  },

  /** Something went wrong. Always reported. */
  error(message: string, ...args: unknown[]): void {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, ...args);
    }
    const cause = args.find((arg) => arg instanceof Error);
    captureException(cause ?? new Error(message));
  },
};

export default logger;
