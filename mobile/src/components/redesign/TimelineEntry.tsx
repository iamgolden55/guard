/**
 * TimelineEntry — shared row used by the Capacity Logbook timeline.
 *
 * Visual:
 *   ┌── 14:30 ────────────┐
 *   │ ●  142 / 200       │   ← leading dot, count primary, capacity ratio
 *   │    Priya S.         │   ← attribution (mono, secondary)
 *   │    Action: paused   │   ← optional accessory line
 *   └─────────────────────┘
 *
 * The dot doubles as the icon. A 1px rail runs through the dot to give the
 * row a "timeline" feel; pass `isLast` to suppress the trailing rail.
 *
 * Lives in components/redesign/ alongside the other shared atoms so any
 * future audit/log screen can reuse it.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRedesignTheme } from '../../theme/redesign';
import { Eyebrow } from './atoms';

export type TimelineEntryKind = 'check' | 'miss';

interface TimelineEntryProps {
  kind: TimelineEntryKind;
  /** ISO timestamp shown in the eyebrow at the top of the row. */
  time: string;
  /** Primary headline (e.g. "142 / 200" or "Missed slot"). */
  primary: string;
  /** Secondary line (e.g. "Priya S. · 2 min ago"). */
  secondary?: string;
  /**
   * Optional third line below secondary — used for "Action: paused entry"
   * on capacity hits or "Reason: …" on acknowledged misses.
   */
  detail?: string;
  /** Tap target on the right edge — used by "Add reason" on unacknowledged misses. */
  action?: { label: string; onPress: () => void };
  /** Tints the dot + headline red, e.g. when at-capacity or unacknowledged miss. */
  emphasis?: 'neutral' | 'warning' | 'critical';
  /** Suppresses the trailing rail (last item in the list). */
  isLast?: boolean;
  /** Suppresses the leading rail (first item). */
  isFirst?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const TimelineEntry: React.FC<TimelineEntryProps> = ({
  kind,
  time,
  primary,
  secondary,
  detail,
  action,
  emphasis = 'neutral',
  isFirst = false,
  isLast = false,
  style,
}) => {
  const theme = useRedesignTheme();

  const dotColor =
    emphasis === 'critical'
      ? theme.colors.accent
      : emphasis === 'warning'
        ? theme.colors.accent
        : theme.colors.text.primary;

  const dotBg =
    emphasis === 'critical' || emphasis === 'warning'
      ? theme.colors.accentSoft
      : theme.colors.surface.chip;

  const dotBorder =
    emphasis === 'critical' || emphasis === 'warning'
      ? theme.colors.accentBorder
      : theme.colors.surface.hairlineStrong;

  const headlineColor =
    emphasis === 'critical' ? theme.colors.accent : theme.colors.text.primary;

  return (
    <View style={[styles.row, style]}>
      {/* Rail column */}
      <View style={styles.railCol} accessibilityElementsHidden>
        <View
          style={[
            styles.rail,
            styles.railTop,
            { backgroundColor: isFirst ? 'transparent' : theme.colors.surface.hairlineStrong },
          ]}
        />
        <View
          style={[
            styles.dot,
            {
              backgroundColor: dotBg,
              borderColor: dotBorder,
            },
          ]}
        >
          {kind === 'check' ? (
            <Svg width={12} height={12} viewBox="0 0 16 16">
              {/* slim clock */}
              <Circle cx="8" cy="8" r="6.2" stroke={dotColor} strokeWidth={1.4} fill="none" />
              <Path
                d="M8 4.6 V8 L10.4 9.6"
                stroke={dotColor}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          ) : (
            <Svg width={12} height={12} viewBox="0 0 16 16">
              {/* slim alert triangle */}
              <Path
                d="M8 2.5 L14 13 H2 Z"
                stroke={dotColor}
                strokeWidth={1.4}
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d="M8 6.4 V9.4 M8 11.2 V11.2"
                stroke={dotColor}
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            </Svg>
          )}
        </View>
        <View
          style={[
            styles.rail,
            styles.railBottom,
            { backgroundColor: isLast ? 'transparent' : theme.colors.surface.hairlineStrong },
          ]}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Eyebrow tracking={1.8} color={theme.colors.text.tertiary}>
          {formatClock(time)}
        </Eyebrow>
        <View style={styles.primaryRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: theme.fonts.sans,
              fontSize: 17,
              fontWeight: '500',
              letterSpacing: -0.3,
              color: headlineColor,
              marginTop: 4,
            }}
          >
            {primary}
          </Text>
          {action ? (
            <Pressable
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionPill,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderColor: theme.colors.accentBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: theme.colors.accent,
                  fontWeight: '500',
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {secondary ? (
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 2,
              fontFamily: theme.fonts.sans,
              fontSize: 13,
              color: theme.colors.text.secondary,
            }}
          >
            {secondary}
          </Text>
        ) : null}

        {detail ? (
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 6,
              fontFamily: theme.fonts.sans,
              fontSize: 12,
              lineHeight: 17,
              color: theme.colors.text.tertiary,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(/\s/g, '');
}

const RAIL_COL_WIDTH = 28;
const DOT_SIZE = 22;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: 64,
  },
  railCol: {
    width: RAIL_COL_WIDTH,
    alignItems: 'center',
  },
  rail: {
    width: 1,
    flexGrow: 0,
  },
  railTop: {
    height: 8,
  },
  railBottom: {
    flex: 1,
    minHeight: 8,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 18,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TimelineEntry;
