/**
 * Auth Navigator
 * Handles login, biometric setup, and password recovery flows
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { AuthStackParamList } from '../types/navigation';

// Screens
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
// import { BiometricSetupScreen } from '../screens/auth/BiometricSetupScreen';

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          animationEnabled: true,
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Back',
          headerBackTitleStyle: {
            fontSize: 18,
            fontWeight: 'bold',
          },
          headerStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTintColor: '#000000',
          headerBackTitleVisible: true,
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          animationEnabled: true,
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Back',
          headerBackTitleStyle: {
            fontSize: 18,
            fontWeight: 'bold',
          },
          headerStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTintColor: '#000000',
          headerBackTitleVisible: true,
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          animationEnabled: true,
        }}
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
