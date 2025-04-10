import api from './api';
import { type LoginRequest, type LoginResponse, type RefreshTokenResponse, type RegisterRequest, type User, UserRole } from '../types';

// Demo mode flag - ensure this is true for testing
const DEMO_MODE = true;

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
  }
};

class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // In demo mode, accept any credentials but use predefined user based on username if available
    if (DEMO_MODE) {
      // Convert username to lowercase for case-insensitive matching
      const lowercaseUsername = credentials.username.toLowerCase();

      // Get the demo user based on username or use admin as default
      const demoUser = DEMO_USERS[lowercaseUsername] || DEMO_USERS.admin;

      console.log('Demo login with user:', demoUser);

      // Create a demo response preserving original role
      const demoResponse: LoginResponse = {
        access: 'demo-token',
        refresh: 'demo-refresh-token',
        user: demoUser
      };

      // Store tokens and user data in localStorage
      localStorage.setItem('token', demoResponse.access);
      localStorage.setItem('refreshToken', demoResponse.refresh);
      localStorage.setItem('user', JSON.stringify(demoResponse.user));

      return demoResponse;
    }

    // Normal API flow for production
    const response = await api.post<LoginResponse>('/accounts/login/', credentials);

    // Store tokens and user data in localStorage
    localStorage.setItem('token', response.data.access);
    localStorage.setItem('refreshToken', response.data.refresh);
    localStorage.setItem('user', JSON.stringify(response.data.user));

    return response.data;
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

    const response = await api.post<User>('/accounts/register/', userData);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<string> {
    if (DEMO_MODE) {
      return 'demo-refreshed-token';
    }

    const response = await api.post<RefreshTokenResponse>('/accounts/refresh/', { refresh: refreshToken });

    // Update token in localStorage
    localStorage.setItem('token', response.data.access);

    return response.data.access;
  }

  async getUserProfile(): Promise<User> {
    if (DEMO_MODE) {
      // Return the stored user in localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          // Preserve original user role
          console.log('Retrieved user profile from localStorage:', user);
          return user;
        } catch (error) {
          console.error('Failed to parse user data:', error);
          // Return admin user as fallback
          console.log('Returning admin user as fallback');
          return DEMO_USERS.admin;
        }
      }

      // Return admin user as fallback
      console.log('No user in localStorage, returning admin user as fallback');
      return DEMO_USERS.admin;
    }

    const response = await api.get<User>('/accounts/user/');
    return response.data;
  }

  logout(): void {
    // Remove all auth data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    console.log('User logged out, auth data cleared from localStorage');
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    console.log('Authentication check:', token ? 'Authenticated' : 'Not authenticated');
    return !!token;
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        console.log('Current user:', user);
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
