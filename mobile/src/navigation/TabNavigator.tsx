/**
 * Tab Navigator
 * Bottom tabs for main app navigation.
 * Uses TabBarV2 — custom redesigned bottom bar with red accent.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../types/navigation';
import { useAuth } from '../hooks/useAuth';
import { fontFamilies } from '../theme';
import { useRedesignTheme } from '../theme/redesign';
import { TabBarV2 } from '../components/redesign';

// Screens
import { DashboardHomeV2 as UberDashboardScreen } from '../screens/dashboard/v2';
import { ShiftsScreenV2 as UberShiftsScreen } from '../screens/shifts/v2';
import { ManageShiftsListScreenV2 as ManageShiftsListScreen } from '../screens/shifts/manage/v2';
import { TeamScreenV2 as TeamScreen } from '../screens/team/v2';
import { ProfileScreenV2 as ProfileScreen } from '../screens/profile/v2';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabNavigator = () => {
  const { user } = useAuth();
  const redesign = useRedesignTheme();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const headerBg = redesign.colors.canvas;
  const headerBorder = redesign.colors.surface.hairline;
  const headerText = redesign.colors.text.primary;

  return (
    <Tab.Navigator
      tabBar={(props: any) => <TabBarV2 {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: headerBg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: headerBorder,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontFamily: fontFamilies.plusJakarta.bold,
          fontWeight: '700',
          color: headerText,
        },
        tabBarActiveTintColor: redesign.colors.accent,
        tabBarInactiveTintColor: redesign.colors.text.tertiary,
      }}
    >
      <Tab.Screen
        name="Home"
        component={UberDashboardScreen}
        options={{ headerShown: false, tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Calendar"
        component={UberShiftsScreen}
        options={{ headerShown: false, tabBarLabel: 'Shifts' }}
      />
      {isManager && (
        <Tab.Screen
          name="Manage"
          component={ManageShiftsListScreen}
          options={{ headerShown: false, tabBarLabel: 'Manage' }}
        />
      )}
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{ headerShown: false, tabBarLabel: 'Stats' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false, tabBarLabel: 'You' }}
      />
    </Tab.Navigator>
  );
};
