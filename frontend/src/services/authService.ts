import api from './api';
import { type LoginRequest, type LoginResponse, type RefreshTokenResponse, type RegisterRequest, type User, UserRole } from '../types';
import { setAuthCookie, getAuthToken, removeAuthTokens } from '../utils/auth';

class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Sprint 3: Normal API flow for production - backend sets httpOnly cookies
    try {
      const response = await api.post<any>('/api/v1/login/', credentials);

      // Sprint 3: Backend now returns only user object (tokens are in httpOnly cookies)
      // Map Django field names to frontend field names
      const user = {
        id: response.data.user.id,
        username: response.data.user.username,
        email: response.data.user.email,
        firstName: response.data.user.first_name,  // Ensure this maps correctly to firstName
        lastName: response.data.user.last_name,    // Ensure this maps correctly to lastName
        role: response.data.user.role || 'staff',
        isActive: response.data.user.is_active
      };

      // Sprint 3: Create formatted response (no tokens, they're in httpOnly cookies)
      const formattedResponse: LoginResponse = {
        message: response.data.message || 'Login successful',
        user: user
      };

      // Store user data
      localStorage.setItem('user', JSON.stringify(formattedResponse.user));

      // HYBRID AUTH: Also store tokens in localStorage as fallback for Safari/browsers
      // that block cross-site cookies. The backend returns tokens in response body.
      if (response.data.access) {
        localStorage.setItem('access_token', response.data.access);
      }
      if (response.data.refresh) {
        localStorage.setItem('refresh_token', response.data.refresh);
      }

      return formattedResponse;
    } catch (error) {
      console.error('Login API error:', error);
      throw error;
    }
  }

  async register(userData: RegisterRequest): Promise<User> {
    const response = await api.post<User>('/api/v1/users/', userData);
    return response.data;
  }

  // Sprint 3: Cookie-based token refresh (no parameters needed, refresh token is in httpOnly cookie)
  async refreshToken(): Promise<void> {
    try {
      // Sprint 3: Call cookie-based refresh endpoint (refresh token is in httpOnly cookie)
      await api.post<RefreshTokenResponse>('/api/v1/auth/refresh/', {});

      // Sprint 3: No need to store tokens - backend sets them as httpOnly cookies
      // Just return successfully
    } catch (error) {
      console.error('Refresh token API error:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<User> {
    // Sprint 3: Cookie-based authentication - API calls automatically include cookies
    try {
      // Since the /users/me/ endpoint doesn't exist, we can instead use:
      // 1. Get user ID from localStorage
      // 2. Make a request to /users/{id}/ endpoint (cookies handle auth)
      const userStr = localStorage.getItem('user');
      if (!userStr) throw new Error('No user data in localStorage');

      const userData = JSON.parse(userStr) as User;
      if (!userData.id) throw new Error('User ID not found in localStorage');

      // Sprint 3: API call will automatically include httpOnly cookies for auth
      const response = await api.get<any>(`/api/v1/users/${userData.id}/`);

      // Ensure proper mapping of fields
      const mappedUser = {
        ...response.data,
        firstName: response.data.first_name || response.data.firstName || '',
        lastName: response.data.last_name || response.data.lastName || ''
      };

      // Store updated user data
      localStorage.setItem('user', JSON.stringify(mappedUser));
      return mappedUser;
    } catch (error) {
      console.error('GetUserProfile error:', error);
      throw error;
    }
  }

  // Sprint 3: Logout calls backend to clear httpOnly cookies
  async logout(): Promise<void> {
    // Sprint 3: Call backend logout endpoint to clear httpOnly cookies
    try {
      await api.post('/api/v1/logout/', {});
    } catch (error) {
      console.error('Logout API error (continuing with local cleanup):', error);
      // Continue with local cleanup even if API call fails
    }

    // Clear all auth data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Sprint 3: Check if user is authenticated (based on user presence, not tokens)
  // Note: Real authentication is based on httpOnly cookies which we can't access from JS
  // This is just a local check - the backend validates the actual session
  isAuthenticated(): boolean {
    return !!localStorage.getItem('user');
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr) as User;

        // Ensure these fields are never undefined
        user.firstName = user.firstName || '';
        user.lastName = user.lastName || '';

        return user;
      } catch (error) {
        console.error('Failed to parse user data:', error);
        return null;
      }
    }
    return null;
  }
}

export default new AuthService();
