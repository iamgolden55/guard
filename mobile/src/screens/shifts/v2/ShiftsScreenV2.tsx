/**
 * ShiftsScreenV2 — Shifts list redesigned to match Phase 4 "Shifts" design.
 *
 * Design language (dark canvas / light paper, red accent, Geist Mono eyebrows):
 *   - Header: "Shifts" title + circular filter icon
 *   - Tabs: All / Upcoming (count) / Past (count) with mono labels + red underline
 *   - Section headers: mono uppercase with tracking ("On shift · Now", "This week", "Next week", "Later")
 *   - Row: date cube (day abbr + date) · venue + time·role · status chip
 *   - Active shift row: red linear gradient + glow border + "Live · HH:MM" chip
 *   - Floating "Request shift" FAB (bottom-right)
 *
 * Preserves the existing Redux reads, pagination (fetchShifts / loadMoreShifts),
 * exchange-service badge counts, pull-to-refresh, and navigation targets used by
 * UberShiftsScreen — only the presentation layer changes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import { useAppSelector, useAppDispatch } from '../../../hooks/useRedux';
import { useAuth } from '../../../hooks/useAuth';
import {
  selectUpcomingShifts,
  selectPastScheduledShifts,
  selectCompletedShifts,
  selectActiveShift,
  selectShiftsLoadingMore,
  selectShiftsHasMore,
  Shift,
  loadMoreShifts,
  fetchShifts,
} from '../../../store/slices/shiftsSlice';
import exchangeService from '../../../services/exchangeService';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow } from '../../../components/redesign';
import { useShiftRealtimeRefresh } from '../../../hooks/useShiftRealtimeRefresh';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type TabKey = 'all' | 'upcoming' | 'past';

// ─────────────────────────────────────────────────────────────
// Date / time helpers
// ─────────────────────────────────────────────────────────────
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const startOfDay = (d: Date) => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};
const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};
const formatTimeRange = (start: string, end: string) => `${formatTime(start)} — ${formatTime(end)}`;

// Monday 00:00 of the week that contains `d`
const weekMonday = (d: Date) => {
  const n = startOfDay(d);
  const dow = n.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  n.setDate(n.getDate() + offset);
  return n;
};

type BucketKey = 'now' | 'this_week' | 'next_week' | 'later' | 'past';
const bucketFor = (shift: Shift, isActive: boolean): BucketKey => {
  if (isActive || shift.status === 'in_progress') return 'now';
  if (shift.status === 'completed' || shift.status === 'cancelled' || shift.status === 'approved') {
    return 'past';
  }
  const now = new Date();
  const shiftStart = new Date(shift.start_time);
  if (shiftStart < startOfDay(now)) return 'past';
  const thisMon = weekMonday(now);
  const nextMon = new Date(thisMon);
  nextMon.setDate(nextMon.getDate() + 7);
  const weekAfter = new Date(nextMon);
  weekAfter.setDate(weekAfter.getDate() + 7);
  if (shiftStart < nextMon) return 'this_week';
  if (shiftStart < weekAfter) return 'next_week';
  return 'later';
};

const SECTION_ORDER: BucketKey[] = ['now', 'this_week', 'next_week', 'later', 'past'];
const SECTION_LABEL: Record<BucketKey, string> = {
  now: 'On shift · Now',
  this_week: 'This week',
  next_week: 'Next week',
  later: 'Later',
  past: 'Past',
};

const displayStatus = (shift: Shift, activeShiftId?: number): string => {
  if (shift.id === activeShiftId || shift.status === 'in_progress') {
    if (shift.check_in_time) {
      const elapsed = Date.now() - new Date(shift.check_in_time).getTime();
      if (elapsed > 0) {
        const h = Math.floor(elapsed / 3_600_000);
        const m = Math.floor((elapsed % 3_600_000) / 60_000);
        return `Live · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    return 'Live';
  }
  switch (shift.status) {
    case 'scheduled':
      return 'Scheduled';
    case 'pending_approval':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'no_show':
      return 'No show';
    default:
      return String(shift.status).replace(/_/g, ' ');
  }
};

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────
const ShiftRow: React.FC<{
  shift: Shift;
  active: boolean;
  onPress: () => void;
}> = ({ shift, active, onPress }) => {
  const theme = useRedesignTheme();
  const start = new Date(shift.start_time);
  const dayAbbr = DAY_ABBR[start.getDay()];
  const dateNum = start.getDate();
  const status = displayStatus(shift, active ? shift.id : undefined);
  const role = shift.required_security_role || 'Security Staff';
  const timeRange = formatTimeRange(shift.start_time, shift.end_time);

  const statusColor = active ? theme.colors.accent : theme.colors.text.tertiary;
  const statusBg = active ? theme.colors.accentSoft : 'transparent';
  const statusBorder = active ? theme.colors.accentBorder : 'transparent';

  const Body = (
    <View style={styles.rowInner}>
      <View
        style={[
          styles.dateCube,
          {
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(11,11,14,0.03)',
            borderColor: theme.colors.surface.hairline,
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 9,
            color: theme.colors.text.secondary,
            letterSpacing: 1.6,
          }}
        >
          {dayAbbr}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 18,
            color: theme.colors.text.primary,
            fontWeight: '400',
            letterSpacing: -0.4,
            marginTop: 1,
          }}
        >
          {dateNum}
        </Text>
      </View>

      <View style={styles.rowMiddle}>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            fontSize: 15,
            color: theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.2,
          }}
        >
          {shift.venue?.name ?? 'Unknown venue'}
        </Text>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            fontSize: 12,
            color: theme.colors.text.secondary,
            marginTop: 2,
          }}
        >
          {timeRange} · {role}
        </Text>
      </View>

      <View
        style={
          active
            ? {
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 6,
                backgroundColor: statusBg,
                borderWidth: 1,
                borderColor: statusBorder,
              }
            : undefined
        }
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 9,
            color: statusColor,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
          }}
        >
          {status}
        </Text>
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: theme.radii.xl,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {active ? (
        <LinearGradient
          colors={theme.shiftCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            borderRadius: theme.radii.xl,
            borderWidth: 1,
            borderColor: theme.shiftCardBorder,
          }}
        >
          {Body}
        </LinearGradient>
      ) : (
        <View
          style={{
            backgroundColor: theme.colors.surface.card,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            borderRadius: theme.radii.xl,
          }}
        >
          {Body}
        </View>
      )}
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────
const TabButton: React.FC<{
  label: string;
  active: boolean;
  count?: number;
  onPress: () => void;
}> = ({ label, active, count, onPress }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable onPress={onPress} style={styles.tabButton} hitSlop={8}>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          color: active ? theme.colors.text.primary : theme.colors.text.tertiary,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
        {count != null ? (
          <Text
            style={{
              color: active ? theme.colors.accent : theme.colors.text.quaternary,
              marginLeft: 6,
            }}
          >
            {'  '}
            {count}
          </Text>
        ) : null}
      </Text>
      {active ? (
        <View
          style={{
            position: 'absolute',
            bottom: -1,
            left: '30%',
            right: '30%',
            height: 2,
            backgroundColor: theme.colors.accent,
            borderRadius: 1,
          }}
        />
      ) : null}
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ onBrowse: () => void }> = ({ onBrowse }) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.surface.chip,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
            stroke={theme.colors.text.secondary}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 17,
          color: theme.colors.text.primary,
          letterSpacing: -0.3,
          fontWeight: '500',
        }}
      >
        No shifts here
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 13,
          color: theme.colors.text.secondary,
          marginTop: 6,
          textAlign: 'center',
        }}
      >
        Pull to refresh, or browse open shifts below.
      </Text>
      <Pressable
        onPress={onBrowse}
        style={({ pressed }) => ({
          marginTop: 18,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: theme.colors.accentSoft,
          borderWidth: 1,
          borderColor: theme.colors.accentBorder,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            color: theme.colors.accent,
          }}
        >
          Browse open shifts
        </Text>
      </Pressable>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────
export const ShiftsScreenV2 = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const upcomingShifts = useAppSelector(selectUpcomingShifts);
  const pastScheduledShifts = useAppSelector(selectPastScheduledShifts);
  const completedShifts = useAppSelector(selectCompletedShifts);
  const activeShift = useAppSelector(selectActiveShift);
  const isLoadingMore = useAppSelector(selectShiftsLoadingMore);
  const hasMore = useAppSelector(selectShiftsHasMore);

  const [tab, setTab] = useState<TabKey>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [pendingExchangeCount, setPendingExchangeCount] = useState(0);
  const [availableShiftsCount, setAvailableShiftsCount] = useState(0);
  const [liveTick, setLiveTick] = useState(0);
  const loadMoreGuard = useRef(false);

  // Re-render every minute so "Live · HH:MM" stays fresh.
  useEffect(() => {
    if (!activeShift) return undefined;
    const id = setInterval(() => setLiveTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [activeShift]);

  const refreshBadgeCounts = useCallback(async () => {
    try {
      if (user?.id) {
        setPendingExchangeCount(
          await exchangeService.getPendingIncomingExchangesCount(user.id),
        );
      } else {
        setPendingExchangeCount(0);
      }

      setAvailableShiftsCount(await exchangeService.getAvailableShiftsCount());
    } catch (e) {
      logger.error('[ShiftsScreenV2] badge counts', e);
    }
  }, [user?.id]);

  const refreshShiftData = useCallback(async () => {
    await dispatch(fetchShifts({ page: 1, pageSize: 20 })).unwrap();
    await refreshBadgeCounts();
  }, [dispatch, refreshBadgeCounts]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          await refreshShiftData();
        } catch (e) {
          logger.error('[ShiftsScreenV2] initial refresh', e);
        }
      })();
    }, [refreshShiftData]),
  );

  useShiftRealtimeRefresh(refreshShiftData);

  // Tab buckets + counts
  const upcomingCount = upcomingShifts.length + (activeShift ? 1 : 0);
  const pastCount = pastScheduledShifts.length + completedShifts.length;
  const allCount = upcomingCount + pastCount;

  const visibleShifts: Shift[] = useMemo(() => {
    const up: Shift[] = activeShift ? [activeShift, ...upcomingShifts] : [...upcomingShifts];
    const past: Shift[] = [...pastScheduledShifts, ...completedShifts];
    if (tab === 'upcoming') return up;
    if (tab === 'past') return past;
    return [...up, ...past];
  }, [tab, activeShift, upcomingShifts, pastScheduledShifts, completedShifts]);

  // Group into sections + sort within
  const sections = useMemo(() => {
    const byBucket = new Map<BucketKey, Shift[]>();
    visibleShifts.forEach((s) => {
      const key = bucketFor(s, activeShift?.id === s.id);
      const arr = byBucket.get(key) ?? [];
      arr.push(s);
      byBucket.set(key, arr);
    });
    return SECTION_ORDER.filter((k) => (byBucket.get(k)?.length ?? 0) > 0).map((k) => ({
      key: k,
      label: SECTION_LABEL[k],
      shifts: (byBucket.get(k) ?? []).sort((a, b) => {
        const ta = new Date(a.start_time).getTime();
        const tb = new Date(b.start_time).getTime();
        return k === 'past' ? tb - ta : ta - tb;
      }),
    }));
  }, [visibleShifts, activeShift?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshShiftData();
    } catch (e) {
      logger.error('[ShiftsScreenV2] refresh', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (
      distanceFromBottom < 280 &&
      hasMore &&
      !isLoadingMore &&
      !loadMoreGuard.current
    ) {
      loadMoreGuard.current = true;
      dispatch(loadMoreShifts()).finally(() => {
        loadMoreGuard.current = false;
      });
    }
  };

  const openShift = (shift: Shift) => navigation.navigate('ShiftDetails', { shift });
  const openRequestShift = () => navigation.navigate('AvailableShifts');
  const openExchanges = () => navigation.navigate('ShiftExchanges');

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 28,
            color: theme.colors.text.primary,
            fontWeight: '400',
            letterSpacing: -0.8,
          }}
        >
          Shifts
        </Text>
        <Pressable
          onPress={openExchanges}
          hitSlop={8}
          accessibilityLabel="Shift exchanges"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 7h18M6 12h12M10 17h4"
              stroke={theme.colors.text.primary}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </Svg>
          {pendingExchangeCount > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                paddingHorizontal: 4,
                backgroundColor: theme.colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.colors.canvas,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}
              >
                {pendingExchangeCount > 9 ? '9+' : pendingExchangeCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabs,
          { borderBottomColor: theme.colors.surface.hairline },
        ]}
      >
        <TabButton
          label="All"
          active={tab === 'all'}
          count={allCount > 0 ? allCount : undefined}
          onPress={() => setTab('all')}
        />
        <TabButton
          label="Upcoming"
          active={tab === 'upcoming'}
          count={upcomingCount > 0 ? upcomingCount : undefined}
          onPress={() => setTab('upcoming')}
        />
        <TabButton
          label="Past"
          active={tab === 'past'}
          count={pastCount > 0 ? pastCount : undefined}
          onPress={() => setTab('past')}
        />
      </View>

      {/* Sections */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={120}
      >
        {availableShiftsCount > 0 ? (
          <Pressable
            onPress={openRequestShift}
            style={({ pressed }) => ({
              marginBottom: 14,
              padding: 14,
              borderRadius: theme.radii.xl,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: theme.colors.surface.card,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
                  stroke={theme.colors.accent}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 14,
                  color: theme.colors.text.primary,
                  fontWeight: '500',
                  letterSpacing: -0.2,
                }}
              >
                Open shifts available
              </Text>
              <Text
                allowFontScaling={false}
                style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }}
              >
                {availableShiftsCount} unassigned · claim before anyone else
              </Text>
            </View>
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                color: theme.colors.accent,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
              }}
            >
              View
            </Text>
          </Pressable>
        ) : null}

        {sections.length === 0 ? (
          <EmptyState onBrowse={openRequestShift} />
        ) : (
          sections.map((section) => (
            <View key={section.key} style={{ marginBottom: 18 }}>
              <Eyebrow size={10} tracking={2.2} style={{ marginLeft: 6, marginBottom: 8 }}>
                {section.label}
              </Eyebrow>
              <View style={{ gap: 8 }}>
                {section.shifts.map((shift) => (
                  <ShiftRow
                    key={shift.id}
                    shift={shift}
                    active={activeShift?.id === shift.id}
                    onPress={() => openShift(shift)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {isLoadingMore ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
          </View>
        ) : null}

        {/* Keep hook reference to liveTick so React picks up elapsed minute changes */}
        <View style={{ height: 0, width: liveTick }} />
      </ScrollView>

      {/* Floating Request-shift FAB */}
      <Pressable
        onPress={openRequestShift}
        accessibilityLabel="Request shift"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: 24 + insets.bottom,
          height: 52,
          paddingHorizontal: 22,
          borderRadius: 26,
          backgroundColor: theme.colors.accent,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          shadowColor: theme.colors.accent,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: pressed ? 0.25 : 0.45,
          shadowRadius: 22,
          elevation: 12,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M7 1v12M1 7h12" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <Text
          allowFontScaling={false}
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: '500',
            letterSpacing: -0.2,
            fontFamily: theme.fonts.sans,
          }}
        >
          Request shift
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabs: {
    marginHorizontal: 20,
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  rowInner: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateCube: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
  },
});

export default ShiftsScreenV2;
