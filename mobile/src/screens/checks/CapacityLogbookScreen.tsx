/**
 * Capacity Logbook Screen — redesign aligned with the dashboard/check-in V2 visual language.
 *
 * Read view of the digital capacity-check logbook for a shift_group.
 * Shows a chronological audit trail of CapacityCheck entries and missed
 * 30-minute slots, plus a countdown to the next due check (or a "Sign off
 * logbook" CTA when the shift is wrapping up). Subscribes to the WS
 * capacity_event channel to live-refresh as teammates log counts.
 *
 * Functionality is unchanged from the prior version — only the visuals,
 * layout, and a switch to FlatList for the timeline.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useAppSelector } from '../../hooks/useRedux';
import { selectActiveShift } from '../../store/slices/shiftsSlice';
import { logger } from '../../utils/logger';
import {
  shiftChecksService,
  type CapacityCheck,
  type CapacityCheckSlotMiss,
  type CapacityLogbookSignoff,
} from '../../services/shiftChecksService';
import { notificationWebSocket, type CapacityEventMessage } from '../../services/NotificationWebSocket';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { LogbookSignoffModal } from '../../components/LogbookSignoffModal';
import { useRedesignTheme } from '../../theme/redesign';
import {
  Eyebrow,
  GlassCard,
  AccentDot,
  NavBack,
  PrimaryCTA,
  TimelineEntry,
} from '../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'CapacityLogbook'>;
type RouteProps = RouteProp<MainStackParamList, 'CapacityLogbook'>;

type TimelineRow =
  | { kind: 'check'; at: string; data: CapacityCheck; key: string }
  | { kind: 'miss'; at: string; data: CapacityCheckSlotMiss; key: string };

export const CapacityLogbookScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId, shiftGroup: routeShiftGroup } = route.params;
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const activeShift = useAppSelector(selectActiveShift);

  const shiftGroup = routeShiftGroup || activeShift?.shift_group || `shift_${shiftId}`;
  const venueId = activeShift?.venue.id || 0;
  const venueName = activeShift?.venue.name || 'Venue';
  const venueCapacity = activeShift?.venue.capacity ?? 0;
  const intervalMin = activeShift?.venue.capacity_check_interval_minutes ?? 30;

  const [checks, setChecks] = useState<CapacityCheck[]>([]);
  const [misses, setMisses] = useState<CapacityCheckSlotMiss[]>([]);
  const [signoff, setSignoff] = useState<CapacityLogbookSignoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signoffModalVisible, setSignoffModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [checksList, missesList, existingSignoff] = await Promise.all([
        shiftChecksService.getCapacityChecksForGroup(shiftGroup),
        shiftChecksService.getCapacityMisses(shiftGroup),
        shiftChecksService.getLogbookSignoff(shiftGroup),
      ]);
      setChecks(checksList);
      setMisses(missesList);
      setSignoff(existingSignoff);
    } catch (error) {
      logger.error('[CapacityLogbook] Failed to load logbook:', error);
    }
  }, [shiftGroup]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }, [loadData])
  );

  useEffect(() => {
    const unsubscribe = notificationWebSocket.addCapacityEventListener(
      (msg: CapacityEventMessage) => {
        if (msg.shift_group !== shiftGroup) return;
        logger.info('[CapacityLogbook] Live event:', msg.event);
        loadData();
      },
    );
    return unsubscribe;
  }, [shiftGroup, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Single chronological feed (newest first).
  const timeline: TimelineRow[] = useMemo(() => {
    const entries: TimelineRow[] = [
      ...checks.map<TimelineRow>((c) => ({
        kind: 'check',
        at: c.timestamp,
        data: c,
        key: `check-${c.id}`,
      })),
      ...misses.map<TimelineRow>((m) => ({
        kind: 'miss',
        at: m.expected_at,
        data: m,
        key: `miss-${m.id}`,
      })),
    ];
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [checks, misses]);

  // Next-due time relative to the latest check (or shift start if none).
  const nextDueAt: Date | null = useMemo(() => {
    if (signoff) return null;
    const anchor = checks[0]
      ? new Date(checks[0].timestamp).getTime()
      : activeShift?.start_time
        ? new Date(activeShift.start_time).getTime()
        : null;
    if (anchor === null) return null;
    return new Date(anchor + intervalMin * 60 * 1000);
  }, [signoff, checks, activeShift?.start_time, intervalMin]);

  // Live-tick the countdown so it ticks down without a refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (signoff) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [signoff]);

  const minutesUntilDue: number | null = useMemo(() => {
    if (!nextDueAt) return null;
    return Math.round((nextDueAt.getTime() - now) / 60000);
  }, [nextDueAt, now]);

  const handleAcknowledgeMiss = (miss: CapacityCheckSlotMiss) => {
    Alert.prompt(
      'Reason for missed slot',
      `No count was logged for the ${formatTime(miss.expected_at)} window. Add a reason for the audit trail.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (reason?: string) => {
            const trimmed = (reason || '').trim();
            if (!trimmed) return;
            try {
              await shiftChecksService.acknowledgeMiss(miss.id, trimmed);
              await loadData();
            } catch (e) {
              logger.error('[CapacityLogbook] Failed to acknowledge miss:', e);
              Alert.alert('Error', 'Could not save reason. Please try again.');
            }
          },
        },
      ],
      'plain-text',
    );
  };

  const handleOpenSignoff = () => setSignoffModalVisible(true);
  const handleSignoffSubmitted = async () => {
    setSignoffModalVisible(false);
    await loadData();
    navigation.goBack();
  };

  const renderRow = useCallback(
    ({ item, index }: { item: TimelineRow; index: number }) => {
      const isLast = index === timeline.length - 1;

      if (item.kind === 'check') {
        const c = item.data;
        const performer = c.performed_by_details;
        const who = performer
          ? `${performer.first_name} ${performer.last_name?.charAt(0) || ''}.`.trim()
          : 'Teammate';
        return (
          <TimelineEntry
            kind="check"
            time={c.timestamp}
            primary={`${c.current_count} / ${c.venue_capacity}${c.is_at_capacity ? ' · At capacity' : ''}`}
            secondary={who}
            detail={c.action_taken ? `Action: ${c.action_taken}` : undefined}
            emphasis={c.is_at_capacity ? 'warning' : 'neutral'}
            isFirst={index === 0}
            isLast={isLast}
          />
        );
      }

      const m = item.data;
      const acknowledged = m.acknowledged;
      return (
        <TimelineEntry
          kind="miss"
          time={m.expected_at}
          primary={`Missed slot · ${formatTime(m.expected_at)}`}
          secondary={acknowledged ? undefined : 'No count logged for this window'}
          detail={acknowledged ? `Reason: ${m.acknowledgement_reason}` : undefined}
          action={
            acknowledged
              ? undefined
              : { label: 'Add reason', onPress: () => handleAcknowledgeMiss(m) }
          }
          emphasis={acknowledged ? 'warning' : 'critical'}
          isFirst={index === 0}
          isLast={isLast}
        />
      );
    },
    [timeline.length],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <FlatList
        data={timeline}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 32 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <NavBack
                onPress={() => navigation.goBack()}
              />
              <View style={{ flex: 1 }} />
              <View
                style={[
                  styles.countPill,
                  {
                    backgroundColor: theme.colors.surface.chip,
                    borderColor: theme.colors.surface.hairline,
                  },
                ]}
              >
                <Eyebrow tracking={1.8} color={theme.colors.text.secondary}>
                  {checks.length} logged · {misses.length} missed
                </Eyebrow>
              </View>
            </View>

            {/* Title block */}
            <View style={{ marginTop: 16 }}>
              <Eyebrow color={theme.colors.accent}>{venueName}</Eyebrow>
              <Text
                allowFontScaling={false}
                style={[
                  styles.heading,
                  { color: theme.colors.text.primary, fontFamily: theme.fonts.sans },
                ]}
              >
                Capacity logbook
              </Text>
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: theme.colors.text.secondary,
                  fontFamily: theme.fonts.sans,
                }}
              >
                Capacity {venueCapacity} · check every {intervalMin} min
              </Text>
            </View>

            {/* Status hero */}
            <StatusHero
              signoff={signoff}
              minutesUntilDue={minutesUntilDue}
              hasChecks={checks.length > 0}
              intervalMin={intervalMin}
              onLogCheck={() =>
                navigation.navigate('CapacityCheck', { shiftId, checkType: 'capacity' })
              }
              onSignoff={handleOpenSignoff}
            />

            {/* Timeline header */}
            {timeline.length > 0 ? (
              <View style={{ marginTop: 28, marginBottom: 6, marginLeft: 4 }}>
                <Eyebrow>Timeline · newest first</Eyebrow>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <GlassCard style={{ alignItems: 'center', paddingVertical: 32, marginTop: 20 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor: theme.colors.surface.hairlineStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path
                    d="M12 6 v6 l4 2 M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20"
                    stroke={theme.colors.text.secondary}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.sans,
                  color: theme.colors.text.primary,
                  fontSize: 16,
                  fontWeight: '500',
                  marginBottom: 4,
                }}
              >
                No checks yet
              </Text>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.sans,
                  color: theme.colors.text.secondary,
                  fontSize: 13,
                  textAlign: 'center',
                  paddingHorizontal: 28,
                }}
              >
                The first count is due {intervalMin} min after shift start.
              </Text>
            </GlassCard>
          ) : null
        }
      />

      <LogbookSignoffModal
        visible={signoffModalVisible}
        shiftGroup={shiftGroup}
        venueId={venueId}
        venueName={venueName}
        totalChecks={checks.length}
        totalMissed={misses.length}
        onClose={() => setSignoffModalVisible(false)}
        onSubmitted={handleSignoffSubmitted}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Status hero — three states: pending (countdown), overdue, signed-off
// ─────────────────────────────────────────────────────────────
interface StatusHeroProps {
  signoff: CapacityLogbookSignoff | null;
  minutesUntilDue: number | null;
  hasChecks: boolean;
  intervalMin: number;
  onLogCheck: () => void;
  onSignoff: () => void;
}

const StatusHero: React.FC<StatusHeroProps> = ({
  signoff,
  minutesUntilDue,
  hasChecks,
  intervalMin,
  onLogCheck,
  onSignoff,
}) => {
  const theme = useRedesignTheme();

  // Closed
  if (signoff) {
    return (
      <GlassCard style={{ marginTop: 22, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: theme.colors.accentSoft,
              borderWidth: 1,
              borderColor: theme.colors.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={10} height={10} viewBox="0 0 16 16">
              <Path
                d="M3 8 L7 12 L13 4"
                stroke={theme.colors.accent}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Eyebrow color={theme.colors.accent}>Logbook closed</Eyebrow>
        </View>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 12,
            fontSize: 26,
            color: theme.colors.text.primary,
            fontFamily: theme.fonts.sans,
            fontWeight: '400',
            letterSpacing: -0.6,
            lineHeight: 32,
          }}
        >
          {signoff.signature
            ? `Signed by ${signoff.closed_by_name}`
            : 'Closed via override'}
        </Text>
        {signoff.signature ? (
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 6,
              fontSize: 13,
              color: theme.colors.text.secondary,
              fontFamily: theme.fonts.sans,
            }}
          >
            {signoff.closed_by_role || 'Duty Manager'} · {formatTime(signoff.signed_at || signoff.created_at)}
          </Text>
        ) : (
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 6,
              fontSize: 13,
              color: theme.colors.text.secondary,
              fontFamily: theme.fonts.sans,
            }}
          >
            Reason: {signoff.override_reason}
          </Text>
        )}
        <View style={styles.metaStrip}>
          <Eyebrow tracking={1.8} color={theme.colors.text.tertiary}>
            {signoff.total_checks} check{signoff.total_checks === 1 ? '' : 's'} · {signoff.total_missed} missed
          </Eyebrow>
        </View>
      </GlassCard>
    );
  }

  // Open — show countdown / overdue / not-started
  const overdue = minutesUntilDue !== null && minutesUntilDue <= 0;
  const idle = !hasChecks && (minutesUntilDue === null || minutesUntilDue > 0);

  const bigNumber = overdue
    ? Math.abs(minutesUntilDue!)
    : minutesUntilDue !== null
      ? minutesUntilDue
      : intervalMin;

  const eyebrowText = overdue
    ? `Overdue · ${Math.abs(minutesUntilDue!)} min ago`
    : idle
      ? 'No checks logged yet'
      : 'Next check in';

  const accent = overdue ? theme.colors.accent : theme.colors.text.primary;

  return (
    <View style={{ marginTop: 22 }}>
      <GlassCard
        style={{
          padding: 22,
          borderColor: overdue ? theme.colors.accentBorder : theme.colors.surface.hairline,
          backgroundColor: overdue ? theme.colors.accentSoft : theme.colors.surface.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AccentDot
            pulse={overdue}
            color={overdue ? theme.colors.accent : theme.colors.text.secondary}
            size={6}
          />
          <Eyebrow color={overdue ? theme.colors.accent : theme.colors.text.secondary}>
            {eyebrowText}
          </Eyebrow>
        </View>

        <View style={styles.bigNumberRow}>
          <Text
            allowFontScaling={false}
            style={{
              fontSize: 84,
              fontFamily: theme.fonts.sans,
              fontWeight: '300',
              letterSpacing: -3,
              lineHeight: 88,
              color: accent,
            }}
          >
            {idle ? '—' : bigNumber}
          </Text>
          {!idle ? (
            <View style={{ marginLeft: 10, paddingBottom: 14 }}>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 11,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: theme.colors.text.secondary,
                }}
              >
                Min
              </Text>
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 4,
                  fontFamily: theme.fonts.mono,
                  fontSize: 11,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: theme.colors.text.tertiary,
                }}
              >
                {overdue ? 'Past due' : 'Remaining'}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          allowFontScaling={false}
          style={{
            marginTop: 4,
            fontSize: 13,
            color: theme.colors.text.secondary,
            fontFamily: theme.fonts.sans,
          }}
        >
          {overdue
            ? 'Log a count now to keep the audit trail intact.'
            : idle
              ? `First count is due ${intervalMin} min after shift start.`
              : `Counts are logged every ${intervalMin} minutes.`}
        </Text>

        <View style={{ marginTop: 18 }}>
          <PrimaryCTA
            label={overdue ? 'Log capacity now · overdue' : 'Log capacity now'}
            onPress={onLogCheck}
            accessibilityLabel="Log a capacity check now"
          />
        </View>

        <Pressable
          onPress={onSignoff}
          accessibilityRole="button"
          accessibilityLabel="Sign off logbook"
          style={({ pressed }) => [
            styles.ghostBtn,
            {
              borderColor: theme.colors.surface.hairlineStrong,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M4 17 L20 17 M6 14 c 4 -8 6 -8 12 0"
              stroke={theme.colors.text.primary}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text
            allowFontScaling={false}
            style={{
              marginLeft: 8,
              fontSize: 14,
              fontWeight: '500',
              color: theme.colors.text.primary,
              fontFamily: theme.fonts.sans,
              letterSpacing: -0.2,
            }}
          >
            Sign off logbook
          </Text>
        </Pressable>
      </GlassCard>
    </View>
  );
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  heading: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  bigNumberRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  metaStrip: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(127,127,127,0.15)',
  },
  ghostBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CapacityLogbookScreen;
