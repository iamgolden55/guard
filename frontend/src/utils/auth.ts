// Secure token storage utilities
// Tokens are now managed exclusively via httpOnly cookies set by the backend.
// These functions are retained as no-ops for backward compatibility with any
// callers that haven't been updated yet.

/**
 * @deprecated Tokens are set as httpOnly cookies by the backend. No client-side storage needed.
 */
export const setAuthCookie = (_name: string, _value: string, _days: number = 7): void => {
  // No-op: httpOnly cookies are set by the backend via Set-Cookie headers.
  // Client-side JS cannot and should not access auth tokens.
};

/**
 * @deprecated Tokens are in httpOnly cookies and not accessible from JS.
 */
export const getAuthToken = (_name: string): string | null => {
  // No-op: httpOnly cookies are sent automatically by the browser.
  return null;
};

/**
 * @deprecated Tokens are cleared by the backend logout endpoint.
 */
export const removeAuthTokens = (): void => {
  // Only clear non-sensitive UI state. Tokens are cleared by backend via cookie expiry.
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Failed to remove user data:', error);
    }
  }
};

/**
 * Checks if we're in a secure context (HTTPS)
 */
export const isSecureContext = (): boolean => {
  if (typeof window === 'undefined') return true; // SSR
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};
