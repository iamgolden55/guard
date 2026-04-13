import api from './api';
import { type LoginRequest, type LoginResponse, type RefreshTokenResponse, type RegisterRequest, type User, UserRole } from '../types';
import { setAuthCookie, getAuthToken, removeAuthTokens } from '../utils/auth';

// Demo mode flag - set to true to use demo authentication
const DEMO_MODE = false;  // Set to false to use real authentication

// Debug flag for easier troubleshooting
const DEBUG = false;

// Demo user data (for testing purposes only)
const DEMO_USERS: { [key: string]: User } = {
  'admin': {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    isActive: true
  },
  'manager': {
    id: 2,
    username: 'manager',
    email: 'manager@example.com',
    firstName: 'Manager',
    lastName: 'User',
    role: UserRole.MANAGER,
    isActive: true
  },
  'staff': {
    id: 3,
    username: 'staff',
    email: 'staff@example.com',
    firstName: 'Staff',
    lastName: 'User',
    role: UserRole.STAFF,
    isActive: true
  },
  'james44': {
    id: 4,
    username: 'James44',
    email: 'james44@example.com',
    firstName: 'FirstName',
    lastName: 'LastName',
    role: UserRole.STAFF,
    isActive: true
  }
};

class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    if (DEBUG) console.log('AuthService.login called with username:', credentials.username);

    // In demo mode, accept any credentials but use predefined user based on username if available
    if (DEMO_MODE) {
      // Convert username to lowercase for case-insensitive matching
      const lowercaseUsername = credentials.username.toLowerCase();

      // Get the demo user based on username or use admin as default
      const demoUser = DEMO_USERS[lowercaseUsername] || DEMO_USERS.admin;

      console.log('Demo login with user:', demoUser);

      // Sprint 3: In demo mode, only store user data (no tokens in localStorage)
      const demoResponse: LoginResponse = {
        message: 'Demo login successful',
        user: demoUser
      };

      // Sprint 3: Only store user data (tokens are in httpOnly cookies in production)
      localStorage.setItem('user', JSON.stringify(demoResponse.user));

      return demoResponse;
    }

    // Sprint 3: Normal API flow for production - backend sets httpOnly cookies
    try {
      if (DEBUG) console.log('Making login API call');
      const response = await api.post<any>('/api/v1/login/', credentials);

      if (DEBUG) console.log('Login API response:', response.data);

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
    if (DEMO_MODE) {
      // Create a demo user
      const demoUser: User = {
        id: 4,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: UserRole.STAFF, // Default to staff role for new registrations
        isActive: true
      };

      return demoUser;
    }

    const response = await api.post<User>('/api/v1/users/', userData);
    return response.data;
  }

  // Sprint 3: Cookie-based token refresh (no parameters needed, refresh token is in httpOnly cookie)
  async refreshToken(): Promise<void> {
    if (DEBUG) console.log('AuthService.refreshToken called');

    if (DEMO_MODE) {
      console.log('Demo mode: refresh token successful (no-op)');
      return;
    }

    try {
      if (DEBUG) console.log('Making cookie-based refresh token API call');
      // Sprint 3: Call cookie-based refresh endpoint (refresh token is in httpOnly cookie)
      await api.post<RefreshTokenResponse>('/api/v1/auth/refresh/', {});

      if (DEBUG) console.log('Refresh token API response success (tokens updated in cookies)');

      // Sprint 3: No need to store tokens - backend sets them as httpOnly cookies
      // Just return successfully
    } catch (error) {
      console.error('Refresh token API error:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<User> {
    if (DEBUG) console.log('AuthService.getUserProfile called');

    if (DEMO_MODE) {
      // Return the stored user from localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          // Preserve original user role
          console.log('DEMO MODE: Retrieved user profile from localStorage:', user);
          return user;
        } catch (error) {
          console.error('Failed to parse user data:', error);
          // Return admin user as fallback
          console.log('DEMO MODE: Returning admin user as fallback');
          return DEMO_USERS.admin;
        }
      }

      // Return admin user as fallback
      console.log('DEMO MODE: No user in localStorage, returning admin user as fallback');
      return DEMO_USERS.admin;
    }

    // Sprint 3: Cookie-based authentication - API calls automatically include cookies
    try {
      // Try to get profile from API first
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
        console.log('Retrieved user profile from API:', response.data);

        // Ensure proper mapping of fields
        const mappedUser = {
          ...response.data,
          firstName: response.data.first_name || response.data.firstName || '',
          lastName: response.data.last_name || response.data.lastName || ''
        };

        // Store updated user data
        localStorage.setItem('user', JSON.stringify(mappedUser));
        return mappedUser;
      } catch (apiError) {
        console.error('API profile fetch failed:', apiError);
        // Don't retry here - let the api.ts interceptor handle token refresh
        // This prevents competing refresh attempts that cause infinite loops
        throw apiError;
      }
    } catch (error) {
      console.error('GetUserProfile error:', error);
      throw error;
    }
  }

  // Sprint 3: Logout calls backend to clear httpOnly cookies
  async logout(): Promise<void> {
    if (DEBUG) console.log('AuthService.logout called');

    // Sprint 3: Call backend logout endpoint to clear httpOnly cookies
    try {
      await api.post('/api/v1/logout/', {});
      console.log('Logout API call successful - httpOnly cookies cleared by backend');
    } catch (error) {
      console.error('Logout API error (continuing with local cleanup):', error);
      // Continue with local cleanup even if API call fails
    }

    // Clear all auth data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    console.log('User logged out, all auth data cleared from localStorage');
  }

  // Sprint 3: Check if user is authenticated (based on user presence, not tokens)
  // Note: Real authentication is based on httpOnly cookies which we can't access from JS
  // This is just a local check - the backend validates the actual session
  isAuthenticated(): boolean {
    const userStr = localStorage.getItem('user');
    const isAuth = !!userStr;
    if (DEBUG) console.log('AuthService.isAuthenticated (local check):', isAuth);
    return isAuth;
  }

  getCurrentUser(): User | null {
    if (DEBUG) console.log('AuthService.getCurrentUser called');
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        
        // User should already have firstName and lastName from the API
        
        // Ensure these fields are never undefined
        user.firstName = user.firstName || '';
        user.lastName = user.lastName || '';
        
        if (DEBUG) console.log('Current user from localStorage:', user);
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
