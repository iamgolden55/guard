/**
 * TeamMemberProfileScreenV2 — Read-only team member profile, re-skinned to
 * match the Phase 4 profile design (dark canvas / light paper, ambient red
 * glow, avatar hero, stat strip, menu cards).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import type { MainStackParamList } from '../../../types/navigation';
import { useRedesignTheme } from '../../../theme/redesign';
import {
  AccentDot,
  AmbientGlow,
  Eyebrow,
  GlassCard,
  NavBack,
} from '../../../components/redesign';

type ProfileRoute = RouteProp<MainStackParamList, 'TeamMemberProfile'>;

const ROLE_LABEL: Record<string, string> = {
  ds: 'Door supervisor',
  sg: 'Security guard',
  cctv: 'CCTV operator',
  cp: 'Close protection',
  steward: 'Steward',
  k9: 'Dog handler',
  retail: 'Retail security',
  static: 'Static guard',
  mobile: 'Mobile patrol',
  event: 'Event security',
};

const LICENSE_LABEL: Record<string, string> = {
  ds: 'Door Supervision',
  sg: 'Security Guarding',
  cctv: 'Public Space CCTV',
  cp: 'Close Protection',
  vi: 'Vehicle Immobiliser',
  ki: 'Key Holding',
};

const formatTime = (iso?: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getInitial = (name: string) => {
  const parts = (name || '').trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase() || '?';
};

export const TeamMemberProfileScreenV2: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ProfileRoute>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const {
    name,
    role,
    photo,
    currentVenue,
    securityRoles = [],
    employmentType,
    siaLicenseTypes = [],
    isOnShift,
    activeShift,
  } = route.params;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Ambient red radial glow above the avatar */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          left: '50%',
          transform: [{ translateX: -210 }],
        }}
      >
        <AmbientGlow size={420} intensity={theme.isDark ? 0.26 : 0.18} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 72,
          paddingHorizontal: 20,
          paddingBottom: 40 + insets.bottom,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(11,11,14,0.06)',
                  borderWidth: 1.5,
                  borderColor: theme.colors.surface.hairlineStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 34,
                  fontWeight: '300',
                  letterSpacing: -0.4,
                  color: theme.colors.text.primary,
                }}
              >
                {getInitial(name)}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.presenceRing,
              {
                borderColor: theme.colors.canvas,
                backgroundColor: isOnShift ? '#4ade80' : theme.colors.text.tertiary,
              },
            ]}
          />
        </View>

        <Text
          allowFontScaling={false}
          style={{
            marginTop: 14,
            fontSize: 22,
            color: theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.4,
          }}
        >
          {name}
        </Text>
        {role ? (
          <Eyebrow style={{ marginTop: 6 }}>{role}</Eyebrow>
        ) : null}

        {/* Status chip */}
        {isOnShift ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: theme.colors.accentSoft,
              borderWidth: 1,
              borderColor: theme.colors.accentBorder,
            }}
          >
            <AccentDot size={5} pulse />
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 9,
                color: theme.colors.accent,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                fontWeight: '500',
              }}
            >
              On shift
              {activeShift?.venue_name || currentVenue
                ? ` · ${activeShift?.venue_name || currentVenue}`
                : ''}
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
            }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: theme.colors.text.tertiary,
              }}
            />
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 9,
                color: theme.colors.text.secondary,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                fontWeight: '500',
              }}
            >
              Off duty
            </Text>
          </View>
        )}

        {/* Stat strip */}
        <View
          style={{
            marginTop: 22,
            width: '100%',
            flexDirection: 'row',
            backgroundColor: theme.colors.surface.card,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            borderRadius: theme.radii.xl,
            paddingVertical: 14,
          }}
        >
          <StatCell
            value={securityRoles.length.toString()}
            label={securityRoles.length === 1 ? 'Role' : 'Roles'}
          />
          <Divider />
          <StatCell
            value={siaLicenseTypes.length.toString()}
            label={siaLicenseTypes.length === 1 ? 'Licence' : 'Licences'}
          />
          <Divider />
          <StatCell
            value={isOnShift ? 'ON' : 'OFF'}
            label="Shift"
            emphasise={isOnShift}
          />
        </View>

        {/* Shift details (when on shift) */}
        {isOnShift && activeShift ? (
          <GlassCard style={{ width: '100%', marginTop: 14 }}>
            <Eyebrow>Current shift</Eyebrow>
            {activeShift.venue_name ? (
              <InfoRow label="Venue" value={activeShift.venue_name} />
            ) : null}
            {activeShift.role_on_shift ? (
              <InfoRow
                label="Role on shift"
                value={ROLE_LABEL[activeShift.role_on_shift] || activeShift.role_on_shift}
              />
            ) : null}
            {activeShift.check_in_time ? (
              <InfoRow label="Checked in" value={formatTime(activeShift.check_in_time) || '—'} />
            ) : null}
          </GlassCard>
        ) : null}

        {/* Qualifications */}
        {securityRoles.length > 0 || siaLicenseTypes.length > 0 ? (
          <GlassCard style={{ width: '100%', marginTop: 14 }}>
            <Eyebrow>Qualifications</Eyebrow>
            {securityRoles.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 9,
                    color: theme.colors.text.tertiary,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Security roles
                </Text>
                <View style={styles.pillRow}>
                  {securityRoles.map((r) => (
                    <Pill key={r} label={ROLE_LABEL[r] || r} />
                  ))}
                </View>
              </View>
            ) : null}
            {siaLicenseTypes.length > 0 ? (
              <View style={{ marginTop: securityRoles.length > 0 ? 12 : 10 }}>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 9,
                    color: theme.colors.text.tertiary,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  SIA licences
                </Text>
                <View style={styles.pillRow}>
                  {siaLicenseTypes.map((t) => (
                    <Pill key={t} label={LICENSE_LABEL[t] || t.toUpperCase()} accent />
                  ))}
                </View>
              </View>
            ) : null}
          </GlassCard>
        ) : null}

        {/* Employment */}
        {employmentType ? (
          <GlassCard style={{ width: '100%', marginTop: 14 }}>
            <Eyebrow>Employment</Eyebrow>
            <InfoRow label="Type" value={employmentType} />
          </GlassCard>
        ) : null}
      </ScrollView>

      {/* NavBack */}
      <View style={{ position: 'absolute', top: insets.top + 12, left: 20, zIndex: 20 }}>
        <NavBack onPress={() => navigation.goBack()} />
      </View>

      {/* Profile title (center) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 20,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            letterSpacing: 2.2,
            textTransform: 'uppercase',
            color: theme.colors.text.secondary,
            fontWeight: '500',
          }}
        >
          Profile
        </Text>
      </View>
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────
const StatCell: React.FC<{ value: string; label: string; emphasise?: boolean }> = ({
  value,
  label,
  emphasise,
}) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 22,
          color: emphasise ? theme.colors.accent : theme.colors.text.primary,
          fontWeight: '400',
          letterSpacing: -0.6,
        }}
      >
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 4,
          fontFamily: theme.fonts.mono,
          fontSize: 9,
          color: theme.colors.text.secondary,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
};

const Divider: React.FC = () => {
  const theme = useRedesignTheme();
  return <View style={{ width: 1, backgroundColor: theme.colors.surface.hairline }} />;
};

const Pill: React.FC<{ label: string; accent?: boolean }> = ({ label, accent }) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: accent ? theme.colors.accentSoft : theme.colors.surface.chip,
        borderWidth: 1,
        borderColor: accent ? theme.colors.accentBorder : theme.colors.surface.hairline,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 12,
          color: accent ? theme.colors.accent : theme.colors.text.primary,
          fontWeight: '500',
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>{label}</Text>
      <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  presenceRing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

export default TeamMemberProfileScreenV2;
