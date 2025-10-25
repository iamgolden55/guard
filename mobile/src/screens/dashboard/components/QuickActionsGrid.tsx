/**
 * QuickActionsGrid Component
 * Grid of quick action buttons for common tasks
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Body } from '@components/ui';
import { colors, spacing, layout } from '../../../theme';

interface QuickAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
}

interface QuickActionsGridProps {
  onReportIncident: () => void;
  onDoChecks: () => void;
  onViewShifts: () => void;
  onViewVirtualID: () => void;
}

export const QuickActionsGrid: React.FC<QuickActionsGridProps> = ({
  onReportIncident,
  onDoChecks,
  onViewShifts,
  onViewVirtualID,
}) => {
  const actions: QuickAction[] = [
    {
      id: 'report',
      title: 'Report Incident',
      icon: <Ionicons name="warning-outline" size={32} color={colors.error} />,
      onPress: onReportIncident,
    },
    {
      id: 'checks',
      title: 'Do Checks',
      icon: (
        <MaterialCommunityIcons
          name="clipboard-check-outline"
          size={32}
          color={colors.success}
        />
      ),
      onPress: onDoChecks,
    },
    {
      id: 'shifts',
      title: 'My Shifts',
      icon: <Ionicons name="calendar-outline" size={32} color={colors.primary} />,
      onPress: onViewShifts,
    },
    {
      id: 'virtualid',
      title: 'Virtual ID',
      icon: <Ionicons name="card-outline" size={32} color={colors.info} />,
      onPress: onViewVirtualID,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>{action.icon}</View>
            <Body style={styles.actionText}>{action.title}</Body>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Margin handled by parent section - removed marginBottom to fix overlap
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md, // Add margin to grid itself for proper spacing
  },
  actionCard: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '48%',
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.borderWidth.thin,
    borderColor: colors.border.light,
    ...layout.shadow.sm,
  },
  iconContainer: {
    marginBottom: spacing.sm,
  },
  actionText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
});
