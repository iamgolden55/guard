/**
 * Production-Safe Logger with Sentry Integration
 * Only logs debug info in development, reports errors to Sentry in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Sentry integration - lazy loaded to handle case where package isn't installed
let Sentry: any = null;
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
    // Report warnings to Sentry as breadcrumbs
    if (Sentry) {
      Sentry.addBreadcrumb({ category: 'warning', message, level: 'warning' });
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
