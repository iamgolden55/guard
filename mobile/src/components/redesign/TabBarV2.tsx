/**
 * TabBarV2 — custom bottom tab bar matching the redesign.
 *
 * Intended for use with React Navigation's `tabBar` render prop:
 *
 *   <Tab.Navigator tabBar={props => <TabBarV2 {...props} />}>
 *
 * Features:
 *   - Geist Mono uppercase labels with tracking
 *   - Red accent for active icon + label
 *   - Custom SVG icons (mirrors the design's stroke-only style)
 *   - Light/dark themed via useRedesignTheme()
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRedesignTheme } from '../../theme/redesign';

// Minimal shape of React Navigation's BottomTabBarProps that we consume.
// (Avoids a type-only import that trips node16 module resolution in this repo.)
interface TabBarRoute {
  key: string;
  name: string;
}
interface TabBarPropsLite {
  state: {
    index: number;
    routes: TabBarRoute[];
  };
  descriptors: Record<string, { options: Record<string, any> }>;
  navigation: {
    emit: (args: { type: string; target: string; canPreventDefault?: boolean }) => {
      defaultPrevented?: boolean;
    };
    navigate: (name: string) => void;
  };
}

type IconKey = 'home' | 'shifts' | 'manage' | 'team' | 'you';

const ICONS: Record<IconKey, string> = {
  home: 'M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 H14 V14 H10 V21 H4 a1 1 0 0 1 -1 -1 Z',
  shifts: 'M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7',
  manage: 'M4 7 H20 M4 12 H20 M4 17 H14',
  team: 'M9 11 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6 M17 13 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 0 0 0 5 M3 20 c0 -3 3 -5 6 -5 s6 2 6 5 M14 20 c0 -2.5 2 -4 4 -4 s3 1.5 3 4',
  you: 'M12 12 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M4 21 c0 -4 4 -7 8 -7 s8 3 8 7',
};

// Map React Navigation screen names → our icon keys + labels
const ROUTE_CONFIG: Record<string, { icon: IconKey; label: string }> = {
  Home: { icon: 'home', label: 'Home' },
  Calendar: { icon: 'shifts', label: 'Shifts' },
  Manage: { icon: 'manage', label: 'Manage' },
  Team: { icon: 'team', label: 'Stats' },
  Profile: { icon: 'you', label: 'You' },
};

export const TabBarV2: React.FC<TabBarPropsLite> = ({ state, descriptors, navigation }) => {
  const theme = useRedesignTheme();
  const insets = useSafeAreaInsets();

  const barBg = theme.isDark
    ? 'rgba(12,12,14,0.92)'
    : 'rgba(246,245,241,0.94)';
  const borderColor = theme.colors.surface.hairline;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: barBg,
          borderTopColor: borderColor,
          paddingBottom: Math.max(12, insets.bottom),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const config = ROUTE_CONFIG[route.name] ?? { icon: 'home' as IconKey, label: route.name };
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        const color = isFocused ? theme.colors.accent : theme.colors.text.tertiary;
        const label = (options.tabBarLabel as string) || config.label;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID ?? `tab-${route.name}`}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.item}
            hitSlop={4}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d={ICONS[config.icon]}
                stroke={color}
                strokeWidth={isFocused ? 1.8 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 4,
                fontFamily: theme.fonts.mono,
                fontSize: 9,
                color,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                fontWeight: isFocused ? '500' : '400',
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TabBarV2;
