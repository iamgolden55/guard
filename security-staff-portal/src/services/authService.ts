import api from './api';
import { type LoginRequest, type LoginResponse, type RefreshTokenResponse, type RegisterRequest, type User, UserRole } from '../types';

// Demo mode flag - set to true to use demo authentication
const DEMO_MODE = false;  // Set to false to use real authentication

// Debug flag for easier troubleshooting
const DEBUG = true;

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
    try {
      if (DEBUG) console.log('Making login API call');
      const response = await api.post<any>('/login/', credentials);
      
      if (DEBUG) console.log('Login API response:', response.data);
      
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

      // Create formatted response
      const formattedResponse: LoginResponse = {
        access: response.data.access,
        refresh: response.data.refresh,
        user: user
      };

      // Store tokens and user data in localStorage
      localStorage.setItem('token', formattedResponse.access);
      localStorage.setItem('refreshToken', formattedResponse.refresh);
      localStorage.setItem('user', JSON.stringify(formattedResponse.user));

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

    const response = await api.post<User>('/users/', userData);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<string> {
    if (DEBUG) console.log('AuthService.refreshToken called');
    
    if (DEMO_MODE) {
      console.log('Demo mode: returning demo refreshed token');
      return 'demo-refreshed-token';
    }

    try {
      if (DEBUG) console.log('Making refresh token API call');
      const response = await api.post<RefreshTokenResponse>('/token/refresh/', { refresh: refreshToken });

      if (DEBUG) console.log('Refresh token API response success');
      
      // Update token in localStorage
      localStorage.setItem('token', response.data.access);

      return response.data.access;
    } catch (error) {
      console.error('Refresh token API error:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<User> {
    if (DEBUG) console.log('AuthService.getUserProfile called');
    
    if (DEMO_MODE) {
      // Return the stored user in localStorage
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

    try {
      // Try to get profile from API first
      try {
        // Since the /users/me/ endpoint doesn't exist, we can instead use:
        // 1. Get user ID from localStorage
        // 2. Make a request to /users/{id}/ endpoint
        const userStr = localStorage.getItem('user');
        if (!userStr) throw new Error('No user data in localStorage');
        
        const userData = JSON.parse(userStr) as User;
        if (!userData.id) throw new Error('User ID not found in localStorage');
        
        const response = await api.get<any>(`/users/${userData.id}/`);
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
        console.error('API profile fetch failed, using localStorage fallback:', apiError);
        
        // Fallback to localStorage if API call fails
        const userStr = localStorage.getItem('user');
        if (!userStr) throw new Error('No user data found');
        
        const user = JSON.parse(userStr) as User;
        console.log('Retrieved user profile from localStorage:', user);
        
        // Validate the token is still valid by trying to refresh
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            await this.refreshToken(refreshToken);
            // Token refresh successful, user is valid
          } catch (refreshError) {
            console.error('Token refresh failed during profile validation:', refreshError);
            throw new Error('Session expired');
          }
        }
        
        return user;
      }
    } catch (error) {
      console.error('GetUserProfile error:', error);
      throw error;
    }
  }

  logout(): void {
    if (DEBUG) console.log('AuthService.logout called');
    
    // Remove all auth data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    console.log('User logged out, auth data cleared from localStorage');
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    const isAuth = !!token;
    if (DEBUG) console.log('AuthService.isAuthenticated:', isAuth);
    return isAuth;
  }

  getCurrentUser(): User | null {
    if (DEBUG) console.log('AuthService.getCurrentUser called');
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        
        // Ensure firstName and lastName fields are available
        if (user.first_name !== undefined && user.firstName === undefined) {
          user.firstName = user.first_name;
        }
        if (user.last_name !== undefined && user.lastName === undefined) {
          user.lastName = user.last_name; 
        }
        
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
