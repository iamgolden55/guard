/**
 * WiseQuickActions Component
 * Wise-inspired feature list with circular blue icons (48px)
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall } from '@components/ui';
import { colors, spacing } from '../../../theme';

interface ActionItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

interface WiseQuickActionsProps {
  onReportIncident: () => void;
  onDoChecks: () => void;
  onViewShifts: () => void;
  onViewVirtualID: () => void;
}

export const WiseQuickActions: React.FC<WiseQuickActionsProps> = ({
  onReportIncident,
  onDoChecks,
  onViewShifts,
  onViewVirtualID,
}) => {
  const actions: ActionItem[] = [
    {
      icon: 'alert-circle',
      title: 'Report Incident',
      description: 'Document any incidents or issues during your shift',
      onPress: onReportIncident,
    },
    {
      icon: 'clipboard',
      title: 'Venue Checks',
      description: 'Complete required safety and security checks',
      onPress: onDoChecks,
    },
    {
      icon: 'calendar',
      title: 'View Shifts',
      description: 'See your upcoming schedule and shift history',
      onPress: onViewShifts,
    },
    {
      icon: 'card',
      title: 'Virtual ID',
      description: 'Access your digital security identification card',
      onPress: onViewVirtualID,
    },
  ];

  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={action.title}
          style={styles.actionItem}
          onPress={action.onPress}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Ionicons name={action.icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.actionContent}>
            <Body style={styles.actionTitle}>{action.title}</Body>
            <BodySmall color={colors.text.secondary} style={styles.actionDescription}>
              {action.description}
            </BodySmall>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.base,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: 12,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
