/**
 * UberDashboardScreen
 * Uber-inspired minimalist dashboard with map header, check-in/out cards, and stats
 * Clean black/white design with subtle shadows and modern typography
 * Supports dark mode
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { useTheme } from '../../hooks/useTheme';
import { selectCurrentUser } from '../../store/slices/authSlice';
import {
  selectActiveShift,
  selectUpcomingShifts,
  selectPastScheduledShifts,
  fetchShifts,
  type Shift,
} from '../../store/slices/shiftsSlice';
import { MapHeader, CheckActionCard, OverviewStats, UberQuickActions, UberUpcomingShifts, LiveShiftTimer } from './components';
import { getUberColors, spacing } from '../../theme';
import { logger } from '../../utils/logger';
import { ApiTimeoutError, NetworkError, ApiError } from '../../services/api';
import { shiftChecksService } from '../../services/shiftChecksService';
import { ERROR_MESSAGES } from '../../utils/constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

// Format time for display (e.g., "08:45 AM")
const formatTime = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const UberDashboardScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);

  const user = useAppSelector(selectCurrentUser);
  const activeShift = useAppSelector(selectActiveShift);
  const upcomingShifts = useAppSelector(selectUpcomingShifts);
  const pastScheduledShifts = useAppSelector(selectPastScheduledShifts);
  const [shiftChecks, setShiftChecks] = useState<{
    fireExitChecks: any[];
    capacityChecks: any[];
    toiletChecks: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Track network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      logger.info('[UberDashboard] Network status changed', { isOffline: offline });
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  // Filter overdue shifts (start_time passed but end_time hasn't - can still check in)
  const overdueShifts = pastScheduledShifts.filter((shift: Shift) => {
    const endTime = new Date(shift.end_time);
    return endTime > new Date();
  });

  // Get the next shift for check-in (prioritize overdue shifts)
  const nextOverdueShift = overdueShifts.length > 0 ? overdueShifts[0] : null;
  const nextUpcomingShift = upcomingShifts.length > 0 ? upcomingShifts[0] : null;

  // Use overdue shift if available, otherwise use upcoming shift
  const shiftForCheckIn = nextOverdueShift || nextUpcomingShift;

  // Fetch shifts when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      logger.info('[UberDashboard] Screen focused');

      const timer = setTimeout(async () => {
        logger.info('[UberDashboard] Fetching shifts from backend');
        try {
          await dispatch(fetchShifts()).unwrap();
        } catch (error: any) {
          logger.error('[UberDashboard] Error fetching shifts:', error);

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

  // Fetch shift checks when active shift changes
  useFocusEffect(
    React.useCallback(() => {
      const fetchChecks = async () => {
        if (activeShift?.id) {
          logger.info('[UberDashboard] Fetching checks for active shift', { shiftId: activeShift.id });
          try {
            const checks = await shiftChecksService.getShiftChecks(activeShift.id);
            setShiftChecks(checks);
          } catch (error) {
            logger.error('[UberDashboard] Error fetching checks:', error);
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

  // Determine check-in card state
  const getCheckInStatus = (): 'active' | 'disabled' | 'completed' | 'overdue' => {
    if (activeShift?.check_in_time) return 'completed';
    if (nextOverdueShift) return 'overdue';
    if (nextUpcomingShift) return 'active';
    return 'disabled';
  };

  // Determine check-out card state
  const getCheckOutStatus = (): 'active' | 'disabled' | 'completed' => {
    if (activeShift?.check_out_time) return 'completed';
    if (activeShift?.check_in_time) return 'active';
    return 'disabled';
  };

  // Handle check-in press
  const handleCheckIn = () => {
    if (shiftForCheckIn) {
      logger.info('[UberDashboard] Check-in pressed, navigating to ShiftDetails', {
        isOverdue: !!nextOverdueShift,
        shiftId: shiftForCheckIn.id,
      });
      navigation.navigate('ShiftDetails', { shift: shiftForCheckIn });
    } else if (activeShift) {
      navigation.navigate('ShiftDetails', { shift: activeShift });
    }
  };

  // Handle check-out press
  const handleCheckOut = () => {
    if (activeShift) {
      logger.info('[UberDashboard] Check-out pressed, navigating to ShiftDetails');
      navigation.navigate('ShiftDetails', { shift: activeShift });
    }
  };

  // Handle quick actions
  const handleDoChecks = () => {
    logger.info('[UberDashboard] Do checks tapped');
    if (!activeShift) {
      Alert.alert(
        'No Active Shift',
        'You need an active shift to perform venue checks. Please check in to a shift first.'
      );
      return;
    }
    navigation.navigate('ShiftChecks', { shiftId: activeShift.id });
  };

  const handleReportIncident = () => {
    if (!activeShift) {
      Alert.alert(
        'No Active Shift',
        'You need an active shift to report an incident. Please check in to a shift first.'
      );
      return;
    }
    logger.info('[UberDashboard] Report incident tapped');
    navigation.navigate('IncidentReport', {
      shiftId: activeShift.id,
      venueId: activeShift.venue.id,
    });
  };

  const handleViewShifts = () => {
    logger.info('[UberDashboard] View shifts tapped');
    navigation.navigate('Tabs', { screen: 'Calendar' });
  };

  const handleViewVirtualID = () => {
    logger.info('[UberDashboard] Virtual ID tapped');
    navigation.navigate('VirtualID');
  };

  const handleShiftPress = (shift: Shift) => {
    logger.info('[UberDashboard] Shift card pressed', { shiftId: shift.id });
    navigation.navigate('ShiftDetails', { shift });
  };

  // Get user display name
  const userName = user?.first_name || user?.username || 'there';

  // Get current venue name (prioritize overdue shift)
  const currentVenueName = activeShift?.venue?.name || shiftForCheckIn?.venue?.name;

  return (
    <View style={[styles.container, { backgroundColor: uberColors.background.light }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header with Greeting */}
        <MapHeader
          userName={userName}
          avatarUrl={user?.profile?.profile_photo}
          date={new Date()}
          isOffline={isOffline}
        />

        {/* Check-in/out Cards Section */}
        <View style={styles.cardsSection}>
          {/* Check In Card */}
          <CheckActionCard
            type="check-in"
            time={formatTime(activeShift?.check_in_time)}
            status={getCheckInStatus()}
            venueName={currentVenueName}
            onPress={handleCheckIn}
            isLoading={isLoading}
            scheduledStartTime={activeShift?.start_time || shiftForCheckIn?.start_time}
            actualCheckInTime={activeShift?.check_in_time}
          />

          {/* Check Out Card */}
          <CheckActionCard
            type="check-out"
            time={formatTime(activeShift?.check_out_time)}
            status={getCheckOutStatus()}
            venueName={activeShift?.venue?.name}
            onPress={handleCheckOut}
            isLoading={isLoading}
          />
        </View>

        {/* Live Shift Timer - only show when checked in */}
        {activeShift?.check_in_time && (
          <LiveShiftTimer
            checkInTime={activeShift.check_in_time}
            checkOutTime={activeShift.check_out_time}
            isActive={!activeShift.check_out_time}
            scheduledEndTime={activeShift.end_time}
          />
        )}

        {/* Overview Stats */}
        <OverviewStats
          hours={stats.hoursToday}
          checks={stats.checksCompleted}
          shifts={stats.shiftsThisWeek}
        />

        {/* Quick Actions */}
        <UberQuickActions
          onDoChecks={handleDoChecks}
          onReportIncident={handleReportIncident}
          onViewShifts={handleViewShifts}
          onViewVirtualID={handleViewVirtualID}
          hasActiveShift={!!activeShift}
        />

        {/* Upcoming Shifts */}
        <UberUpcomingShifts
          shifts={upcomingShifts}
          onShiftPress={handleShiftPress}
          maxShifts={3}
        />

        {/* Bottom spacing for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  cardsSection: {
    paddingHorizontal: spacing.base,
    marginTop: -spacing.md, // Overlap slightly with header
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  bottomSpacer: {
    height: spacing['4xl'],
  },
});

export default UberDashboardScreen;
