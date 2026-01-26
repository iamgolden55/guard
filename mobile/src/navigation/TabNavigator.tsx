/**
 * Tab Navigator
 * Bottom tabs for main app navigation
 * Uber-inspired minimalist design with dark mode support
 */

import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { TabParamList } from '../types/navigation';
import { useTheme } from '../hooks/useTheme';
import { getUberColors, fontFamilies } from '../theme';

// Screens
import { UberDashboardScreen } from '../screens/dashboard/UberDashboardScreen';
import { UberShiftsScreen } from '../screens/shifts/uber/UberShiftsScreen';
import { TeamScreen } from '../screens/team/TeamScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<TabParamList>();

// Uber-style Tab Icon - simple, clean, no animations
const UberTabIcon = ({
  name,
  focused,
  isDark,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  isDark: boolean;
}) => {
  const uberColors = getUberColors(isDark);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
      <Ionicons
        name={name}
        size={24}
        color={focused ? uberColors.primary : uberColors.text.muted}
      />
    </View>
  );
};

// Uber-style Tab Label - clean typography
const UberTabLabel = ({ label, focused, isDark }: { label: string; focused: boolean; isDark: boolean }) => {
  const uberColors = getUberColors(isDark);
  return (
    <Text
      style={{
        fontSize: 10,
        fontFamily: fontFamilies.inter.semiBold,
        fontWeight: '600',
        color: focused ? uberColors.primary : uberColors.text.muted,
        marginTop: 2,
      }}
    >
      {label}
    </Text>
  );
};

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);

  return (
    <Tab.Navigator
      screenOptions={{
        // Hide header for Home - MapHeader handles it
        headerShown: true,
        headerStyle: {
          backgroundColor: uberColors.background.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: uberColors.border.light,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontFamily: fontFamilies.plusJakarta.bold,
          fontWeight: '700',
          color: uberColors.text.primary,
        },
        // Uber-style tab bar: clean with top border
        tabBarStyle: {
          backgroundColor: uberColors.background.surface,
          borderTopWidth: 1,
          borderTopColor: uberColors.border.light,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: uberColors.primary,
        tabBarInactiveTintColor: uberColors.text.muted,
        tabBarItemStyle: {
          gap: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={UberDashboardScreen}
        options={{
          headerShown: false, // MapHeader serves as header
          tabBarLabel: ({ focused }) => <UberTabLabel label="Home" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <UberTabIcon name="home" focused={focused} isDark={isDark} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={UberShiftsScreen}
        options={{
          headerShown: false, // UberShiftsScreen has its own header
          tabBarLabel: ({ focused }) => <UberTabLabel label="Shifts" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <UberTabIcon name="calendar-outline" focused={focused} isDark={isDark} />,
        }}
      />
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{
          headerTitle: 'Team',
          tabBarLabel: ({ focused }) => <UberTabLabel label="Stats" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <UberTabIcon name="bar-chart-outline" focused={focused} isDark={isDark} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'Profile',
          tabBarLabel: ({ focused }) => <UberTabLabel label="Profile" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <UberTabIcon name="person-outline" focused={focused} isDark={isDark} />,
        }}
      />
    </Tab.Navigator>
  );
};
