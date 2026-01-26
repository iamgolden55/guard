/**
 * TeamSectionHeader Component
 * Microsoft Teams-style section header for grouped lists
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodySmall } from '@components/ui';
import { getTeamsColors } from '../../../theme/teamsColors';
import { spacing } from '../../../theme';

export interface TeamSectionHeaderProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isDark?: boolean;
}

export const TeamSectionHeader: React.FC<TeamSectionHeaderProps> = ({
  title,
  icon,
  count,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  isDark = false,
}) => {
  const teamsColors = getTeamsColors(isDark);
  const handlePress = () => {
    if (collapsible && onToggleCollapse) {
      onToggleCollapse();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: teamsColors.background.secondary, borderBottomColor: teamsColors.border.light }]}
      onPress={handlePress}
      disabled={!collapsible}
      activeOpacity={collapsible ? 0.6 : 1}
    >
      <View style={styles.content}>
        {/* Section Icon */}
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={teamsColors.text.secondary}
            style={styles.icon}
          />
        )}

        {/* Section Title */}
        <BodySmall
          style={[styles.title, { color: teamsColors.text.secondary }]}
        >
          {title.toUpperCase()}
        </BodySmall>

        {/* Member Count Badge */}
        {count !== undefined && (
          <View style={[styles.countBadge, { backgroundColor: teamsColors.background.tertiary }]}>
            <BodySmall
              style={[styles.countText, { color: teamsColors.text.tertiary }]}
            >
              {count}
            </BodySmall>
          </View>
        )}

        {/* Collapse/Expand Chevron */}
        {collapsible && (
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-down'}
            size={16}
            color={teamsColors.text.secondary}
            style={styles.chevron}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.xs,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    flex: 1,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
