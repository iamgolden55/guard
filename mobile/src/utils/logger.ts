/**
 * Production-Safe Logger
 * Only logs in development, prevents sensitive data leaks in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = __DEV__;

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
  }

  /**
   * Error level logging - shown in development and production
   * In production, only logs the message without sensitive data
   */
  error(message: string, error?: any) {
    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      // In production, only log the message, not the full error object
      console.error(`[ERROR] ${message}`);
    }
  }

  /**
   * Log successful authentication (without sensitive data)
   */
  logAuth(action: 'login' | 'logout' | 'biometric', userId?: number | string) {
    if (this.isDevelopment) {
      console.log(`[AUTH] ${action.toUpperCase()} - User ID: ${userId || 'N/A'}`);
    }
  }

  /**
   * Log API calls (without sensitive data)
   */
  logApiCall(method: string, endpoint: string, status?: number) {
    if (this.isDevelopment) {
      console.log(`[API] ${method} ${endpoint}${status ? ` - ${status}` : ''}`);
    }
  }

  /**
   * Log navigation events
   */
  logNavigation(screen: string, params?: any) {
    if (this.isDevelopment) {
      console.log(`[NAV] → ${screen}`, params ? this.sanitize([params])[0] : '');
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
