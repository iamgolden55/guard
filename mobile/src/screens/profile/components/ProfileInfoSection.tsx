/**
 * ProfileInfoSection Component
 * Section wrapper for profile information groups
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Heading3, Card } from '@components/ui';
import { colors, spacing } from '../../../theme';

interface ProfileInfoSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  children: React.ReactNode;
}

export const ProfileInfoSection: React.FC<ProfileInfoSectionProps> = ({
  title,
  icon,
  iconColor = colors.primary,
  children,
}) => {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <Heading3 style={styles.title}>{title}</Heading3>
      </View>

      {/* Section Content */}
      <Card variant="flat" padding="lg">
        {children}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
  },
});
