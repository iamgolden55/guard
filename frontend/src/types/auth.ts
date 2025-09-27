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

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingLoading: boolean;
  error: string | null;
  onboarding: OnboardingStatus;
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

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenResponse {
  access: string;
}
