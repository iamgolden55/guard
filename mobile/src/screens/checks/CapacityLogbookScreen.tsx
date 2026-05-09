/**
 * Capacity Logbook Screen
 *
 * Read view of the digital capacity-check logbook for a shift_group.
 * Shows a chronological audit trail of CapacityCheck entries and missed
 * 30-minute slots, plus a countdown to the next due check (or a "Sign off
 * logbook" CTA when the shift is wrapping up). Subscribes to the WS
 * capacity_event channel to live-refresh as teammates log counts.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Heading3, Body, BodySmall, Card, Button } from '@components/ui';
import { useAppSelector } from '../../hooks/useRedux';
import { selectActiveShift } from '../../store/slices/shiftsSlice';
import { colors, getColors, spacing } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
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

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'CapacityLogbook'>;
type RouteProps = RouteProp<MainStackParamList, 'CapacityLogbook'>;

type TimelineEntry =
  | { kind: 'check'; at: string; data: CapacityCheck }
  | { kind: 'miss'; at: string; data: CapacityCheckSlotMiss };

export const CapacityLogbookScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId, shiftGroup: routeShiftGroup } = route.params;
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);
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

  // Live refresh on WS events for our shift_group
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

  // Build a single chronological timeline (newest first).
  const timeline: TimelineEntry[] = useMemo(() => {
    const entries: TimelineEntry[] = [
      ...checks.map<TimelineEntry>((c) => ({ kind: 'check', at: c.timestamp, data: c })),
      ...misses.map<TimelineEntry>((m) => ({ kind: 'miss', at: m.expected_at, data: m })),
    ];
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [checks, misses]);

  // Compute next-due time from the latest check (or shift start if none).
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

  const minutesUntilDue: number | null = useMemo(() => {
    if (!nextDueAt) return null;
    return Math.round((nextDueAt.getTime() - Date.now()) / 60000);
  }, [nextDueAt]);

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

  return (
    <Container scrollable={false} safeArea style={[styles.container, { backgroundColor: themeColors.background.secondary }]}>
      <View style={[styles.header, { backgroundColor: themeColors.background.primary, borderBottomColor: themeColors.border.light }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Heading2>Capacity Logbook</Heading2>
          <Body color={themeColors.text.secondary}>{venueName}</Body>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Status / countdown card */}
        <Card variant="elevated" padding="lg" style={styles.statusCard}>
          {signoff ? (
            <View>
              <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={28} color={themeColors.success} />
                <Heading3 style={styles.statusTitle}>Logbook closed</Heading3>
              </View>
              {signoff.signature ? (
                <Body color={themeColors.text.secondary}>
                  Signed by {signoff.closed_by_name}
                  {signoff.closed_by_role ? ` (${signoff.closed_by_role})` : ''} at{' '}
                  {formatTime(signoff.signed_at || signoff.created_at)}
                </Body>
              ) : (
                <Body color={themeColors.text.secondary}>
                  Closed via override: {signoff.override_reason}
                </Body>
              )}
              <BodySmall color={themeColors.text.tertiary} style={styles.statusFooter}>
                {signoff.total_checks} check{signoff.total_checks === 1 ? '' : 's'} ·{' '}
                {signoff.total_missed} missed
              </BodySmall>
            </View>
          ) : (
            <View>
              <View style={styles.statusRow}>
                <Ionicons name="time" size={28} color={themeColors.primary} />
                <Heading3 style={styles.statusTitle}>
                  {minutesUntilDue !== null && minutesUntilDue > 0
                    ? `Next check in ${minutesUntilDue} min`
                    : minutesUntilDue !== null && minutesUntilDue <= 0
                      ? 'Check is due now'
                      : 'No checks logged yet'}
                </Heading3>
              </View>
              <Body color={themeColors.text.secondary}>
                Capacity {venueCapacity} · check every {intervalMin} min
              </Body>
              <View style={styles.actionsRow}>
                <Button
                  title="Log capacity now"
                  variant="primary"
                  size="medium"
                  onPress={() =>
                    navigation.navigate('CapacityCheck', { shiftId, checkType: 'capacity' })
                  }
                  style={styles.actionButton}
                />
                <Button
                  title="Sign off logbook"
                  variant="secondary"
                  size="medium"
                  onPress={handleOpenSignoff}
                  style={styles.actionButton}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Timeline */}
        <View style={styles.timelineHeader}>
          <Heading3>Timeline</Heading3>
          <BodySmall color={themeColors.text.secondary}>
            {checks.length} logged · {misses.length} missed
          </BodySmall>
        </View>

        {timeline.length === 0 && !loading && (
          <Card variant="flat" padding="lg" style={styles.emptyCard}>
            <Body color={themeColors.text.secondary} style={styles.emptyText}>
              No capacity checks logged yet. The first one is due {intervalMin} min after shift start.
            </Body>
          </Card>
        )}

        {timeline.map((entry, idx) => (
          <Card
            key={`${entry.kind}-${entry.kind === 'check' ? entry.data.id : entry.data.id}-${idx}`}
            variant="flat"
            padding="md"
            style={[
              styles.entryCard,
              entry.kind === 'miss' && styles.entryCardMissed,
            ]}
          >
            <View style={styles.entryRow}>
              <View
                style={[
                  styles.entryIcon,
                  entry.kind === 'miss'
                    ? { backgroundColor: themeColors.error + '20' }
                    : entry.data.is_at_capacity
                      ? { backgroundColor: themeColors.warning + '20' }
                      : { backgroundColor: themeColors.success + '20' },
                ]}
              >
                <Ionicons
                  name={entry.kind === 'miss' ? 'alert-circle' : 'people'}
                  size={20}
                  color={
                    entry.kind === 'miss'
                      ? themeColors.error
                      : entry.data.is_at_capacity
                        ? themeColors.warning
                        : themeColors.success
                  }
                />
              </View>

              <View style={styles.entryBody}>
                {entry.kind === 'check' ? (
                  <>
                    <Body style={styles.entryTitle}>
                      {entry.data.current_count} / {entry.data.venue_capacity}
                      {entry.data.is_at_capacity && '  · AT CAPACITY'}
                    </Body>
                    <BodySmall color={themeColors.text.secondary}>
                      {formatTime(entry.data.timestamp)}
                      {entry.data.performed_by_details &&
                        ` · ${entry.data.performed_by_details.first_name} ${entry.data.performed_by_details.last_name?.charAt(0) || ''}.`}
                    </BodySmall>
                    {entry.data.action_taken ? (
                      <BodySmall color={themeColors.text.tertiary} style={styles.entryAction}>
                        Action: {entry.data.action_taken}
                      </BodySmall>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Body style={[styles.entryTitle, { color: themeColors.error }]}>
                      Missed slot · {formatTime(entry.data.expected_at)}
                    </Body>
                    {entry.data.acknowledged ? (
                      <BodySmall color={themeColors.text.secondary}>
                        Reason: {entry.data.acknowledgement_reason}
                      </BodySmall>
                    ) : (
                      <TouchableOpacity onPress={() => handleAcknowledgeMiss(entry.data)}>
                        <BodySmall color={themeColors.primary} style={styles.entryAction}>
                          Add reason
                        </BodySmall>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

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
    </Container>
  );
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: { padding: spacing.sm, marginRight: spacing.md },
  headerContent: { flex: 1 },
  content: { flex: 1, padding: spacing.lg },
  statusCard: { marginBottom: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  statusTitle: { marginLeft: spacing.md, flex: 1 },
  statusFooter: { marginTop: spacing.sm },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: { flex: 1 },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  emptyCard: { backgroundColor: colors.gray[100], marginBottom: spacing.md },
  emptyText: { textAlign: 'center' },
  entryCard: { marginBottom: spacing.sm },
  entryCardMissed: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start' },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryBody: { flex: 1, marginLeft: spacing.md },
  entryTitle: { fontWeight: '600', marginBottom: 2 },
  entryAction: { marginTop: 4 },
});
