/**
 * Dashboard Home (V2)
 *
 * Re-skin of UberDashboardScreen in the redesigned language:
 *   - Dark canvas (#0b0b0e) or warm paper (#f6f5f1) via useRedesignTheme()
 *   - Header: eyebrow date · "Good morning, {name}." · avatar
 *   - Live shift card with pulse dot, running timer, progress, actions
 *   - Stats grid (hours this week · shifts this week)
 *   - Up next list
 *   - Ambient red radial glow (top-right)
 *
 * Preserves all Redux state reads, navigation handlers and side-effects
 * from UberDashboardScreen — this is a visual swap only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { selectCurrentUser } from '../../../store/slices/authSlice';
import {
  selectActiveShift,
  selectUpcomingShifts,
  selectPastScheduledShifts,
  fetchShifts,
  type Shift,
} from '../../../store/slices/shiftsSlice';
import { logger } from '../../../utils/logger';
import { ApiTimeoutError, NetworkError, ApiError } from '../../../services/api';
import { shiftChecksService } from '../../../services/shiftChecksService';
import { ERROR_MESSAGES } from '../../../utils/constants';
import { useRedesignTheme } from '../../../theme/redesign';
import { useShiftRealtimeRefresh } from '../../../hooks/useShiftRealtimeRefresh';
import {
  Eyebrow,
  GlassCard,
  AccentDot,
  AmbientGlow,
} from '../../../components/redesign';
import type { RootStackParamList } from '../../../types/navigation';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUICK_ACTIONS_PER_ROW = 4;

interface DashboardQuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function greet(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  const fmt = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  if (!start && !end) return '';
  return `${fmt(start)} – ${fmt(end)}`;
}

function dayTag(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    // If hour >= 18 call it tonight
    return d.getHours() >= 18 ? 'TONIGHT' : 'TODAY';
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  ) {
    return 'TMRW';
  }
  return WEEKDAY_SHORT[d.getDay()];
}

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────
export const DashboardHomeV2: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const user = useAppSelector(selectCurrentUser);
  const activeShift = useAppSelector(selectActiveShift);
  const upcomingShifts = useAppSelector(selectUpcomingShifts);
  const pastScheduledShifts = useAppSelector(selectPastScheduledShifts);
  const staffProfile = user?.staff_profile;
  const employmentCategory = staffProfile?.employment_type?.employment_category;
  const isContractor =
    employmentCategory === 'contractor' || employmentCategory === 'temporary';

  const [shiftChecks, setShiftChecks] = useState<{
    fireExitChecks: any[];
    capacityChecks: any[];
    toiletChecks: any[];
  } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live timer ticks once per minute while on-shift
  useEffect(() => {
    if (!activeShift?.check_in_time) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(id);
  }, [activeShift?.check_in_time]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    NetInfo.fetch().then((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => unsub();
  }, []);

  const refreshShifts = useCallback(async () => {
    try {
      await dispatch(fetchShifts({ page: 1, pageSize: 20 })).unwrap();
    } catch (error: any) {
      logger.error('[DashboardV2] Error fetching shifts:', error);
      if (error instanceof ApiTimeoutError) {
        Alert.alert('Connection Timeout', `${ERROR_MESSAGES.TIMEOUT_ERROR}\n\nYou may be viewing offline data.`);
      } else if (error instanceof NetworkError) {
        Alert.alert('No Internet Connection', `${ERROR_MESSAGES.NETWORK_ERROR}\n\nYou may be viewing offline data.`);
      } else if (error instanceof ApiError) {
        Alert.alert('Server Error', `Unable to fetch shifts: ${error.statusText}\n\nYou may be viewing offline data.`);
      }
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(async () => {
        await refreshShifts();
      }, 500);
      return () => clearTimeout(timer);
    }, [refreshShifts]),
  );

  useShiftRealtimeRefresh(refreshShifts);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const run = async () => {
        if (activeShift?.id) {
          try {
            const checks = await shiftChecksService.getShiftChecks(activeShift.id);
            if (!cancelled) setShiftChecks(checks);
          } catch (error) {
            logger.error('[DashboardV2] Error fetching checks:', error);
            if (!cancelled) setShiftChecks(null);
          }
        } else {
          setShiftChecks(null);
        }
      };
      run();
      return () => {
        cancelled = true;
      };
    }, [activeShift?.id]),
  );

  // Overdue (started but not yet expired) shifts that still support check-in
  const overdueShifts = pastScheduledShifts.filter((shift: Shift) => new Date(shift.end_time) > new Date());
  const nextOverdueShift = overdueShifts[0] ?? null;
  const nextUpcomingShift = upcomingShifts[0] ?? null;
  const shiftForCheckIn = nextOverdueShift ?? nextUpcomingShift ?? null;

  const checksCompleted =
    (shiftChecks?.fireExitChecks?.length ?? 0) +
    (shiftChecks?.capacityChecks?.length ?? 0) +
    (shiftChecks?.toiletChecks?.length ?? 0);

  const hoursThisWeek = useMemo(() => {
    const collect: number[] = [];
    const allShifts: Shift[] = [
      ...(activeShift ? [activeShift] : []),
      ...upcomingShifts,
    ];
    for (const s of allShifts) {
      const ms = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
      if (ms > 0) collect.push(ms / (1000 * 60 * 60));
    }
    const total = collect.reduce((a, b) => a + b, 0);
    return Math.round(total * 10) / 10;
  }, [activeShift, upcomingShifts]);

  // ── Live timer numbers ──
  const liveTimer = useMemo(() => {
    if (!activeShift?.check_in_time) return null;
    const start = new Date(activeShift.check_in_time).getTime();
    const total =
      new Date(activeShift.end_time).getTime() -
      new Date(activeShift.start_time).getTime();
    const elapsed = now - start;
    const pct = Math.max(0, Math.min(1, total > 0 ? elapsed / total : 0));
    return {
      elapsedLabel: formatClock(elapsed),
      totalLabel: formatClock(total),
      pct,
    };
  }, [activeShift?.check_in_time, activeShift?.start_time, activeShift?.end_time, now]);

  // Navigation handlers
  const openActiveOrNext = () => {
    const shift = activeShift ?? shiftForCheckIn;
    if (shift) navigation.navigate('ShiftDetails', { shift });
  };

  const openIncident = useCallback(() => {
    if (!activeShift) {
      Alert.alert(
        'No Active Shift',
        'You need an active shift to report an incident. Please check in to a shift first.',
      );
      return;
    }
    navigation.navigate('IncidentReport', {
      shiftId: activeShift.id,
      venueId: activeShift.venue.id,
    });
  }, [activeShift, navigation]);

  const openChecks = () => {
    if (!activeShift) {
      Alert.alert(
        'No Active Shift',
        'You need an active shift to perform venue checks. Please check in to a shift first.',
      );
      return;
    }
    navigation.navigate('ShiftChecks', { shiftId: activeShift.id });
  };

  const openShifts = () =>
    navigation.navigate('Tabs' as any, { screen: 'Calendar' });

  const openVirtualID = () => navigation.navigate('VirtualID');

  const openLeaveOrAvailability = () => {
    if (isContractor) {
      navigation.navigate('ContractorUnavailability');
      return;
    }
    navigation.navigate('LeaveBalance');
  };

  const quickActions = useMemo<DashboardQuickAction[]>(
    () => [
      {
        id: 'incidents',
        label: 'Incident reports',
        icon: 'warning-outline',
        onPress: openIncident,
      },
      {
        id: 'shifts',
        label: 'My shifts',
        icon: 'calendar-outline',
        onPress: openShifts,
      },
      {
        id: 'id',
        label: 'Virtual ID',
        icon: 'id-card-outline',
        onPress: openVirtualID,
      },
      {
        id: 'leave',
        label: isContractor ? 'Availability' : 'Leave management',
        icon: isContractor ? 'time-outline' : 'briefcase-outline',
        onPress: openLeaveOrAvailability,
      },
    ],
    [isContractor, openIncident],
  );

  // ── UI ──
  const name = user?.first_name || user?.username || 'there';
  const today = new Date();
  const dateLabel = `${WEEKDAY[today.getDay()]} · ${today.getDate()} ${MONTH[today.getMonth()]}`;
  const userInitial = (user?.first_name?.[0] || user?.username?.[0] || 'A').toUpperCase();

  const bg = theme.colors.canvas;
  const textPrimary = theme.colors.text.primary;
  const textSecondary = theme.colors.text.secondary;

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Ambient glow top-right */}
      <View pointerEvents="none" style={[styles.ambient, { top: -120, right: -120 }]}>
        <AmbientGlow size={420} intensity={0.32} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Eyebrow color={textSecondary}>{dateLabel}</Eyebrow>
            <Text
              style={[styles.greeting, { color: textPrimary, fontFamily: theme.fonts.sans }]}
              numberOfLines={1}
            >
              {greet(today)}, {name}.
            </Text>
            {isOffline ? (
              <Eyebrow color={theme.colors.accent} style={{ marginTop: 6 }}>
                Offline · data may be stale
              </Eyebrow>
            ) : null}
          </View>

          <Pressable onPress={() => navigation.navigate('Tabs' as any, { screen: 'Profile' })}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.isDark ? '#24242a' : '#e8e7e2',
                  borderColor: theme.colors.surface.hairline,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={{
                  color: textPrimary,
                  fontSize: 17,
                  fontWeight: '500',
                  fontFamily: theme.fonts.sans,
                  letterSpacing: -0.4,
                }}
              >
                {userInitial}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Live shift card OR next-shift card */}
        {activeShift ? (
          <LiveShiftCard
            activeShift={activeShift}
            liveTimer={liveTimer}
            onChecks={openChecks}
            onIncident={openIncident}
            onCheckOut={openActiveOrNext}
          />
        ) : (
          <NextShiftCard
            shift={shiftForCheckIn}
            onOpen={openActiveOrNext}
          />
        )}

        {/* Quick stats grid */}
        <View style={styles.statsGrid}>
          <StatCard
            eyebrow="Hours · This week"
            value={hoursThisWeek ? String(hoursThisWeek) : '0'}
            support={`${(activeShift ? 1 : 0) + upcomingShifts.length} shifts booked`}
          />
          <StatCard
            eyebrow={activeShift ? 'Checks · Today' : 'Shifts · Upcoming'}
            value={activeShift ? String(checksCompleted) : String(upcomingShifts.length)}
            support={activeShift ? 'Since clock on' : 'Next 7 days'}
          />
        </View>

        <QuickActionsSection actions={quickActions} />

        {/* Up next */}
        <View style={styles.upNextRow}>
          <Eyebrow color={textSecondary}>Up next</Eyebrow>
          <Pressable
            hitSlop={8}
            onPress={() => navigation.navigate('Tabs' as any, { screen: 'Calendar' })}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 11,
                color: theme.colors.accent,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                fontWeight: '500',
              }}
            >
              See all
            </Text>
          </Pressable>
        </View>

        <View style={styles.upNextList}>
          {upcomingShifts.slice(0, 3).length === 0 ? (
            <GlassCard pad={16}>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.sans,
                  color: textSecondary,
                  fontSize: 13,
                }}
              >
                No upcoming shifts booked.
              </Text>
            </GlassCard>
          ) : (
            upcomingShifts.slice(0, 3).map((shift) => (
              <UpNextRow
                key={shift.id}
                shift={shift}
                onPress={() => navigation.navigate('ShiftDetails', { shift })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const QuickActionsSection: React.FC<{ actions: DashboardQuickAction[] }> = ({ actions }) => {
  const theme = useRedesignTheme();
  const actionRows = useMemo(() => {
    const rows: DashboardQuickAction[][] = [];
    for (let i = 0; i < actions.length; i += QUICK_ACTIONS_PER_ROW) {
      rows.push(actions.slice(i, i + QUICK_ACTIONS_PER_ROW));
    }
    return rows;
  }, [actions]);

  return (
    <View style={styles.quickActionsSection}>
      <View style={styles.quickActionsHeader}>
        <Eyebrow color={theme.colors.text.secondary}>Quick actions</Eyebrow>
      </View>

      <View style={styles.quickActionsGrid}>
        {actionRows.map((row, rowIndex) => (
          <View
            key={`quick-action-row-${rowIndex}`}
            style={[
              styles.quickActionsRow,
              row.length === QUICK_ACTIONS_PER_ROW
                ? styles.quickActionsRowSpread
                : styles.quickActionsRowCentered,
            ]}
          >
            {row.map((action) => (
              <Pressable
                key={action.id}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.quickActionButton,
                  { opacity: pressed ? 0.82 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.quickActionIconWrap,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.accentBorder,
                      shadowColor: theme.colors.accentGlow,
                    },
                  ]}
                >
                  <Ionicons name={action.icon} size={23} color={theme.colors.accent} />
                </View>

                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={[
                    styles.quickActionLabel,
                    { color: theme.colors.text.primary, fontFamily: theme.fonts.sans },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Live shift card
// ─────────────────────────────────────────────────────────────
interface LiveShiftCardProps {
  activeShift: Shift;
  liveTimer: { elapsedLabel: string; totalLabel: string; pct: number } | null;
  onChecks: () => void;
  onIncident: () => void;
  onCheckOut: () => void;
}

const LiveShiftCard: React.FC<LiveShiftCardProps> = ({
  activeShift,
  liveTimer,
  onChecks,
  onIncident,
  onCheckOut,
}) => {
  const theme = useRedesignTheme();
  const venueName = activeShift.venue?.name ?? 'Current post';
  const schedule = formatTimeRange(activeShift.start_time, activeShift.end_time);
  const role = activeShift.required_security_role || 'Security';

  return (
    <View style={styles.shiftCardWrap}>
      <View style={{ borderRadius: theme.radii.card, overflow: 'hidden' }}>
        <LinearGradient
          colors={theme.shiftCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            padding: 20,
            borderRadius: theme.radii.card,
            borderWidth: 1,
            borderColor: theme.shiftCardBorder,
          }}
        >
          {/* Header row */}
          <View style={styles.rowBetween}>
            <View style={styles.rowAligned}>
              <AccentDot pulse />
              <Eyebrow color={theme.colors.text.primary} tracking={2.2}>
                On shift · Live
              </Eyebrow>
            </View>
            <Eyebrow color={theme.colors.text.secondary} tracking={1.6}>
              {role}
            </Eyebrow>
          </View>

          {/* Venue */}
          <Text
            allowFontScaling={false}
            style={[styles.venue, { color: theme.colors.text.primary, fontFamily: theme.fonts.sans }]}
          >
            {venueName}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 3,
              fontSize: 13,
              color: theme.colors.text.secondary,
              fontFamily: theme.fonts.sans,
            }}
          >
            {schedule}
          </Text>

          {/* Timer */}
          <View style={styles.timerRow}>
            <Text
              allowFontScaling={false}
              style={[styles.timerBig, { color: theme.colors.text.primary, fontFamily: theme.fonts.sans }]}
            >
              {liveTimer?.elapsedLabel ?? '00:00'}
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 13,
                color: theme.colors.text.secondary,
                fontFamily: theme.fonts.sans,
              }}
            >
              of {liveTimer?.totalLabel ?? '00:00'} elapsed
            </Text>
          </View>

          {/* Progress */}
          <View
            style={{
              marginTop: 14,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(11,11,14,0.05)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round((liveTimer?.pct ?? 0) * 100)}%`,
                height: '100%',
                backgroundColor: theme.colors.accent,
                borderRadius: 2,
              }}
            />
          </View>

          {/* Actions */}
          <View style={styles.shiftActions}>
            <Pressable
              onPress={onChecks}
              style={({ pressed }) => [
                styles.shiftActionBtn,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(11,11,14,0.06)',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: theme.colors.text.primary,
                  fontSize: 12,
                  fontWeight: '500',
                  fontFamily: theme.fonts.sans,
                  letterSpacing: -0.15,
                }}
              >
                Venue checks
              </Text>
            </Pressable>
            <Pressable
              onPress={onIncident}
              style={({ pressed }) => [
                styles.shiftActionBtn,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(11,11,14,0.06)',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: theme.colors.text.primary,
                  fontSize: 12,
                  fontWeight: '500',
                  fontFamily: theme.fonts.sans,
                  letterSpacing: -0.15,
                }}
              >
                Incident report
              </Text>
            </Pressable>
            <Pressable
              onPress={onCheckOut}
              style={({ pressed }) => [
                styles.shiftActionBtn,
                styles.shiftActionPrimary,
                {
                  backgroundColor: theme.isDark ? '#ffffff' : '#0b0b0e',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: theme.isDark ? '#000' : '#fff',
                  fontSize: 12,
                  fontWeight: '500',
                  fontFamily: theme.fonts.sans,
                  letterSpacing: -0.15,
                }}
              >
                Check out
              </Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// No-active-shift card (shows next upcoming or empty state)
// ─────────────────────────────────────────────────────────────
interface NextShiftCardProps {
  shift: Shift | null;
  onOpen: () => void;
}

const NextShiftCard: React.FC<NextShiftCardProps> = ({ shift, onOpen }) => {
  const theme = useRedesignTheme();

  if (!shift) {
    return (
      <View style={styles.shiftCardWrap}>
        <GlassCard pad={20}>
          <Eyebrow color={theme.colors.accent}>No shift today</Eyebrow>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 12,
              fontSize: 22,
              fontWeight: '500',
              letterSpacing: -0.4,
              color: theme.colors.text.primary,
              fontFamily: theme.fonts.sans,
            }}
          >
            You're off the clock.
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 8,
              fontSize: 13,
              color: theme.colors.text.secondary,
              fontFamily: theme.fonts.sans,
              lineHeight: 20,
            }}
          >
            Check the Shifts tab to browse open shifts you can claim.
          </Text>
        </GlassCard>
      </View>
    );
  }

  const venue = shift.venue?.name ?? 'Next post';
  const schedule = formatTimeRange(shift.start_time, shift.end_time);
  const starts = new Date(shift.start_time);
  const startsIn = Math.max(0, starts.getTime() - Date.now());
  const hrs = Math.floor(startsIn / (1000 * 60 * 60));
  const mins = Math.floor((startsIn % (1000 * 60 * 60)) / (1000 * 60));
  const countdown = hrs > 0 ? `in ${hrs}h ${mins}m` : `in ${mins}m`;

  return (
    <View style={styles.shiftCardWrap}>
      <Pressable onPress={onOpen} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <View style={{ borderRadius: theme.radii.card, overflow: 'hidden' }}>
          <LinearGradient
            colors={theme.shiftCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              padding: 20,
              borderRadius: theme.radii.card,
              borderWidth: 1,
              borderColor: theme.shiftCardBorder,
            }}
          >
            <View style={styles.rowBetween}>
              <View style={styles.rowAligned}>
                <AccentDot color={theme.colors.accent} pulse />
                <Eyebrow color={theme.colors.text.primary} tracking={2.2}>
                  Next shift · {countdown}
                </Eyebrow>
              </View>
              <Eyebrow color={theme.colors.text.secondary} tracking={1.6}>
                {shift.required_security_role}
              </Eyebrow>
            </View>
            <Text
              allowFontScaling={false}
              style={[styles.venue, { color: theme.colors.text.primary, fontFamily: theme.fonts.sans }]}
            >
              {venue}
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 3,
                fontSize: 13,
                color: theme.colors.text.secondary,
                fontFamily: theme.fonts.sans,
              }}
            >
              {schedule}
            </Text>

            <View style={[styles.shiftActions, { marginTop: 20 }]}>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={onOpen}
                style={({ pressed }) => [
                  styles.shiftActionBtn,
                  styles.shiftActionPrimary,
                  {
                    backgroundColor: theme.colors.accent,
                    opacity: pressed ? 0.9 : 1,
                    shadowColor: theme.colors.accentGlow,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: '500',
                    fontFamily: theme.fonts.sans,
                    letterSpacing: -0.15,
                  }}
                >
                  Start check-in
                </Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </Pressable>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────
const StatCard: React.FC<{ eyebrow: string; value: string; support?: string }> = ({
  eyebrow,
  value,
  support,
}) => {
  const theme = useRedesignTheme();
  return (
    <GlassCard pad={14} style={{ flex: 1 }}>
      <Eyebrow color={theme.colors.text.secondary}>{eyebrow}</Eyebrow>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 26,
          color: theme.colors.text.primary,
          fontWeight: '400',
          letterSpacing: -0.8,
          marginTop: 8,
          lineHeight: 28,
          fontFamily: theme.fonts.sans,
        }}
      >
        {value}
      </Text>
      {support ? (
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 11,
            color: theme.colors.text.tertiary,
            marginTop: 6,
            fontFamily: theme.fonts.sans,
          }}
        >
          {support}
        </Text>
      ) : null}
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────
// Up next row
// ─────────────────────────────────────────────────────────────
const UpNextRow: React.FC<{ shift: Shift; onPress: () => void }> = ({ shift, onPress }) => {
  const theme = useRedesignTheme();
  const venue = shift.venue?.name ?? 'Post';
  const time = `${formatTimeRange(shift.start_time, shift.end_time)} · ${shift.required_security_role}`;
  const tag = 'Scheduled';
  const day = dayTag(shift.start_time);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      <GlassCard pad={14} style={styles.upNextCard}>
        <View
          style={[
            styles.upNextDay,
            {
              backgroundColor: theme.colors.surface.card,
              borderColor: theme.colors.surface.hairline,
            },
          ]}
        >
          <Eyebrow size={9} tracking={1.8} color={theme.colors.text.tertiary}>
            {day}
          </Eyebrow>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontSize: 15,
              fontWeight: '500',
              color: theme.colors.text.primary,
              letterSpacing: -0.15,
              fontFamily: theme.fonts.sans,
            }}
          >
            {venue}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: theme.colors.text.secondary,
              marginTop: 2,
              fontFamily: theme.fonts.sans,
            }}
          >
            {time}
          </Text>
        </View>
        <Eyebrow size={9} tracking={1.8} color={theme.colors.text.tertiary}>
          {tag}
        </Eyebrow>
      </GlassCard>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  ambient: {
    position: 'absolute',
    zIndex: 0,
    opacity: 0.85,
  },
  header: {
    paddingTop: 24,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -0.7,
    marginTop: 6,
    maxWidth: SCREEN_W - 110,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 4,
  },
  shiftCardWrap: {
    marginTop: 22,
    marginHorizontal: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowAligned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  venue: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
  timerRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  timerBig: {
    fontSize: 44,
    fontWeight: '300',
    letterSpacing: -1.6,
    lineHeight: 46,
    fontVariant: ['tabular-nums'],
  },
  shiftActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  shiftActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftActionPrimary: {
    flex: 1.3,
  },
  statsGrid: {
    marginTop: 16,
    marginHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
  },
  quickActionsSection: {
    marginTop: 26,
    marginHorizontal: 20,
  },
  quickActionsHeader: {
    paddingHorizontal: 8,
  },
  quickActionsGrid: {
    marginTop: 16,
    gap: 18,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionsRowSpread: {
    justifyContent: 'space-between',
  },
  quickActionsRowCentered: {
    justifyContent: 'center',
  },
  quickActionButton: {
    width: 68,
    alignItems: 'center',
  },
  quickActionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  quickActionLabel: {
    marginTop: 10,
    minHeight: 30,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  upNextRow: {
    marginTop: 28,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  upNextList: {
    marginTop: 14,
    marginHorizontal: 20,
    gap: 8,
  },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upNextDay: {
    width: 46,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
});

export default DashboardHomeV2;
