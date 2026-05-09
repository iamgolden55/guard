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

// Auth Stack (welcome, login, register, biometric setup, forgot password)
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  BiometricSetup: undefined;
  ForgotPassword: undefined;
};

// Main Stack (authenticated users)
export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  // Modal Screens
  ShiftDetails: { shift?: Shift; shiftId?: number }; // Accept either full shift object OR just ID
  CreateShift: undefined;
  EditShift: { shiftId: number };
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
  IncidentReport: { shiftId: number; venueId: number };
  IncidentForm: {
    shiftId: number;
    venueId: number;
    prefilledType?: string;
    prefilledSeverity?: string;
  };
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
  ContractorUnavailability: undefined;
  Earnings: undefined;
  InvoiceDetail: { invoiceId: number };
  TeamMemberProfile: {
    memberId: number;
    name: string;
    role: string;
    photo?: string;
    presenceStatus: string;
    currentVenue?: string;
    statusMessage?: string;
    securityRoles: string[];
    employmentType?: string;
    siaLicenseTypes: string[];
    isOnShift: boolean;
    activeShift?: {
      venue_name: string | null;
      check_in_time: string | null;
      role_on_shift: string;
    } | null;
  };
};

// Tab Navigator (bottom tabs)
export type TabParamList = {
  Home: undefined;
  Calendar: undefined;
  Manage: undefined;
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
