/**
 * Main Navigator
 * Contains tab navigation and modal screens for authenticated users
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { MainStackParamList } from '../types/navigation';

// Navigators
import { TabNavigator } from './TabNavigator';

// Components
import { NetworkStatusBanner, SyncStatusBanner } from '../components/common';

// Team Screens
import { TeamMemberProfileScreenV2 as TeamMemberProfileScreen } from '../screens/team/v2';

// Shift Screens
import {
  CheckInFlowV2 as CheckInFlowScreen,
  ShiftDetailsScreenV2 as ShiftDetailsScreen,
  AvailableShiftsScreenV2 as UberAvailableShiftsScreen,
  ShiftExchangesScreenV2 as UberShiftExchangesScreen,
} from '../screens/shifts/v2';
import { CreateShiftScreenV2 as CreateShiftScreen } from '../screens/shifts/manage/v2';
import { EditShiftScreenV2 as EditShiftScreen } from '../screens/shifts/manage/v2';

// Venue Screens
import { VenueTermsScreen } from '../screens/venue/VenueTermsScreen';

// Profile Screens
import { VirtualIDScreenV2 as VirtualIDScreen } from '../screens/profile/v2';
import { EditProfileScreenV2 as EditProfileScreen } from '../screens/profile/v2';
import { SyncQueueScreen } from '../screens/profile/SyncQueueScreen';
import { EarningsScreenV2 as EarningsScreen } from '../screens/profile/v2';
import { InvoiceDetailScreenV2 as InvoiceDetailScreen } from '../screens/profile/v2';

// Test/Debug Screens
import { NotificationTestScreen } from '../screens/NotificationTestScreen';

// Leave Management Screens
import { LeaveBalanceScreenV2 as LeaveBalanceScreen } from '../screens/leave/v2';
import { LeaveRequestScreenV2 as LeaveRequestScreen } from '../screens/leave/v2';
import { LeaveHistoryScreenV2 as LeaveHistoryScreen } from '../screens/leave/v2';
import { LeaveRequestDetailScreen } from '../screens/leave/LeaveRequestDetailScreen';
import { ContractorUnavailabilityScreenV2 as ContractorUnavailabilityScreen } from '../screens/leave/v2';

// Incident Screens
import { IncidentReportScreenV2 as IncidentReportScreen } from '../screens/incidents/v2';
import { IncidentFormScreenV2 as IncidentFormScreen } from '../screens/incidents/v2';
import { VoiceReportScreenV2 as VoiceReportScreen } from '../screens/incidents/v2';
import { IncidentDetailScreen } from '../screens/incidents/IncidentDetailScreen';

// Shift Checks Screens
import { ShiftChecksScreen, FireExitCheckScreen, CapacityCheckScreen, ToiletCheckScreen } from '../screens/checks';

const Stack = createStackNavigator<MainStackParamList>();

export const MainNavigator = () => {
  return (
    <View style={styles.container}>
      <NetworkStatusBanner />
      <SyncStatusBanner />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Main Tab Navigator */}
        <Stack.Screen name="Tabs" component={TabNavigator} />

        {/* Modal Screens */}
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="ShiftDetails" component={ShiftDetailsScreen} />
          <Stack.Screen name="CheckInFlow" component={CheckInFlowScreen} />
          <Stack.Screen name="AvailableShifts" component={UberAvailableShiftsScreen} />
          <Stack.Screen name="ShiftExchanges" component={UberShiftExchangesScreen} />
          <Stack.Screen
            name="CreateShift"
            component={CreateShiftScreen}
            options={{ presentation: 'card' }}
          />
          <Stack.Screen
            name="EditShift"
            component={EditShiftScreen}
            options={{ presentation: 'card' }}
          />
          <Stack.Screen name="VenueTerms" component={VenueTermsScreen} />

          {/* Shift Checks Screens */}
          <Stack.Screen name="ShiftChecks" component={ShiftChecksScreen} />
          <Stack.Screen name="FireExitCheck" component={FireExitCheckScreen} />
          <Stack.Screen name="CapacityCheck" component={CapacityCheckScreen} />
          <Stack.Screen name="ToiletCheck" component={ToiletCheckScreen} />

          {/* Profile Screens */}
          <Stack.Screen name="VirtualID" component={VirtualIDScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="TeamMemberProfile" component={TeamMemberProfileScreen} />
                    <Stack.Screen name="SyncQueue" component={SyncQueueScreen} />
                    <Stack.Screen name="Earnings" component={EarningsScreen} />
                    <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
          
                    {/* Leave Management Screens */
          }
          <Stack.Screen name="LeaveBalance" component={LeaveBalanceScreen} />
          <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
          <Stack.Screen name="LeaveHistory" component={LeaveHistoryScreen} />
          <Stack.Screen name="LeaveRequestDetail" component={LeaveRequestDetailScreen} />
          <Stack.Screen name="ContractorUnavailability" component={ContractorUnavailabilityScreen} />

          {/* Test/Debug Screens - only in development */}
          {__DEV__ && (
            <Stack.Screen
              name="NotificationTest"
              component={NotificationTestScreen}
              options={{
                headerShown: true,
                headerTitle: 'Notification Testing',
                headerBackTitle: 'Back',
                presentation: 'card',
              }}
            />
          )}

          {/* Incident Screens */}
          <Stack.Screen
            name="IncidentReport"
            component={IncidentReportScreen}
          />
          <Stack.Screen name="IncidentForm" component={IncidentFormScreen} />
          <Stack.Screen name="VoiceReport" component={VoiceReportScreen} />
          <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />

          {/*
          <Stack.Screen name="CheckOutFlow" component={CheckOutFlowScreen} />
          <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} />
          <Stack.Screen name="SignatureCapture" component={SignatureCaptureScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          */}
        </Stack.Group>
      </Stack.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
