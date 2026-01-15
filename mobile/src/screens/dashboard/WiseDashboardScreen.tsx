/**
 * WiseDashboardScreen
 * Wise-inspired clean minimal dashboard with 3D flip card and bold typography
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading1, Body, BodySmall, Caption } from '@components/ui';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { selectCurrentUser } from '../../store/slices/authSlice';
import {
  selectActiveShift,
  selectUpcomingShifts,
  fetchShifts,
  startBreak,
  endBreak,
  type Shift,
} from '../../store/slices/shiftsSlice';
import { HeroStatusCard, StatsRow, WiseQuickActions, UpcomingShiftCard } from './components';
import { colors, spacing } from '../../theme';
import { logger } from '../../utils/logger';
import { apiService, ApiTimeoutError, NetworkError, ApiError } from '../../services/api';
import { shiftChecksService } from '../../services/shiftChecksService';
import { ERROR_MESSAGES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

export const WiseDashboardScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAppSelector(selectCurrentUser);
  const activeShift = useAppSelector(selectActiveShift);
  const upcomingShifts = useAppSelector(selectUpcomingShifts);
  const [shiftChecks, setShiftChecks] = useState<{
    fireExitChecks: any[];
    capacityChecks: any[];
    toiletChecks: any[];
  } | null>(null);

  // Get the next upcoming shift for display on the flip card
  const nextUpcomingShift = upcomingShifts.length > 0 ? upcomingShifts[0] : null;

  // DEBUG: Log user object to diagnose first_name issue
  React.useEffect(() => {
    logger.info('[WiseDashboard] User object:', JSON.stringify(user, null, 2));
    logger.info('[WiseDashboard] first_name:', user?.first_name);
    logger.info('[WiseDashboard] username:', user?.username);
  }, [user]);

  // Fetch shifts when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      logger.info('[WiseDashboard] Screen focused');

      const timer = setTimeout(async () => {
        logger.info('[WiseDashboard] Fetching shifts from backend');
        try {
          await dispatch(fetchShifts()).unwrap();
        } catch (error: any) {
          logger.error('[WiseDashboard] Error fetching shifts:', error);

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
          }
        }
      }, 500);

      return () => clearTimeout(timer);
    }, [dispatch])
  );

  // Fetch shift checks when active shift changes or screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const fetchChecks = async () => {
        if (activeShift?.id) {
          logger.info('[WiseDashboard] Fetching checks for active shift', { shiftId: activeShift.id });
          try {
            const checks = await shiftChecksService.getShiftChecks(activeShift.id);
            setShiftChecks(checks);
            logger.info('[WiseDashboard] Checks fetched', {
              fireExit: checks.fireExitChecks.length,
              capacity: checks.capacityChecks.length,
              toilet: checks.toiletChecks.length,
            });
          } catch (error) {
            logger.error('[WiseDashboard] Error fetching checks:', error);
            setShiftChecks(null);
          }
        } else {
          setShiftChecks(null);
        }
      };

      fetchChecks();
    }, [activeShift?.id])
  );

  // Calculate stats
  const stats = useMemo(() => {
    const hoursToday = activeShift?.check_in_time
      ? Math.floor(
          (new Date().getTime() - new Date(activeShift.check_in_time).getTime()) / (1000 * 60 * 60)
        )
      : 0;

    // Count completed checks from all check types
    const checksCompleted =
      (shiftChecks?.fireExitChecks?.length || 0) +
      (shiftChecks?.capacityChecks?.length || 0) +
      (shiftChecks?.toiletChecks?.length || 0);

    const shiftsThisWeek = upcomingShifts.length + (activeShift ? 1 : 0);

    return {
      hoursToday,
      checksCompleted,
      shiftsThisWeek,
    };
  }, [activeShift, upcomingShifts, shiftChecks]);

  // Handlers
  const handleCardPress = () => {
    if (activeShift) {
      navigation.navigate('ShiftDetails', { shift: activeShift });
    }
  };

  const handleReportIncident = () => {
    logger.info('[WiseDashboard] Navigating to IncidentReport');
    navigation.navigate('IncidentReport', { shiftId: activeShift?.id });
  };

  const handleDoChecks = () => {
    logger.info('Do checks tapped from quick actions');

    if (!activeShift) {
      Alert.alert(
        'No Active Shift',
        'You need an active shift to perform venue checks. Please check in to a shift first.'
      );
      return;
    }

    navigation.navigate('ShiftChecks', { shiftId: activeShift.id });
  };

  const handleViewShifts = () => {
    logger.info('[WiseDashboard] Navigating to Calendar tab');
    navigation.navigate('Tabs', { screen: 'Calendar' });
  };

  const handleViewVirtualID = () => {
    logger.info('[WiseDashboard] Navigating to VirtualID');
    navigation.navigate('VirtualID');
  };

  const handleShiftPress = (shift: Shift) => {
    logger.info('[WiseDashboard] Navigating to ShiftDetails', { shiftId: shift.id });
    navigation.navigate('ShiftDetails', { shift });
  };

  const handleEndShift = () => {
    if (activeShift) {
      logger.info('[WiseDashboard] End shift pressed, navigating to ShiftDetails for checkout');
      navigation.navigate('ShiftDetails', { shift: activeShift });
    }
  };

  const handleStartShift = () => {
    if (nextUpcomingShift) {
      logger.info('[WiseDashboard] Start shift pressed, navigating to ShiftDetails for check-in');
      navigation.navigate('ShiftDetails', { shift: nextUpcomingShift });
    }
  };

  return (
    <Container scrollable={false} safeArea={false} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bold Heading */}
        <View style={styles.header}>
          <Heading1 style={styles.mainHeading}>
            HELLO{'\n'}{(user?.first_name || user?.username || 'THERE').toUpperCase()}!
          </Heading1>
          <Body color={colors.text.secondary} style={styles.subtitle}>
            {activeShift ? 'Manage your active shift and tasks' : 'Ready for your next shift'}
          </Body>
        </View>

        {/* Hero Status Card with 3D Flip */}
        <View style={styles.heroSection}>
          <HeroStatusCard
            activeShift={activeShift}
            upcomingShift={nextUpcomingShift}
            onPress={handleCardPress}
          />

          {/* Action Buttons Below Card */}
          {activeShift && (
            <TouchableOpacity
              style={styles.endShiftButton}
              onPress={handleEndShift}
              activeOpacity={0.8}
            >
              <View style={styles.endShiftIconCircle}>
                <Ionicons name="log-out-outline" size={24} color="#D32F2F" />
              </View>
              <View style={styles.buttonTextContainer}>
                <BodySmall style={styles.endShiftTitle}>End Shift</BodySmall>
                <Caption style={styles.endShiftSubtitle}>Complete checkout with photo</Caption>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}

          {!activeShift && nextUpcomingShift && (
            <TouchableOpacity
              style={styles.startShiftButton}
              onPress={handleStartShift}
              activeOpacity={0.8}
            >
              <View style={styles.startShiftIconCircle}>
                <Ionicons name="log-in-outline" size={24} color="#1E88E5" />
              </View>
              <View style={styles.buttonTextContainer}>
                <BodySmall style={styles.startShiftTitle}>Check In</BodySmall>
                <Caption style={styles.startShiftSubtitle}>Start your shift at {nextUpcomingShift.venue?.name}</Caption>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Row with Count-up Animation */}
        <StatsRow
          hoursToday={stats.hoursToday}
          checksCompleted={stats.checksCompleted}
          shiftsThisWeek={stats.shiftsThisWeek}
        />

        {/* Quick Actions - Wise Style */}
        <View style={styles.section}>
          <WiseQuickActions
            onReportIncident={handleReportIncident}
            onDoChecks={handleDoChecks}
            onViewShifts={handleViewShifts}
            onViewVirtualID={handleViewVirtualID}
          />
        </View>

        {/* Upcoming Shifts Section (if any) */}
        {upcomingShifts.length > 0 && (
          <View style={styles.section}>
            <Heading1 style={styles.sectionHeading}>
              UPCOMING{'\n'}SHIFTS
            </Heading1>
            <View style={styles.upcomingList}>
              {upcomingShifts.slice(0, 3).map((shift) => (
                <UpcomingShiftCard
                  key={shift.id}
                  shift={shift}
                  onPress={() => handleShiftPress(shift)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['4xl'],
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  mainHeading: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.text.primary,
    lineHeight: 48,
    letterSpacing: -1,
    marginBottom: spacing.base,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  heroSection: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  // End Shift Button Styles
  endShiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.1)',
  },
  endShiftIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  endShiftTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D32F2F',
  },
  endShiftSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Start Shift Button Styles
  startShiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(30, 136, 229, 0.1)',
  },
  startShiftIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  startShiftTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E88E5',
  },
  startShiftSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  buttonTextContainer: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text.primary,
    lineHeight: 38,
    letterSpacing: -0.8,
    marginBottom: spacing.lg,
  },
  upcomingList: {
    gap: spacing.md,
  },
  bottomSpacer: {
    height: spacing['2xl'],
  },
});
