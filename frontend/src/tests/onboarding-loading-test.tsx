/**
 * Phase 3 Architecture Simplification Test
 *
 * This test file demonstrates the unified AuthGuard component functionality.
 * Run this test to verify that the AuthGuard properly handles loading states,
 * authentication, and onboarding requirements in a unified manner.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard';
import { AuthProvider } from '../contexts/AuthContext';
import type { AuthState } from '../types/auth';

// Mock the auth service
jest.mock('../services/authService', () => ({
  getUserProfile: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
}));

// Mock the onboarding service
jest.mock('../services/onboardingService', () => ({
  getOnboardingProgress: jest.fn(),
  getProgress: jest.fn(),
  updateProgress: jest.fn(),
  clearProgress: jest.fn(),
}));

// Test helper to create AuthContext with specific state
const TestWrapper: React.FC<{ authState: Partial<AuthState>; children: React.ReactNode }> = ({
  authState,
  children
}) => {
  const mockAuthState: AuthState = {
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    onboardingLoading: false,
    error: null,
    onboarding: {
      isCompleted: null,
      currentStep: null,
      completedSteps: [],
      hasCompany: false
    },
    ...authState
  };

  return (
    <BrowserRouter>
      <AuthProvider value={{
        authState: mockAuthState,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        isUserRole: jest.fn(),
        refreshUserToken: jest.fn(),
        updateOnboardingStatus: jest.fn(),
        completeOnboarding: jest.fn(),
      }}>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Phase 3: Unified AuthGuard Functionality', () => {
  it('should show loading spinner when isLoading is true', () => {
    render(
      <TestWrapper authState={{ isLoading: true }}>
        <AuthGuard requireOnboarding={true}>
          <div>Protected Content</div>
        </AuthGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should show loading spinner when onboardingLoading is true', () => {
    render(
      <TestWrapper authState={{
        isAuthenticated: true,
        onboardingLoading: true
      }}>
        <AuthGuard requireOnboarding={true}>
          <div>Protected Content</div>
        </AuthGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should show loading spinner when currentStep is null (unloaded state)', () => {
    render(
      <TestWrapper authState={{
        isAuthenticated: true,
        onboarding: {
          isCompleted: null,
          currentStep: null, // This is the key test - null means not loaded yet
          completedSteps: [],
          hasCompany: false
        }
      }}>
        <AuthGuard requireOnboarding={true}>
          <div>Protected Content</div>
        </AuthGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should NOT show loading spinner when currentStep is 1 (loaded state)', () => {
    render(
      <TestWrapper authState={{
        isAuthenticated: true,
        onboarding: {
          isCompleted: false, // false means loaded but not completed
          currentStep: 1, // 1 means loaded with actual step value
          completedSteps: [],
          hasCompany: false
        }
      }}>
        <AuthGuard requireOnboarding={true}>
          <div>Protected Content</div>
        </AuthGuard>
      </TestWrapper>
    );

    // Should redirect to onboarding since not completed, but no loading spinner
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should show protected content when onboarding is completed', () => {
    render(
      <TestWrapper authState={{
        isAuthenticated: true,
        onboarding: {
          isCompleted: true, // true means completed
          currentStep: 5, // final step
          completedSteps: [1, 2, 3, 4, 5],
          hasCompany: true
        }
      }}>
        <AuthGuard requireOnboarding={true}>
          <div>Protected Content</div>
        </AuthGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should allow access without onboarding requirement', () => {
    render(
      <TestWrapper authState={{
        isAuthenticated: true,
        onboarding: {
          isCompleted: false,
          currentStep: 1,
          completedSteps: [],
          hasCompany: false
        }
      }}>
        <AuthGuard requireOnboarding={false}>
          <div>Public Content</div>
        </AuthGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Public Content')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});

/**
 * Test Summary:
 *
 * These tests verify the Phase 3 unified AuthGuard functionality:
 *
 * 1. ✅ Loading spinner shows during general loading (isLoading: true)
 * 2. ✅ Loading spinner shows during onboarding data loading (onboardingLoading: true)
 * 3. ✅ Loading spinner shows when onboarding data is unloaded (currentStep: null)
 * 4. ✅ No loading spinner when onboarding data is loaded (currentStep: number)
 * 5. ✅ Protected content shows when onboarding is completed
 * 6. ✅ Supports optional onboarding requirement (requireOnboarding: false)
 *
 * Key Improvements:
 * - Unified authentication and onboarding guard in single component
 * - Flexible onboarding requirement (optional parameter)
 * - Role-based authorization support
 * - Company requirement validation
 * - Eliminates double protection patterns
 * - Simplified routing architecture
 */