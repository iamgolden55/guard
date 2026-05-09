/**
 * IncidentReportScreenV2 — Phase 4 re-skin of the incident type picker.
 * Preserves navigation wiring to IncidentForm with route param shiftId and
 * prefilled type/severity handoff.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import type { IncidentTypeOption } from '../../../types/incident';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface IncidentCardSpec extends IncidentTypeOption {
  sub: string;
  d: string;
  sev: Severity;
}

const INCIDENT_TYPES: IncidentCardSpec[] = [
  {
    type: 'medical_emergency',
    icon: 'medical-outline',
    label: 'Medical',
    color: '#EF4444',
    severity: 'critical',
    sub: 'Emergency · 999',
    sev: 'critical',
    d: 'M12 4 V20 M4 12 H20',
  },
  {
    type: 'fire_alarm',
    icon: 'flame-outline',
    label: 'Fire alarm',
    color: '#F59E0B',
    severity: 'critical',
    sub: 'Evacuation',
    sev: 'critical',
    d: 'M12 2 C 8 6 6 10 6 14 a6 6 0 0 0 12 0 c 0 -4 -2 -8 -6 -12 Z',
  },
  {
    type: 'security_breach',
    icon: 'shield-outline',
    label: 'Security breach',
    color: '#EF4444',
    severity: 'high',
    sub: 'Unauthorised access',
    sev: 'high',
    d: 'M12 2 L2 6 v6 c0 5 4 8 10 9 6 -1 10 -4 10 -9 V6 Z',
  },
  {
    type: 'assault',
    icon: 'alert-circle-outline',
    label: 'Assault',
    color: '#EF4444',
    severity: 'critical',
    sub: 'Physical altercation',
    sev: 'high',
    d: 'M13 2 L11 14 h4 L9 22 l2 -10 h-4 Z',
  },
  {
    type: 'suspicious_activity',
    icon: 'eye-outline',
    label: 'Suspicious',
    color: '#F59E0B',
    severity: 'medium',
    sub: 'Activity / person',
    sev: 'medium',
    d: 'M12 5 a7 7 0 1 0 0 14 a7 7 0 0 0 0 -14 M12 9 V13 M12 16 h.01',
  },
  {
    type: 'property_damage',
    icon: 'hammer-outline',
    label: 'Property',
    color: '#6B7280',
    severity: 'medium',
    sub: 'Damage / theft',
    sev: 'medium',
    d: 'M4 10 L12 4 L20 10 V20 H4 Z M10 20 V14 h4 V20',
  },
];

const SEVERITY_PALETTE: Record<
  Severity,
  { fg: string; bg: string; bd: string; label: string }
> = {
  critical: {
    fg: '#E1342C',
    bg: 'rgba(225,52,44,0.16)',
    bd: 'rgba(225,52,44,0.45)',
    label: 'Critical',
  },
  high: {
    fg: '#fb923c',
    bg: 'rgba(251,146,60,0.14)',
    bd: 'rgba(251,146,60,0.38)',
    label: 'High',
  },
  medium: {
    fg: '#facc15',
    bg: 'rgba(250,204,21,0.12)',
    bd: 'rgba(250,204,21,0.34)',
    label: 'Medium',
  },
  low: {
    fg: '#9ca3af',
    bg: 'rgba(156,163,175,0.12)',
    bd: 'rgba(156,163,175,0.32)',
    label: 'Low',
  },
};

export const IncidentReportScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { shiftId, venueId } =
    (route.params as { shiftId: number; venueId: number }) || {};
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const handleQuickReport = (incident: IncidentCardSpec) => {
    logger.info('[IncidentReport] Quick report selected', { type: incident.type });
    navigation.navigate('IncidentForm', {
      shiftId,
      venueId,
      prefilledType: incident.type,
      prefilledSeverity: incident.severity,
    });
  };

  const handleDetailedReport = () => {
    logger.info('[IncidentReport] Detailed report selected');
    navigation.navigate('IncidentForm', { shiftId, venueId });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingHorizontal: 20,
          paddingBottom: 40 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow color={theme.colors.accent}>Report · Step 1 of 2</Eyebrow>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 12,
            fontSize: 30,
            color: theme.colors.text.primary,
            fontWeight: '400',
            letterSpacing: -0.9,
            lineHeight: 36,
          }}
        >
          What happened?
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 10,
            fontSize: 14,
            color: theme.colors.text.secondary,
            lineHeight: 22,
          }}
        >
          Pick a type. You'll add detail, photos and witnesses in the next step.
        </Text>

        {/* Emergency banner */}
        <View
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.accentSoft,
            borderWidth: 1,
            borderColor: theme.colors.accentBorder,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: theme.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3 L2 21 H22 Z M12 9 V14 M12 17 h.01"
                stroke="#fff"
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
          <Text
            allowFontScaling={false}
            style={{
              flex: 1,
              fontSize: 13,
              color: theme.colors.accent,
              fontWeight: '500',
              lineHeight: 18,
            }}
          >
            Emergency? Call 999 first, then report here.
          </Text>
        </View>

        {/* Grid */}
        <Eyebrow style={{ marginTop: 22, marginLeft: 4, marginBottom: 10 }}>
          Quick report
        </Eyebrow>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 10,
          }}
        >
          {INCIDENT_TYPES.map((t) => (
            <IncidentCard
              key={t.type}
              spec={t}
              onPress={() => handleQuickReport(t)}
            />
          ))}
        </View>

        {/* Detailed form */}
        <Eyebrow style={{ marginTop: 20, marginLeft: 4, marginBottom: 10 }}>
          Other options
        </Eyebrow>
        <Pressable
          onPress={handleDetailedReport}
          style={({ pressed }) => ({
            padding: 14,
            borderRadius: theme.radii.xl,
            backgroundColor: theme.colors.surface.card,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 3 H16 L20 7 V21 H6 Z M6 7 H16 M9 13 H17 M9 17 H15"
                stroke={theme.colors.text.primary}
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 15,
                color: theme.colors.text.primary,
                fontWeight: '500',
                letterSpacing: -0.2,
              }}
            >
              Detailed form
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 2,
                fontSize: 12,
                color: theme.colors.text.secondary,
              }}
            >
              Fill out a comprehensive incident report
            </Text>
          </View>
          <Svg width={7} height={12} viewBox="0 0 8 14">
            <Path
              d="M1 1l6 6-6 6"
              stroke={theme.colors.text.tertiary}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>

        {/* Footer info */}
        <GlassCard
          style={{
            marginTop: 20,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2 C 8 2 5 5 5 9 c 0 5 7 13 7 13 s 7 -8 7 -13 c 0 -4 -3 -7 -7 -7 z M12 11 a2 2 0 1 0 0 -4 a2 2 0 0 0 0 4 z"
              stroke={theme.colors.text.tertiary}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text
            allowFontScaling={false}
            style={{
              flex: 1,
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.4,
              color: theme.colors.text.tertiary,
            }}
          >
            All incidents include automatic timestamps and location.
          </Text>
        </GlassCard>
      </ScrollView>

      {/* Back button */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [
          styles.navBtn,
          {
            top: insets.top + 12,
            backgroundColor: theme.colors.surface.chip,
            borderColor: theme.colors.surface.hairline,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Svg width={10} height={16} viewBox="0 0 10 16">
          <Path
            d="M8 2 L2 8 L8 14"
            stroke={theme.colors.text.primary}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
};

const IncidentCard: React.FC<{
  spec: IncidentCardSpec;
  onPress: () => void;
}> = ({ spec, onPress }) => {
  const theme = useRedesignTheme();
  const palette = SEVERITY_PALETTE[spec.sev];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48.5%',
        padding: 14,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface.card,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        opacity: pressed ? 0.85 : 1,
        position: 'relative',
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.bd,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d={spec.d}
            stroke={palette.fg}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 12,
          fontSize: 14,
          color: theme.colors.text.primary,
          fontWeight: '500',
          letterSpacing: -0.2,
        }}
      >
        {spec.label}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 2,
          fontSize: 11,
          color: theme.colors.text.tertiary,
        }}
      >
        {spec.sub}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          fontFamily: theme.fonts.mono,
          fontSize: 8,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: palette.fg,
          fontWeight: '500',
        }}
      >
        {palette.label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IncidentReportScreenV2;
