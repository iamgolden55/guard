/**
 * Navigation Reference
 * Allows navigation outside of React components (e.g., from notification handlers)
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate to a screen from outside React components
 */
export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params);
  } else {
    console.warn('[Navigation] Navigation not ready yet');
  }
}

/**
 * Check if navigation is ready
 */
export function isNavigationReady() {
  return navigationRef.isReady();
}
