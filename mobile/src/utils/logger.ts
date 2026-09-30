/**
 * Production-Safe Logger with Sentry Integration
 * Only logs debug info in development, reports errors to Sentry in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Sentry integration - lazy loaded to handle case where package isn't installed
let Sentry: any = null;

/** Keys never sent to Sentry, at any depth (compared lower-cased). */
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'accesstoken', 'refreshtoken', 'access', 'refresh',
  'authorization', 'cookie', 'headers', 'config', 'request',
  'bankdetails', 'bank_details', 'accountnumber', 'account_number', 'sortcode', 'sort_code',
  'national_insurance_number', 'date_of_birth', 'phone_number', 'email', 'street',
  'postal_code', 'sialicenses', 'sia_licenses',
]);
const MAX_ATTRIBUTE_LENGTH = 500;
const MAX_DEPTH = 5;

const truncate = (value: string) =>
  value.length > MAX_ATTRIBUTE_LENGTH ? `${value.slice(0, MAX_ATTRIBUTE_LENGTH)}…` : value;

/**
 * A copy of a logged value that is safe to send: sensitive keys dropped at
 * every depth, and an error reduced to what explains it (name, message, HTTP
 * status, the server's answer) — an axios error also carries the request
 * config, whose headers hold the user's bearer token.
 */
function scrub(value: any, depth = 0): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncate(value);
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[…]';
  if (value instanceof Error || (typeof value.message === 'string' && ('stack' in value || 'response' in value))) {
    const status = value.statusCode ?? value.status ?? value.response?.status;
    // axios nests the server's answer in `response.data`; ApiError keeps it
    // in `response` itself.
    const isAxiosResponse =
      value.response && typeof value.response === 'object' && ('data' in value.response || 'status' in value.response);
    const answer = isAxiosResponse ? value.response.data : value.response;
    return {
      name: value.name,
      message: truncate(String(value.message)),
      ...(status !== undefined && { status }),
      ...(value.code !== undefined && { code: value.code }),
      ...(answer !== undefined && { response: scrub(answer, depth + 1) }),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrub(item, depth + 1));
  const out: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    out[key] = scrub(item, depth + 1);
  }
  return out;
}

/**
 * Sentry log attributes are flat primitives: an object's own keys become
 * attributes, anything nested is sent as JSON.
 */
export function logAttributes(args: any[]): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {};
  args.forEach((arg, index) => {
    const clean = scrub(arg);
    if (clean === undefined || clean === null) return;
    if (typeof clean !== 'object' || Array.isArray(clean)) {
      attributes[`arg${index}`] = typeof clean === 'object' ? truncate(JSON.stringify(clean)) : clean;
      return;
    }
    for (const [key, item] of Object.entries(clean as Record<string, any>)) {
      if (item === undefined || item === null) continue;
      attributes[key] = typeof item === 'object' ? truncate(JSON.stringify(item)) : item;
    }
  });
  return attributes;
}
try {
  Sentry = require('@sentry/react-native');
} catch {
  // @sentry/react-native not installed - Sentry features disabled
}

class Logger {
  private isDevelopment = __DEV__;

  /**
   * Initialize Sentry for error tracking.
   * Call this from App.tsx before any other code.
   * No-op if @sentry/react-native is not installed or DSN is not set.
   */
  initSentry(dsn?: string) {
    if (!Sentry || !dsn) {
      if (this.isDevelopment) {
        console.log('[Logger] Sentry not initialized (missing SDK or DSN)');
      }
      return;
    }
    Sentry.init({
      dsn,
      environment: this.isDevelopment ? 'development' : 'production',
      tracesSampleRate: this.isDevelopment ? 1.0 : 0.1,
      enableAutoSessionTracking: true,
      debug: this.isDevelopment,
      // Silence native Session Replay "unreliable environment" warning
      // that fires loudly in Metro on iOS Simulator. No replay is
      // captured in these environments regardless of this flag.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      // Warnings and errors from `logger` go to Sentry Logs, searchable per
      // user. A warning used to be only a breadcrumb, seen only if an error
      // followed — a refused incident report sat in the sync queue with no
      // trace anywhere. Native SDK logs stay out.
      enableLogs: true,
      logsOrigin: 'js',
    });
  }

  /**
   * Set user context for Sentry
   */
  setUser(user: { id: string | number; email?: string; username?: string } | null) {
    if (Sentry) {
      Sentry.setUser(user ? { id: String(user.id), email: user.email, username: user.username } : null);
    }
  }

  /**
   * Debug level logging - only in development
   */
  debug(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...this.sanitize(args));
    }
  }

  /**
   * Info level logging - only in development
   */
  info(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, ...this.sanitize(args));
    }
  }

  /**
   * Warning level logging - shown in development and production
   */
  warn(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, ...this.sanitize(args));
    } else {
      console.warn(`[WARN] ${message}`);
    }
    // Report warnings to Sentry: as a log (searchable on its own) and as a
    // breadcrumb (context for any error that follows).
    if (Sentry) {
      Sentry.addBreadcrumb({ category: 'warning', message, level: 'warning' });
      Sentry.logger?.warn(message, logAttributes(args));
    }
  }

  /**
   * Error level logging - shown in development and production
   * In production, reports to Sentry
   */
  error(message: string, error?: any) {
    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      // In production, only log the message, not the full error object
      console.error(`[ERROR] ${message}`);
    }
    // Report to Sentry
    if (Sentry) {
      Sentry.logger?.error(message, logAttributes(error === undefined ? [] : [error]));
      if (error instanceof Error) {
        Sentry.captureException(error, { extra: { message } });
      } else {
        Sentry.captureMessage(message, { level: 'error', extra: { error } });
      }
    }
  }

  /**
   * Log successful authentication (without sensitive data)
   */
  logAuth(action: 'login' | 'logout' | 'biometric', userId?: number | string) {
    if (this.isDevelopment) {
      console.log(`[AUTH] ${action.toUpperCase()} - User ID: ${userId || 'N/A'}`);
    }
    if (Sentry) {
      Sentry.addBreadcrumb({ category: 'auth', message: action, data: { userId } });
    }
  }

  /**
   * Log API calls (without sensitive data)
   */
  logApiCall(method: string, endpoint: string, status?: number) {
    if (this.isDevelopment) {
      console.log(`[API] ${method} ${endpoint}${status ? ` - ${status}` : ''}`);
    }
    if (Sentry) {
      Sentry.addBreadcrumb({
        category: 'api',
        message: `${method} ${endpoint}`,
        data: { status },
        level: status && status >= 400 ? 'error' : 'info',
      });
    }
  }

  /**
   * Log navigation events
   */
  logNavigation(screen: string, params?: any) {
    if (this.isDevelopment) {
      console.log(`[NAV] → ${screen}`, params ? this.sanitize([params])[0] : '');
    }
    if (Sentry) {
      Sentry.addBreadcrumb({ category: 'navigation', message: screen });
    }
  }

  /**
   * Sanitize data to remove sensitive fields
   */
  private sanitize(data: any[]): any[] {
    return data.map((item) => {
      if (typeof item !== 'object' || item === null) {
        return item;
      }

      // Remove sensitive fields
      const sanitized = { ...item };
      const sensitiveFields = [
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'bankDetails',
        'bank_details',
        'accountNumber',
        'account_number',
        'sortCode',
        'sort_code',
        'national_insurance_number',
        'date_of_birth',
        'phone_number',
        'email',
        'street',
        'postal_code',
        'siaLicenses',
        'sia_licenses',
      ];

      sensitiveFields.forEach((field) => {
        if (field in sanitized) {
          delete sanitized[field];
        }
      });

      return sanitized;
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogLevel };
