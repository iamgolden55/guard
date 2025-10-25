/**
 * ShiftFilterTabs Component
 * Tab filter for shift status (All, Upcoming, Completed)
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Body } from '@components/ui';
import { colors, spacing, layout } from '../../../theme';

export type ShiftFilter = 'all' | 'upcoming' | 'completed';

interface ShiftFilterTabsProps {
  activeFilter: ShiftFilter;
  onFilterChange: (filter: ShiftFilter) => void;
  counts: {
    all: number;
    upcoming: number;
    completed: number;
  };
}

export const ShiftFilterTabs: React.FC<ShiftFilterTabsProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  const tabs: { id: ShiftFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        const count = counts[tab.id];

        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onFilterChange(tab.id)}
            activeOpacity={0.7}
          >
            <Body
              style={[
                styles.tabText,
                isActive && styles.tabTextActive,
              ]}
            >
              {tab.label} ({count})
            </Body>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: layout.borderRadius.base,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.borderRadius.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.white,
    ...layout.shadow.sm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
  },
});
