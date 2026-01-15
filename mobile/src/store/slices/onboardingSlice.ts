/**
 * Onboarding Redux Slice
 * Manages onboarding state for first-launch carousel experience
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentSlideIndex: number;
  completedAt: string | null; // ISO timestamp
}

const initialState: OnboardingState = {
  hasCompletedOnboarding: false,
  currentSlideIndex: 0,
  completedAt: null,
};

/**
 * Onboarding Slice
 */
const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    // Mark onboarding as completed
    completeOnboarding: (state) => {
      state.hasCompletedOnboarding = true;
      state.completedAt = new Date().toISOString();
      state.currentSlideIndex = 0;
    },

    // Reset onboarding (for Settings replay)
    resetOnboarding: (state) => {
      state.hasCompletedOnboarding = false;
      state.currentSlideIndex = 0;
      state.completedAt = null;
    },

    // Track current slide position
    setCurrentSlide: (state, action: PayloadAction<number>) => {
      state.currentSlideIndex = action.payload;
    },
  },
});

// Actions
export const {
  completeOnboarding,
  resetOnboarding,
  setCurrentSlide,
} = onboardingSlice.actions;

// Selectors
export const selectHasCompletedOnboarding = (state: { onboarding: OnboardingState }) =>
  state.onboarding.hasCompletedOnboarding;

export const selectCurrentSlideIndex = (state: { onboarding: OnboardingState }) =>
  state.onboarding.currentSlideIndex;

export const selectOnboardingCompletedAt = (state: { onboarding: OnboardingState }) =>
  state.onboarding.completedAt;

export default onboardingSlice.reducer;
