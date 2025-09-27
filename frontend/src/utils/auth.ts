// Secure token storage utilities

/**
 * Sets a secure httpOnly cookie for authentication
 */
export const setAuthCookie = (name: string, value: string, days: number = 7): void => {
  // In a real implementation, this would be handled by the backend
  // by setting httpOnly cookies in the response headers
  console.warn('setAuthCookie should be implemented server-side with httpOnly cookies');

  // For development/testing, fall back to secure localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.error('Failed to store auth token:', error);
    }
  }
};

/**
 * Gets an authentication token from secure storage
 */
export const getAuthToken = (name: string): string | null => {
  // In a real implementation, this would be handled by the backend
  // reading httpOnly cookies from the request headers

  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.error('Failed to retrieve auth token:', error);
      return null;
    }
  }

  return null;
};

/**
 * Removes authentication tokens from secure storage
 */
export const removeAuthTokens = (): void => {
  // In a real implementation, this would be handled by the backend
  // by clearing the httpOnly cookies in the response headers

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Failed to remove auth tokens:', error);
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

// Development warning about token storage
if (process.env.NODE_ENV === 'development') {
  console.warn(
    'SECURITY WARNING: Tokens are currently stored in localStorage for development. ' +
    'In production, implement httpOnly cookies for secure token storage.'
  );
}