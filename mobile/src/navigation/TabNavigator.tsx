/**
 * Tab Navigator
 * Bottom tabs for main app navigation
 * Community-inspired design: white bar, Poppins-style labels, blue top indicator on active tab
 */

import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { TabParamList } from '../types/navigation';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { fontFamilies } from '../theme';

// Screens
import { UberDashboardScreen } from '../screens/dashboard/UberDashboardScreen';
import { UberShiftsScreen } from '../screens/shifts/uber/UberShiftsScreen';
import { ManageShiftsListScreen } from '../screens/shifts/manage/ManageShiftsListScreen';
import { TeamScreen } from '../screens/team/TeamScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<TabParamList>();

// Community design tokens (from Figma node 1:321)
const NAV = {
  active: '#539DF3',
  inactiveLight: '#484C52',
  inactiveDark: '#A1A1AA',
  bgLight: '#FFFFFF',
  bgDark: '#18181B',
  borderLight: '#E5E7EB',
  borderDark: '#27272A',
  indicatorWidth: 56,
  indicatorHeight: 2,
  iconSize: 24,
  barPaddingTop: 12,
  labelSize: 12,
  labelLineHeight: 16,
  iconLabelGap: 6,
};

const TabIcon = ({
  name,
  focused,
  isDark,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  isDark: boolean;
}) => {
  const inactive = isDark ? NAV.inactiveDark : NAV.inactiveLight;
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: NAV.iconSize,
        height: NAV.iconSize,
      }}
    >
      {focused && (
        <View
          style={{
            position: 'absolute',
            top: -NAV.barPaddingTop,
            alignSelf: 'center',
            width: NAV.indicatorWidth,
            height: NAV.indicatorHeight,
            backgroundColor: NAV.active,
          }}
        />
      )}
      <Ionicons
        name={name}
        size={NAV.iconSize}
        color={focused ? NAV.active : inactive}
      />
    </View>
  );
};

const TabLabel = ({
  label,
  focused,
  isDark,
}: {
  label: string;
  focused: boolean;
  isDark: boolean;
}) => {
  const inactive = isDark ? NAV.inactiveDark : NAV.inactiveLight;
  return (
    <Text
      style={{
        fontSize: NAV.labelSize,
        lineHeight: NAV.labelLineHeight,
        fontFamily: focused ? fontFamilies.inter.medium : fontFamilies.inter.regular,
        fontWeight: focused ? '500' : '400',
        color: focused ? NAV.active : inactive,
        marginTop: NAV.iconLabelGap - 2, // gap handled by tabBarItemStyle
      }}
    >
      {label}
    </Text>
  );
};

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const bg = isDark ? NAV.bgDark : NAV.bgLight;
  const border = isDark ? NAV.borderDark : NAV.borderLight;
  const headerText = isDark ? '#FAFAFA' : '#111827';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: bg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: border,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontFamily: fontFamilies.plusJakarta.bold,
          fontWeight: '700',
          color: headerText,
        },
        tabBarStyle: {
          backgroundColor: bg,
          borderTopWidth: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: NAV.barPaddingTop,
          paddingHorizontal: 12,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: NAV.active,
        tabBarInactiveTintColor: isDark ? NAV.inactiveDark : NAV.inactiveLight,
        tabBarItemStyle: {
          gap: NAV.iconLabelGap,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={UberDashboardScreen}
        options={{
          headerShown: false,
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} isDark={isDark} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={UberShiftsScreen}
        options={{
          headerShown: false,
          tabBarLabel: ({ focused }) => <TabLabel label="Shifts" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" focused={focused} isDark={isDark} />,
        }}
      />
      {isManager && (
        <Tab.Screen
          name="Manage"
          component={ManageShiftsListScreen}
          options={{
            headerTitle: 'Manage Shifts',
            tabBarLabel: ({ focused }) => <TabLabel label="Manage" focused={focused} isDark={isDark} />,
            tabBarIcon: ({ focused }) => <TabIcon name="briefcase-outline" focused={focused} isDark={isDark} />,
          }}
        />
      )}
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{
          headerTitle: 'Team',
          tabBarLabel: ({ focused }) => <TabLabel label="Stats" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <TabIcon name="pie-chart-outline" focused={focused} isDark={isDark} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'Profile',
          tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} isDark={isDark} />,
          tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} isDark={isDark} />,
        }}
      />
    </Tab.Navigator>
  );
};
