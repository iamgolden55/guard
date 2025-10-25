/**
 * Main Navigator
 * Contains tab navigation and modal screens for authenticated users
 */

import React, { lazy, Suspense } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { MainStackParamList } from '../types/navigation';

// Navigators
import { TabNavigator } from './TabNavigator';

// Components
import { NetworkStatusBanner } from '../components/common/NetworkStatusBanner';

// Lazy-load Modal Screens to prevent premature native module access
const ShiftDetailsScreen = lazy(() => import('../screens/shifts/ShiftDetailsScreen').then(m => ({ default: m.ShiftDetailsScreen })));
const CheckInFlowScreen = lazy(() => import('../screens/shifts/CheckInFlowScreen').then(m => ({ default: m.CheckInFlowScreen })));
const VenueTermsScreen = lazy(() => import('../screens/venue/VenueTermsScreen').then(m => ({ default: m.VenueTermsScreen })));
const VirtualIDScreen = lazy(() => import('../screens/profile/VirtualIDScreen').then(m => ({ default: m.VirtualIDScreen })));
const EditProfileScreen = lazy(() => import('../screens/profile/EditProfileScreen').then(m => ({ default: m.EditProfileScreen })));

// Incident Screens
const IncidentReportScreen = lazy(() => import('../screens/incidents/IncidentReportScreen').then(m => ({ default: m.IncidentReportScreen })));
const IncidentFormScreen = lazy(() => import('../screens/incidents/IncidentFormScreen').then(m => ({ default: m.IncidentFormScreen })));
const VoiceReportScreen = lazy(() => import('../screens/incidents/VoiceReportScreen').then(m => ({ default: m.VoiceReportScreen })));
const IncidentDetailScreen = lazy(() => import('../screens/incidents/IncidentDetailScreen').then(m => ({ default: m.IncidentDetailScreen })));

// Shift Checks Screens
const ShiftChecksScreen = lazy(() => import('../screens/checks').then(m => ({ default: m.ShiftChecksScreen })));
const FireExitCheckScreen = lazy(() => import('../screens/checks').then(m => ({ default: m.FireExitCheckScreen })));
const CapacityCheckScreen = lazy(() => import('../screens/checks').then(m => ({ default: m.CapacityCheckScreen })));
const ToiletCheckScreen = lazy(() => import('../screens/checks').then(m => ({ default: m.ToiletCheckScreen })));
// etc.

const Stack = createStackNavigator<MainStackParamList>();

// Wrapper component for lazy-loaded screens with Suspense
const LazyScreen = ({ component: Component, ...props }: any) => (
  <Suspense
    fallback={
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    }
  >
    <Component {...props} />
  </Suspense>
);

export const MainNavigator = () => {
  return (
    <View style={styles.container}>
      <NetworkStatusBanner />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Main Tab Navigator */}
        <Stack.Screen name="Tabs" component={TabNavigator} />

        {/* Modal Screens - Lazy loaded */}
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="ShiftDetails">
            {(props) => <LazyScreen component={ShiftDetailsScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="CheckInFlow">
            {(props) => <LazyScreen component={CheckInFlowScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="VenueTerms">
            {(props) => <LazyScreen component={VenueTermsScreen} {...props} />}
          </Stack.Screen>

          {/* Shift Checks Screens */}
          <Stack.Screen name="ShiftChecks">
            {(props) => <LazyScreen component={ShiftChecksScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="FireExitCheck">
            {(props) => <LazyScreen component={FireExitCheckScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="CapacityCheck">
            {(props) => <LazyScreen component={CapacityCheckScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="ToiletCheck">
            {(props) => <LazyScreen component={ToiletCheckScreen} {...props} />}
          </Stack.Screen>

          {/* Profile Screens */}
          <Stack.Screen name="VirtualID">
            {(props) => <LazyScreen component={VirtualIDScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="EditProfile">
            {(props) => <LazyScreen component={EditProfileScreen} {...props} />}
          </Stack.Screen>

          {/* Incident Screens */}
          <Stack.Screen
            name="IncidentReport"
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
          >
            {(props) => <LazyScreen component={IncidentReportScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="IncidentForm">
            {(props) => <LazyScreen component={IncidentFormScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="VoiceReport">
            {(props) => <LazyScreen component={VoiceReportScreen} {...props} />}
          </Stack.Screen>
          <Stack.Screen name="IncidentDetail">
            {(props) => <LazyScreen component={IncidentDetailScreen} {...props} />}
          </Stack.Screen>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
});
