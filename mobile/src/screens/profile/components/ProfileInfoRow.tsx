/**
 * ProfileInfoRow Component
 * Single row of profile information (label + value)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Body, BodySmall } from '@components/ui';
import { colors, spacing } from '../../../theme';

interface ProfileInfoRowProps {
  label: string;
  value: string;
  isLast?: boolean;
}

export const ProfileInfoRow: React.FC<ProfileInfoRowProps> = ({
  label,
  value,
  isLast = false,
}) => {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <BodySmall color={colors.text.secondary} style={styles.label}>
        {label}
      </BodySmall>
      <Body style={styles.value}>{value}</Body>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  label: {
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  value: {
    fontSize: 15,
  },
});
