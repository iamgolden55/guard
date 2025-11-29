/**
 * Navigation Type Definitions
 * Ensures type-safe navigation throughout the app
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Shift } from '../store/slices/shiftsSlice';

// Root Stack (decides between Auth and Main)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

// Auth Stack (welcome, login, biometric setup, forgot password)
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  BiometricSetup: undefined;
  ForgotPassword: undefined;
};

// Main Stack (authenticated users)
export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  // Modal Screens
  ShiftDetails: { shift?: Shift; shiftId?: number }; // Accept either full shift object OR just ID
  AvailableShifts: undefined;
  ShiftExchanges: undefined;
  CheckInFlow: {
    shiftId: number;
    venueId: number;
    venueName: string;
    venueLatitude: number;
    venueLongitude: number;
    requiresTerms?: boolean;
    venueTerms?: string;
  };
  VenueTerms: {
    venueId: number;
    venueName: string;
    venueTerms: string;
    onAccept: () => void;
  };
  CheckOutFlow: { shiftId: number };
  IncidentReport: { shiftId?: number };
  IncidentForm: { shiftId?: number; prefilledType?: string; prefilledSeverity?: string };
  VoiceReport: { shiftId?: number };
  IncidentDetail: { incidentId: number };
  ShiftChecks: { shiftId: number };
  FireExitCheck: { shiftId: number; checkType?: string };
  CapacityCheck: { shiftId: number; checkType?: string };
  ToiletCheck: { shiftId: number; checkType?: string };
  CameraCapture: {
    purpose: 'check-in' | 'check-out' | 'incident' | 'profile';
    returnRoute: string;
  };
  SignatureCapture: {
    purpose: 'check-in' | 'check-out';
    shiftId: number;
  };
  VirtualID: undefined;
  Settings: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
  SyncQueue: undefined;
  NotificationTest: undefined;
  // Leave Management
  LeaveBalance: undefined;
  LeaveRequest: undefined;
  LeaveHistory: undefined;
  LeaveRequestDetail: { requestId: number };
};

// Tab Navigator (bottom tabs)
export type TabParamList = {
  Home: undefined;
  Calendar: undefined;
  Team: undefined;
  Profile: undefined;
};

// Drawer Navigator (side menu) - optional
export type DrawerParamList = {
  Home: undefined;
  MyShifts: undefined;
  Incidents: undefined;
  Profile: undefined;
  VirtualID: undefined;
  Settings: undefined;
  SyncStatus: undefined;
  Logout: undefined;
};

// Type for navigation prop in screens
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
