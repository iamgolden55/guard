/**
 * WiseDashboardScreen
 * Wise-inspired clean minimal dashboard with 3D flip card and bold typography
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Container, Heading1, Body } from '@components/ui';
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
import { ERROR_MESSAGES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

export const WiseDashboardScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAppSelector(selectCurrentUser);
  const activeShift = useAppSelector(selectActiveShift);
  const upcomingShifts = useAppSelector(selectUpcomingShifts);

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

  // Calculate stats
  const stats = useMemo(() => {
    const hoursToday = activeShift?.check_in_time
      ? Math.floor(
          (new Date().getTime() - new Date(activeShift.check_in_time).getTime()) / (1000 * 60 * 60)
        )
      : 0;

    const checksCompleted = 0; // TODO: Get from checks API
    const shiftsThisWeek = upcomingShifts.length + (activeShift ? 1 : 0);

    return {
      hoursToday,
      checksCompleted,
      shiftsThisWeek,
    };
  }, [activeShift, upcomingShifts]);

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
          <HeroStatusCard activeShift={activeShift} onPress={handleCardPress} />
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
