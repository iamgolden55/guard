/**
 * Tab Navigator
 * Bottom tabs for main app navigation
 * Wise-inspired design with circular active icons
 */

import React, { useRef, useEffect } from 'react';
import { View, Animated, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { TabParamList } from '../types/navigation';

// Screens
import { WiseDashboardScreen } from '../screens/dashboard/WiseDashboardScreen';
import { ShiftsScreen } from '../screens/shifts/ShiftsScreen';
import { TeamScreen } from '../screens/team/TeamScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<TabParamList>();

// Modern Tab Icon with Wise-inspired circular background
const ModernTabIcon = ({
  name,
  focused
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1 : 0,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const iconScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const circleOpacity = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 48, height: 48 }}>
      {/* Circular background for active state */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#F0F4FF',
          opacity: circleOpacity,
        }}
      />

      {/* Icon with scale animation */}
      <Animated.View
        style={{
          transform: [{ scale: iconScale }],
        }}
      >
        <Ionicons
          name={name}
          size={24}
          color={focused ? '#007AFF' : '#94A3B8'}
        />
      </Animated.View>
    </View>
  );
};

// Custom Tab Label with bold for active state
const TabLabel = ({ label, focused }: { label: string; focused: boolean }) => {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: focused ? '700' : '600',
        color: focused ? '#007AFF' : '#94A3B8',
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  );
};

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '700',
          color: '#1E293B',
        },

        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 4,
        },
        // Make active label bold
        tabBarItemStyle: {
          gap: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={WiseDashboardScreen}
        options={{
          headerTitle: 'Dashboard',
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
          tabBarIcon: ({ focused }) => <ModernTabIcon name="home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={ShiftsScreen}
        options={{
          headerTitle: 'My Shifts',
          tabBarLabel: ({ focused }) => <TabLabel label="Shifts" focused={focused} />,
          tabBarIcon: ({ focused }) => <ModernTabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{
          headerTitle: 'Team',
          tabBarLabel: ({ focused }) => <TabLabel label="Team" focused={focused} />,
          tabBarIcon: ({ focused }) => <ModernTabIcon name="people" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'Profile',
          tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} />,
          tabBarIcon: ({ focused }) => <ModernTabIcon name="person" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};
