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
import { TeamMemberProfileScreen } from '../screens/team/TeamMemberProfileScreen';

// Shift Screens
import { ShiftDetailsScreen } from '../screens/shifts/ShiftDetailsScreen';
import { CheckInFlowScreen } from '../screens/shifts/CheckInFlowScreen';
import { UberAvailableShiftsScreen } from '../screens/shifts/uber/UberAvailableShiftsScreen';
import { UberShiftExchangesScreen } from '../screens/shifts/uber/UberShiftExchangesScreen';
import { CreateShiftScreen } from '../screens/shifts/manage/CreateShiftScreen';
import { EditShiftScreen } from '../screens/shifts/manage/EditShiftScreen';

// Venue Screens
import { VenueTermsScreen } from '../screens/venue/VenueTermsScreen';

// Profile Screens
import { VirtualIDScreen } from '../screens/profile/VirtualIDScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { SyncQueueScreen } from '../screens/profile/SyncQueueScreen';
import { EarningsScreen } from '../screens/profile/EarningsScreen';
import { InvoiceDetailScreen } from '../screens/profile/InvoiceDetailScreen';

// Test/Debug Screens
import { NotificationTestScreen } from '../screens/NotificationTestScreen';

// Leave Management Screens
import { LeaveBalanceScreen } from '../screens/leave/LeaveBalanceScreen';
import { LeaveRequestScreen } from '../screens/leave/LeaveRequestScreen';
import { LeaveHistoryScreen } from '../screens/leave/LeaveHistoryScreen';
import { LeaveRequestDetailScreen } from '../screens/leave/LeaveRequestDetailScreen';
import { ContractorUnavailabilityScreen } from '../screens/leave/ContractorUnavailabilityScreen';

// Incident Screens
import { IncidentReportScreen } from '../screens/incidents/IncidentReportScreen';
import { IncidentFormScreen } from '../screens/incidents/IncidentFormScreen';
import { VoiceReportScreen } from '../screens/incidents/VoiceReportScreen';
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
            options={{
              headerShown: true,
              headerTitle: 'Create Shift',
              headerBackTitle: 'Back',
              presentation: 'card',
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#000000',
            }}
          />
          <Stack.Screen
            name="EditShift"
            component={EditShiftScreen}
            options={{
              headerShown: true,
              headerTitle: 'Reschedule Shift',
              headerBackTitle: 'Back',
              presentation: 'card',
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#000000',
            }}
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
            options={{
              headerShown: true,
              headerTitle: 'Report Incident',
              headerBackTitle: 'Back',
              presentation: 'card',
              headerStyle: {
                backgroundColor: '#FFFFFF',
              },
              headerTintColor: '#000000',
            }}
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
