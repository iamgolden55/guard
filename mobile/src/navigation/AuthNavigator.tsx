/**
 * Auth Navigator
 * Handles login, biometric setup, and password recovery flows
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { AuthStackParamList } from '../types/navigation';

// Screens — V2 redesign (dark premium). Old light versions still live at
// ../screens/auth/{Welcome,Login,Register,ForgotPassword}Screen.tsx and can
// be restored by reverting just this import block.
import { WelcomeScreenV2 as WelcomeScreen } from '../screens/auth/v2';
import { LoginScreenV2 as LoginScreenRaw } from '../screens/auth/v2';
import { RegisterScreenV2 as RegisterScreen } from '../screens/auth/v2';
import { ForgotPasswordScreenV2 as ForgotPasswordScreen } from '../screens/auth/v2';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Wrap LoginScreen in ErrorBoundary so crashes don't kill the app
const LoginScreen = () => (
  <ErrorBoundary fallbackLabel="The sign-in screen encountered an error">
    <LoginScreenRaw />
  </ErrorBoundary>
);
// import { BiometricSetupScreen } from '../screens/auth/BiometricSetupScreen';

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0b0b0e' },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animationEnabled: true }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ animationEnabled: true }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ animationEnabled: true }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ animationEnabled: true }}
      />
      {/*
      <Stack.Screen
        name="BiometricSetup"
        component={BiometricSetupScreen}
      />
      */}
    </Stack.Navigator>
  );
};
