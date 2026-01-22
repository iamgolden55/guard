/**
 * UberInfoRow - Reusable info display row for detail screens
 * Displays icon, label, and value with consistent styling
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { uberColors, uberSpacing } from '../../../../theme/uberTheme';

interface UberInfoRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  secondaryValue?: string;
  showBorder?: boolean;
}

export const UberInfoRow: React.FC<UberInfoRowProps> = ({
  icon,
  label,
  value,
  secondaryValue,
  showBorder = true,
}) => {
  return (
    <View style={[styles.container, showBorder && styles.containerBorder]}>
      {icon && (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color={uberColors.text.muted} />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        {secondaryValue && (
          <Text style={styles.secondaryValue}>{secondaryValue}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: uberSpacing.base,
    paddingHorizontal: uberSpacing.base,
  },
  containerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: uberColors.border.light,
  },
  iconContainer: {
    width: 32,
    marginRight: uberSpacing.md,
    paddingTop: 2,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: uberColors.text.muted,
    marginBottom: uberSpacing.xs,
  },
  value: {
    fontSize: 14,
    fontWeight: '400',
    color: uberColors.text.primary,
    lineHeight: 20,
  },
  secondaryValue: {
    fontSize: 14,
    fontWeight: '400',
    color: uberColors.text.secondary,
    marginTop: 2,
  },
});
