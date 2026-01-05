/**
 * Shift Checks Screen
 * Dashboard showing required venue safety checks for the active shift
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Heading3, Body, Card, Button } from '@components/ui';
import { useAppSelector } from '../../hooks/useRedux';
import { selectActiveShift } from '../../store/slices/shiftsSlice';
import { colors, spacing } from '../../theme';
import { logger } from '../../utils/logger';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { shiftChecksService } from '../../services/shiftChecksService';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'ShiftChecks'>;
type RouteProps = RouteProp<MainStackParamList, 'ShiftChecks'>;

interface CheckItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  required: boolean;
  completed: boolean;
  route: keyof MainStackParamList;
  color: string;
}

export const ShiftChecksScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId } = route.params;

  const activeShift = useAppSelector(selectActiveShift);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<CheckItem[]>([]);

  // Reload checks whenever screen comes into focus (including after navigation back)
  useFocusEffect(
    useCallback(() => {
      logger.info('[ShiftChecks] Screen focused, loading checks', { shiftId });
      loadChecks();
    }, [shiftId])
  );

  const loadChecks = async () => {
    try {
      setLoading(true);

      // Get shift checks from backend
      const shiftChecks = await shiftChecksService.getShiftChecks(shiftId);

      // Define available checks based on venue requirements
      const availableChecks: CheckItem[] = [];

      if (activeShift?.venue.requires_fire_exit_check) {
        availableChecks.push({
          id: 'fire_exit',
          title: 'Fire Exit Check',
          icon: 'flame-outline',
          required: true,
          completed: shiftChecks.fireExitChecks.length > 0,
          route: 'FireExitCheck' as keyof MainStackParamList,
          color: colors.error,
        });
      }

      if (activeShift?.venue.requires_capacity_check) {
        availableChecks.push({
          id: 'capacity',
          title: 'Capacity Check',
          icon: 'people-outline',
          required: true,
          completed: shiftChecks.capacityChecks.length > 0,
          route: 'CapacityCheck' as keyof MainStackParamList,
          color: colors.warning,
        });
      }

      // Toilet checks are always available (basic venue safety)
      availableChecks.push({
        id: 'toilet',
        title: 'Toilet Check',
        icon: 'water-outline',
        required: false,
        completed: shiftChecks.toiletChecks.length > 0,
        route: 'ToiletCheck' as keyof MainStackParamList,
        color: colors.info,
      });

      setChecks(availableChecks);
      logger.info('[ShiftChecks] Loaded checks', {
        totalChecks: availableChecks.length,
        completed: availableChecks.filter(c => c.completed).length,
      });
    } catch (error) {
      logger.error('[ShiftChecks] Error loading checks:', error);
      Alert.alert('Error', 'Failed to load shift checks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPress = (check: CheckItem) => {
    logger.info('[ShiftChecks] Check selected', { checkId: check.id });

    // Navigate to specific check screen
    navigation.navigate(check.route as any, {
      shiftId,
      checkType: check.id,
    });
  };

  const handleClose = () => {
    logger.info('[ShiftChecks] Closing screen');
    navigation.goBack();
  };

  // Calculate progress
  const completedCount = checks.filter(c => c.completed).length;
  const totalCount = checks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Container scrollable={false} safeArea style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Heading2>Shift Checks</Heading2>
          <Body color={colors.text.secondary}>
            {activeShift?.venue.name || 'Venue Safety Checks'}
          </Body>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Card */}
        <Card variant="elevated" padding="lg" style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Ionicons
              name="checkmark-circle"
              size={32}
              color={progressPercent === 100 ? colors.success : colors.gray[400]}
            />
            <View style={styles.progressText}>
              <Heading3>{completedCount} of {totalCount} Complete</Heading3>
              <Body color={colors.text.secondary}>
                {progressPercent === 100
                  ? 'All checks completed!'
                  : 'Complete all required checks'}
              </Body>
            </View>
          </View>
          {totalCount > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: progressPercent === 100 ? colors.success : colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Checks List */}
        <View style={styles.checksContainer}>
          {checks.length === 0 && !loading && (
            <Card variant="flat" padding="xl" style={styles.emptyState}>
              <Ionicons
                name="checkmark-done-outline"
                size={64}
                color={colors.gray[400]}
                style={styles.emptyIcon}
              />
              <Heading3 style={styles.emptyTitle}>No Checks Required</Heading3>
              <Body color={colors.text.secondary} style={styles.emptyText}>
                This venue doesn't require any safety checks
              </Body>
            </Card>
          )}

          {checks.map((check) => (
            <TouchableOpacity
              key={check.id}
              onPress={() => handleCheckPress(check)}
              activeOpacity={0.7}
            >
              <Card
                variant="elevated"
                padding="lg"
                style={[
                  styles.checkCard,
                  check.completed && styles.checkCardCompleted,
                ]}
              >
                <View style={styles.checkContent}>
                  <View
                    style={[
                      styles.checkIcon,
                      { backgroundColor: check.color + '20' },
                    ]}
                  >
                    <Ionicons
                      name={check.icon}
                      size={24}
                      color={check.color}
                    />
                  </View>
                  <View style={styles.checkInfo}>
                    <View style={styles.checkTitleRow}>
                      <Heading3 style={styles.checkTitle}>{check.title}</Heading3>
                      {check.required && (
                        <View style={styles.requiredBadge}>
                          <Body style={styles.requiredText}>Required</Body>
                        </View>
                      )}
                    </View>
                    <Body color={colors.text.secondary}>
                      {check.completed ? 'Completed' : 'Not completed yet'}
                    </Body>
                  </View>
                  <View style={styles.checkAction}>
                    {check.completed ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={28}
                        color={colors.success}
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={24}
                        color={colors.gray[400]}
                      />
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Card */}
        <Card variant="flat" padding="lg" style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.primary}
            />
            <Body style={styles.infoTitle}>About Safety Checks</Body>
          </View>
          <Body color={colors.text.secondary} style={styles.infoText}>
            Safety checks help ensure the venue meets security standards. Complete all
            required checks during your shift. You can update checks at any time.
          </Body>
        </Card>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  progressCard: {
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  progressBarContainer: {
    marginTop: spacing.sm,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  checksContainer: {
    marginBottom: spacing.lg,
  },
  checkCard: {
    marginBottom: spacing.md,
  },
  checkCardCompleted: {
    borderWidth: 1,
    borderColor: colors.success,
  },
  checkContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  checkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  checkTitle: {
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: colors.error + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  requiredText: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '600',
  },
  checkAction: {
    marginLeft: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyIcon: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: colors.primary + '10',
    marginBottom: spacing.xl,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoTitle: {
    marginLeft: spacing.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  infoText: {
    lineHeight: 20,
  },
});
