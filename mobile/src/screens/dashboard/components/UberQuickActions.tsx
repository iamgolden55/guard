/**
 * UberQuickActions
 * Uber-style quick action buttons in a clean grid layout
 * Features: Do Checks, Report Incident, View Shifts, Virtual ID
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { uberColors, uberShadows, uberRadius, spacing } from '../../../theme';

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}

interface UberQuickActionsProps {
  onDoChecks: () => void;
  onReportIncident: () => void;
  onViewShifts: () => void;
  onViewVirtualID: () => void;
  hasActiveShift?: boolean;
}

export const UberQuickActions: React.FC<UberQuickActionsProps> = ({
  onDoChecks,
  onReportIncident,
  onViewShifts,
  onViewVirtualID,
  hasActiveShift = false,
}) => {
  const actions: QuickAction[] = [
    {
      id: 'checks',
      label: 'Do Checks',
      icon: 'checkbox-outline',
      onPress: onDoChecks,
      disabled: !hasActiveShift,
    },
    {
      id: 'incident',
      label: 'Incident',
      icon: 'warning-outline',
      onPress: onReportIncident,
    },
    {
      id: 'shifts',
      label: 'Shifts',
      icon: 'calendar-outline',
      onPress: onViewShifts,
    },
    {
      id: 'virtualid',
      label: 'Virtual ID',
      icon: 'id-card-outline',
      onPress: onViewVirtualID,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.actionButton, action.disabled && styles.actionButtonDisabled]}
            onPress={action.onPress}
            disabled={action.disabled}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, action.disabled && styles.iconContainerDisabled]}>
              <Ionicons
                name={action.icon}
                size={24}
                color={action.disabled ? uberColors.disabledText : uberColors.primary}
              />
            </View>
            <Text style={[styles.actionLabel, action.disabled && styles.actionLabelDisabled]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: uberColors.text.primary,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionButton: {
    width: '47%',
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius.xl,
    padding: spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: uberColors.border.light,
    ...uberShadows.soft,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: uberColors.background.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  iconContainerDisabled: {
    backgroundColor: uberColors.disabled,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: uberColors.text.primary,
    textAlign: 'center',
  },
  actionLabelDisabled: {
    color: uberColors.disabledText,
  },
});

export default UberQuickActions;
