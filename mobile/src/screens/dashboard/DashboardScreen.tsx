/**
 * Dashboard Screen
 * Clean Dropbox-inspired design with design system components
 */

import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading1, Heading2, Heading3, Body, Card } from '@components/ui';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { selectCurrentUser } from '../../store/slices/authSlice';
import {
  selectActiveShift,
  selectUpcomingShifts,
  selectPastScheduledShifts,
  fetchShifts,
  startBreak,
  endBreak,
  Shift,
} from '../../store/slices/shiftsSlice';
import { ActiveShiftCard, QuickActionsGrid, UpcomingShiftCard } from './components';
import { colors, spacing, textStyles, getColors } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../utils/logger';
import { apiService, ApiTimeoutError, NetworkError, ApiError } from '../../services/api';
import { ERROR_MESSAGES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

export const DashboardScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAppSelector(selectCurrentUser);
  const activeShift = useAppSelector(selectActiveShift);
  const upcomingShifts = useAppSelector(selectUpcomingShifts);
  const pastScheduledShifts = useAppSelector(selectPastScheduledShifts);
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);

  // Filter overdue shifts to only those that can still be checked into (haven't ended yet)
  const overdueShifts = pastScheduledShifts.filter((shift: Shift) => {
    const endTime = new Date(shift.end_time);
    return endTime > new Date();
  });

  // Fetch shifts when screen comes into focus
  // Using useFocusEffect instead of useEffect to prevent race conditions
  // when navigating back from check-in/check-out
  useFocusEffect(
    React.useCallback(() => {
      logger.info('[Dashboard] Screen focused');

      // Small delay to allow backend to propagate status changes
      // before refetching (prevents race condition where check-out state is overwritten)
      const timer = setTimeout(async () => {
        logger.info('[Dashboard] Fetching shifts from backend');
        try {
          await dispatch(fetchShifts()).unwrap();
        } catch (error: any) {
          // Handle errors and show user-friendly alerts
          logger.error('[Dashboard] Error fetching shifts:', error);

          if (error instanceof ApiTimeoutError) {
            Alert.alert(
              'Connection Timeout',
              ERROR_MESSAGES.TIMEOUT_ERROR + '\n\nYou may be viewing offline data.',
              [{ text: 'OK' }]
            );
          } else if (error instanceof NetworkError) {
            Alert.alert(
              'No Internet Connection',
              ERROR_MESSAGES.NETWORK_ERROR + '\n\nYou may be viewing offline data.',
              [{ text: 'OK' }]
            );
          } else if (error instanceof ApiError) {
            Alert.alert(
              'Server Error',
              `Unable to fetch shifts: ${error.statusText}\n\nYou may be viewing offline data.`,
              [{ text: 'OK' }]
            );
          } else {
            // Generic error (only show if it's a real error, not just fallback to local data)
            if (error && error.message && !error.message.includes('local')) {
              Alert.alert(
                'Error',
                'Unable to fetch shifts. You may be viewing offline data.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      }, 500);

      // Cleanup timer on unmount or when focus changes
      return () => clearTimeout(timer);
    }, [dispatch])
  );

  // Handlers
  const handleCheckOut = () => {
    logger.info('[Dashboard] Navigating to ShiftDetails for check-out');
    if (!activeShift) {
      Alert.alert('Error', 'No active shift found');
      return;
    }
    navigation.navigate('ShiftDetails', { shift: activeShift });
  };

  const handleTakeBreak = async () => {
    if (!activeShift) {
      Alert.alert('Error', 'No active shift found');
      return;
    }

    const isOnBreak = activeShift.break_start_time && !activeShift.break_end_time;

    if (isOnBreak) {
      // End break
      Alert.alert(
        'End Break',
        'Are you ready to end your break and resume your shift?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Break',
            onPress: async () => {
              try {
                logger.info('[Dashboard] Ending break for shift:', activeShift.id);

                // Calculate break duration in minutes
                const breakStartTime = activeShift.break_start_time
                  ? new Date(activeShift.break_start_time)
                  : new Date();
                const breakEndTime = new Date();
                const breakDurationMinutes = Math.round(
                  (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60)
                );

                // Call backend API with break_duration
                try {
                  await apiService.patch(`/api/v1/shifts/${activeShift.id}/`, {
                    break_duration: breakDurationMinutes,
                  });

                  logger.info('[Dashboard] Break ended successfully (synced to backend)', {
                    breakDurationMinutes,
                  });

                  // Dispatch Redux action with synced status
                  dispatch(
                    endBreak({
                      shiftId: activeShift.id,
                      syncStatus: 'synced',
                    })
                  );

                  Alert.alert('Break Ended', 'Welcome back! Your break has ended.');
                } catch (apiError) {
                  logger.warn('[Dashboard] Failed to sync break end to backend:', apiError);

                  // Offline fallback - save locally
                  dispatch(
                    endBreak({
                      shiftId: activeShift.id,
                      syncStatus: 'pending',
                    })
                  );

                  Alert.alert(
                    'Break Ended (Offline)',
                    'Your break has ended but will sync to the server when you have internet connection.'
                  );
                }
              } catch (error) {
                logger.error('[Dashboard] Error ending break:', error);
                Alert.alert('Error', 'Failed to end break. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      // Start break
      Alert.alert(
        'Take a Break',
        'Ready to take a break? You can end it anytime from this screen.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Break',
            onPress: async () => {
              try {
                logger.info('[Dashboard] Starting break for shift:', activeShift.id);

                // Break start is tracked locally only - duration will be sent to backend when break ends
                // This avoids sending break_start_time which doesn't exist in the backend model
                dispatch(
                  startBreak({
                    shiftId: activeShift.id,
                    syncStatus: 'synced', // Not actually synced to backend yet, but no need to sync start time
                  })
                );

                logger.info('[Dashboard] Break started (tracking locally)');
                Alert.alert('Break Started', 'Enjoy your break! Tap "End Break" when ready to resume.');
              } catch (error) {
                logger.error('[Dashboard] Error starting break:', error);
                Alert.alert('Error', 'Failed to start break. Please try again.');
              }
            },
          },
        ]
      );
    }
  };

  const handleReportIncident = () => {
    logger.info('[Dashboard] Navigating to IncidentReport');
    navigation.navigate('IncidentReport', { shiftId: activeShift?.id });
  };

  const handleDoChecks = () => {
    logger.info('Do checks tapped from quick actions');

    // Check if user has an active shift
    if (!activeShift) {
      Alert.alert(
        'No Active Shift',
        'You need an active shift to perform venue checks. Please check in to a shift first.'
      );
      return;
    }

    // Navigate to shift checks screen
    navigation.navigate('ShiftChecks', { shiftId: activeShift.id });
  };

  const handleViewShifts = () => {
    logger.info('[Dashboard] Navigating to Calendar tab');
    navigation.navigate('Tabs', { screen: 'Calendar' });
  };

  const handleViewVirtualID = () => {
    logger.info('[Dashboard] Navigating to VirtualID');
    navigation.navigate('VirtualID');
  };

  const handleShiftPress = (shift: Shift) => {
    logger.info('[Dashboard] Navigating to ShiftDetails', { shiftId: shift.id });
    navigation.navigate('ShiftDetails', { shift });
  };

  return (
    <Container scrollable safeArea={false} style={{ padding: 0, backgroundColor: themeColors.background.primary }}>
      {/* Header with greeting */}
      <View style={styles.header}>
        <View style={styles.greetingContainer}>
          <Heading1 style={[styles.greeting, { color: themeColors.text.primary }]}>Hello, {user?.first_name || 'there'}! 👋</Heading1>
          <Body color={themeColors.text.secondary}>
            {activeShift ? 'You have an active shift' : 'Ready for your next shift'}
          </Body>
        </View>
      </View>

      {/* Active Shift Section */}
      <View style={styles.activeShiftSection}>
        {activeShift ? (
          <ActiveShiftCard
            shift={activeShift}
            onCheckOut={handleCheckOut}
            onTakeBreak={handleTakeBreak}
          />
        ) : (
          <Card variant="flat" padding="xl" style={styles.noActiveShiftCard}>
            <Ionicons name="calendar-outline" size={48} color={themeColors.gray[400]} style={styles.noActiveShiftIcon} />
            <Heading3 style={[styles.noActiveShiftText, { color: themeColors.text.primary }]}>No active shift</Heading3>
            <Body color={themeColors.text.secondary}>Your next shift will appear here</Body>
          </Card>
        )}
      </View>

      {/* Quick Actions Section */}
      <View style={styles.section}>
        <Heading2 style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Quick Actions</Heading2>
        <QuickActionsGrid
          onReportIncident={handleReportIncident}
          onDoChecks={handleDoChecks}
          onViewShifts={handleViewShifts}
          onViewVirtualID={handleViewVirtualID}
        />
      </View>

      {/* Overdue Shifts Section - Check In Required */}
      {overdueShifts.length > 0 && (
        <View style={[styles.section, styles.upcomingShiftsSection]}>
          <Heading2 style={[styles.sectionTitle, { color: themeColors.error }]}>
            Check In Required ({overdueShifts.length})
          </Heading2>
          {overdueShifts.map((shift: Shift) => (
            <UpcomingShiftCard
              key={shift.id}
              shift={shift}
              onPress={() => handleShiftPress(shift)}
              isOverdue={true}
            />
          ))}
        </View>
      )}

      {/* Upcoming Shifts Section */}
      <View style={[styles.section, overdueShifts.length === 0 && styles.upcomingShiftsSection]}>
        <Heading2 style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Upcoming Shifts ({upcomingShifts.length})
        </Heading2>
        {upcomingShifts.length > 0 ? (
          upcomingShifts.slice(0, 3).map((shift: Shift) => (
            <UpcomingShiftCard
              key={shift.id}
              shift={shift}
              onPress={() => handleShiftPress(shift)}
            />
          ))
        ) : (
          <Card variant="flat" padding="lg" style={styles.emptyState}>
            <Body color={themeColors.text.secondary} style={styles.emptyStateText}>
              No upcoming shifts
            </Body>
          </Card>
        )}
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    marginBottom: spacing.xs,
  },
  activeShiftSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  noActiveShiftCard: {
    alignItems: 'center',
  },
  noActiveShiftIcon: {
    marginBottom: spacing.md,
  },
  noActiveShiftText: {
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  upcomingShiftsSection: {
    marginTop: 120, // Fixed large spacing to clear wrapped Quick Actions grid (2 rows)
  },
  sectionTitle: {
    marginBottom: spacing.base,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
