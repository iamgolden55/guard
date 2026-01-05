export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

export enum UserRole {
  STAFF = 'staff',
  MANAGER = 'manager',
  ADMIN = 'admin'
}

export interface CompanyMembership {
  id: string;
  role: string;
  isOwner: boolean;
  isActive: boolean;
  companyId: string;
  companyName: string;
}

// Sprint 3: Removed token and refreshToken - they're in httpOnly cookies now
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingLoading: boolean;
  error: string | null;
  onboarding: OnboardingStatus;
  currentMembership: CompanyMembership | null;
}

export interface OnboardingStatus {
  isCompleted: boolean | null;
  currentStep: number | null;
  completedSteps: number[];
  companyId?: string;
  hasCompany: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// Sprint 3: Tokens are in httpOnly cookies, not in response body
export interface LoginResponse {
  message: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Sprint 3: Tokens are in httpOnly cookies, not in response body
export interface RefreshTokenResponse {
  message: string;
}
