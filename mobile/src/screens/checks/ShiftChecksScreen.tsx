/**
 * Shift Checks Screen — redesign aligned with the Capacity / dashboard V2 visual language.
 *
 * Dashboard listing the venue safety checks required for the active shift.
 * Visuals are drawn from the same redesign tokens (Geist-like sans, warm
 * paper canvas / near-black dark, red accent, GlassCards, hairline borders,
 * slim SVG iconography). Functionality is unchanged from the prior version.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAppSelector } from '../../hooks/useRedux';
import { selectActiveShift } from '../../store/slices/shiftsSlice';
import { logger } from '../../utils/logger';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { shiftChecksService } from '../../services/shiftChecksService';
import { useRedesignTheme, RedesignTheme } from '../../theme/redesign';
import { Eyebrow, GlassCard, NavBack } from '../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'ShiftChecks'>;
type RouteProps = RouteProp<MainStackParamList, 'ShiftChecks'>;

type CheckIconKind = 'fire' | 'capacity' | 'toilet';

interface CheckItem {
  id: string;
  title: string;
  iconKind: CheckIconKind;
  required: boolean;
  completed: boolean;
  route: keyof MainStackParamList;
  performedBy?: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
  timestamp?: string;
}

export const ShiftChecksScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId } = route.params;
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const activeShift = useAppSelector(selectActiveShift);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<CheckItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      logger.info('[ShiftChecks] Screen focused, loading checks', { shiftId });
      loadChecks();
    }, [shiftId])
  );

  const loadChecks = async () => {
    try {
      setLoading(true);

      const shiftChecks = await shiftChecksService.getShiftChecks(shiftId);

      const availableChecks: CheckItem[] = [];
      const latestFireExitCheck = shiftChecks.fireExitChecks[0];
      const latestCapacityCheck = shiftChecks.capacityChecks[0];
      const latestToiletCheck = shiftChecks.toiletChecks[0];

      if (activeShift?.venue.requires_fire_exit_check) {
        availableChecks.push({
          id: 'fire_exit',
          title: 'Fire Exit Check',
          iconKind: 'fire',
          required: true,
          completed: shiftChecks.fireExitChecks.length > 0,
          route: 'FireExitCheck' as keyof MainStackParamList,
          performedBy: latestFireExitCheck?.performed_by_details || null,
          timestamp: latestFireExitCheck?.timestamp,
        });
      }

      if (activeShift?.venue.requires_capacity_check) {
        availableChecks.push({
          id: 'capacity',
          title: 'Capacity Check',
          iconKind: 'capacity',
          required: true,
          completed: shiftChecks.capacityChecks.length > 0,
          route: 'CapacityCheck' as keyof MainStackParamList,
          performedBy: latestCapacityCheck?.performed_by_details || null,
          timestamp: latestCapacityCheck?.timestamp,
        });
      }

      availableChecks.push({
        id: 'toilet',
        title: 'Toilet Check',
        iconKind: 'toilet',
        required: false,
        completed: shiftChecks.toiletChecks.length > 0,
        route: 'ToiletCheck' as keyof MainStackParamList,
        performedBy: latestToiletCheck?.performed_by_details || null,
        timestamp: latestToiletCheck?.timestamp,
      });

      setChecks(availableChecks);
      logger.info('[ShiftChecks] Loaded checks', {
        totalChecks: availableChecks.length,
        completed: availableChecks.filter((c) => c.completed).length,
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
    navigation.navigate(check.route as any, {
      shiftId,
      checkType: check.id,
    });
  };

  const handleClose = () => {
    logger.info('[ShiftChecks] Closing screen');
    navigation.goBack();
  };

  const completedCount = checks.filter((c) => c.completed).length;
  const totalCount = checks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const venueName = activeShift?.venue.name || 'Venue';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 32 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <NavBack onPress={handleClose} />
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
              {completedCount} of {totalCount} done
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
            Shift checks
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
            {allDone
              ? 'All required checks logged for this shift.'
              : 'Complete every required check before signing off.'}
          </Text>
        </View>

        {/* Progress hero */}
        <GlassCard
          style={{
            marginTop: 22,
            padding: 22,
            borderColor: allDone ? theme.colors.accentBorder : theme.colors.surface.hairline,
            backgroundColor: allDone ? theme.colors.accentSoft : theme.colors.surface.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {allDone ? (
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
            ) : null}
            <Eyebrow color={allDone ? theme.colors.accent : theme.colors.text.secondary}>
              {allDone ? 'All checks logged' : 'Progress'}
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
                color: allDone ? theme.colors.accent : theme.colors.text.primary,
              }}
            >
              {completedCount}
            </Text>
            <View style={{ marginLeft: 10, paddingBottom: 14 }}>
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 28,
                  fontFamily: theme.fonts.sans,
                  fontWeight: '300',
                  color: theme.colors.text.tertiary,
                  letterSpacing: -0.6,
                }}
              >
                / {totalCount}
              </Text>
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 4,
                  fontFamily: theme.fonts.mono,
                  fontSize: 11,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: theme.colors.text.secondary,
                }}
              >
                Logged
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View
            style={[
              styles.bar,
              {
                backgroundColor: theme.colors.surface.chip,
                borderColor: theme.colors.surface.hairline,
              },
            ]}
          >
            <View
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: theme.colors.accent,
                borderRadius: 4,
              }}
            />
          </View>
        </GlassCard>

        {/* Checks list */}
        {checks.length === 0 && !loading ? (
          <GlassCard style={{ marginTop: 22, alignItems: 'center', paddingVertical: 32 }}>
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
                  d="M3 12 L9 18 L21 6"
                  stroke={theme.colors.text.secondary}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
              No checks required
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
              This venue does not require any safety checks.
            </Text>
          </GlassCard>
        ) : null}

        {checks.length > 0 ? (
          <View style={{ marginTop: 28, marginBottom: 6, marginLeft: 4 }}>
            <Eyebrow>Checks</Eyebrow>
          </View>
        ) : null}

        {checks.map((check, index) => (
          <CheckRow
            key={check.id}
            check={check}
            theme={theme}
            isLast={index === checks.length - 1}
            onPress={() => handleCheckPress(check)}
          />
        ))}

        {/* Capacity Logbook CTA */}
        {activeShift?.venue.requires_capacity_check ? (
          <Pressable
            onPress={() => navigation.navigate('CapacityLogbook' as any, { shiftId })}
            accessibilityRole="button"
            accessibilityLabel="Open capacity logbook"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginTop: 18 }]}
          >
            <GlassCard
              style={{
                padding: 18,
                borderColor: theme.colors.accentBorder,
                backgroundColor: theme.colors.accentSoft,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: theme.colors.accentBorder,
                    backgroundColor: theme.colors.canvas,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path
                      d="M4 5 a2 2 0 0 1 2 -2 h6 v18 h-6 a2 2 0 0 1 -2 -2 z M20 5 a2 2 0 0 0 -2 -2 h-6 v18 h6 a2 2 0 0 0 2 -2 z"
                      stroke={theme.colors.accent}
                      strokeWidth={1.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Eyebrow color={theme.colors.accent}>Audit trail</Eyebrow>
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 4,
                      fontSize: 16,
                      fontWeight: '500',
                      color: theme.colors.text.primary,
                      fontFamily: theme.fonts.sans,
                      letterSpacing: -0.2,
                    }}
                  >
                    Capacity logbook
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 2,
                      fontSize: 13,
                      color: theme.colors.text.secondary,
                      fontFamily: theme.fonts.sans,
                    }}
                  >
                    View timeline & sign off at end of shift
                  </Text>
                </View>
                <Svg width={14} height={14} viewBox="0 0 16 16">
                  <Path
                    d="M5 3 L11 8 L5 13"
                    stroke={theme.colors.accent}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </GlassCard>
          </Pressable>
        ) : null}

        {/* Helper note */}
        <View style={{ marginTop: 24, paddingHorizontal: 4 }}>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: theme.colors.text.tertiary,
            }}
          >
            About safety checks
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 8,
              fontSize: 13,
              lineHeight: 19,
              color: theme.colors.text.secondary,
              fontFamily: theme.fonts.sans,
            }}
          >
            Safety checks confirm the venue meets security standards. Complete every required
            check during your shift; you can update them at any time.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Check row
// ─────────────────────────────────────────────────────────────
interface CheckRowProps {
  check: CheckItem;
  theme: RedesignTheme;
  isLast: boolean;
  onPress: () => void;
}

const CheckRow: React.FC<CheckRowProps> = ({ check, theme, isLast, onPress }) => {
  const completed = check.completed;

  const performerLabel = check.performedBy
    ? `${check.performedBy.first_name} ${check.performedBy.last_name?.charAt(0) || ''}.`.trim()
    : null;

  const timeLabel = check.timestamp
    ? new Date(check.timestamp).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const secondaryLine = completed
    ? performerLabel
      ? `Completed by ${performerLabel}${timeLabel ? ` · ${timeLabel}` : ''}`
      : `Completed${timeLabel ? ` · ${timeLabel}` : ''}`
    : 'Not completed yet';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${check.title}`}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginBottom: isLast ? 0 : 12 }]}
    >
      <GlassCard
        style={{
          padding: 18,
          borderColor: completed ? theme.colors.accentBorder : theme.colors.surface.hairline,
          backgroundColor: completed ? theme.colors.accentSoft : theme.colors.surface.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Leading icon */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: completed
                ? theme.colors.accentBorder
                : theme.colors.surface.hairlineStrong,
              backgroundColor: completed
                ? theme.colors.canvas
                : theme.colors.surface.chip,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon
              kind={check.iconKind}
              color={completed ? theme.colors.accent : theme.colors.text.primary}
            />
          </View>

          {/* Body */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.sans,
                  fontSize: 16,
                  fontWeight: '500',
                  letterSpacing: -0.2,
                  color: theme.colors.text.primary,
                }}
              >
                {check.title}
              </Text>
              {check.required ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: theme.colors.accentBorder,
                    backgroundColor: completed
                      ? theme.colors.canvas
                      : theme.colors.accentSoft,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 9,
                      letterSpacing: 1.6,
                      textTransform: 'uppercase',
                      color: theme.colors.accent,
                      fontWeight: '500',
                    }}
                  >
                    Required
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
              {secondaryLine}
            </Text>
          </View>

          {/* Trailing affordance */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: completed ? theme.colors.accent : 'transparent',
            }}
          >
            {completed ? (
              <Svg width={12} height={12} viewBox="0 0 16 16">
                <Path
                  d="M3 8 L7 12 L13 4"
                  stroke="#fff"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : (
              <Svg width={12} height={12} viewBox="0 0 16 16">
                <Path
                  d="M5 3 L11 8 L5 13"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// Slim line-art icons matching the Capacity screens' iconography
// ─────────────────────────────────────────────────────────────
const CheckIcon: React.FC<{ kind: CheckIconKind; color: string }> = ({ kind, color }) => {
  if (kind === 'fire') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path
          d="M12 3 c 1 4 5 5 5 10 a5 5 0 0 1 -10 0 c 0 -3 2 -4 3 -7 c 1 2 2 2 2 -3 z"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (kind === 'capacity') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Circle cx="9" cy="8" r="3" stroke={color} strokeWidth={1.5} fill="none" />
        <Circle cx="17" cy="9" r="2.4" stroke={color} strokeWidth={1.5} fill="none" />
        <Path
          d="M3 19 c 0 -3 3 -5 6 -5 s 6 2 6 5"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M15 19 c 0 -2 2 -4 5 -4"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  // toilet — water droplet
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M12 3 c 4 5 6 8 6 11 a6 6 0 0 1 -12 0 c 0 -3 2 -6 6 -11 z"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
};

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
  bar: {
    marginTop: 14,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
});

export default ShiftChecksScreen;
