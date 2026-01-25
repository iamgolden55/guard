/**
 * UberEmptyState - Empty state with floating calendar animation
 * Used when no shifts are scheduled for selected date
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { uberColors, uberRadius, uberSpacing } from '../../../../theme/uberTheme';

interface UberEmptyStateProps {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const UberEmptyState: React.FC<UberEmptyStateProps> = ({
  title = 'No shifts scheduled',
  subtitle = 'Your shifts for this day will appear here',
  actionLabel = 'Browse Open Shifts',
  onAction,
}) => {
  // Floating animation
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-10, {
          duration: 2000,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        }),
        withTiming(0, {
          duration: 2000,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        })
      ),
      -1,
      true
    );
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
        <Ionicons
          name="calendar-outline"
          size={48}
          color={uberColors.text.muted}
        />
      </Animated.View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {onAction && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: uberSpacing['2xl'],
    paddingVertical: uberSpacing['3xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: uberRadius['2xl'],
    backgroundColor: uberColors.background.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uberSpacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: uberColors.text.primary,
    marginBottom: uberSpacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: uberColors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: uberSpacing.xl,
  },
  actionButton: {
    backgroundColor: uberColors.primary,
    paddingHorizontal: uberSpacing.xl,
    paddingVertical: uberSpacing.md,
    borderRadius: uberRadius.full,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: uberColors.text.inverse,
  },
});
