/**
 * TeamScreenV2 — Redesigned team tab matching the Phase 4 design.
 *
 * Preserves the business logic from TeamScreen (fetch /team/members,
 * navigate to TeamMemberProfile, pull-to-refresh) and swaps only the
 * presentation layer.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import axios from 'axios';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import { useAppSelector } from '../../../hooks/useRedux';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { API_ENDPOINTS, getAuthHeaders } from '../../../config/api.config';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface TeamMemberAPI {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  security_roles: string[];
  profile_image_url: string | null;
  employment_type: string | null;
  sia_license_types: string[];
  is_on_shift: boolean;
  active_shift: {
    venue_name: string | null;
    check_in_time: string | null;
    role_on_shift: string;
  } | null;
  is_current_user: boolean;
}

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

const displayRole = (m: TeamMemberAPI) => {
  const parts: string[] = [];
  if (m.role === 'manager' || m.role === 'admin') {
    parts.push(m.role.charAt(0).toUpperCase() + m.role.slice(1));
  }
  if (m.security_roles.length > 0) {
    parts.push(...m.security_roles.map((r) => ROLE_LABEL[r] || r));
  }
  if (parts.length === 0 && m.employment_type) parts.push(m.employment_type);
  return parts.length > 0 ? parts.join(' · ') : 'Staff';
};

const getInitials = (m: TeamMemberAPI) =>
  `${(m.first_name || '').charAt(0)}${(m.last_name || '').charAt(0)}`.toUpperCase();

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

// ─── Stat card ─────────────────────────────────────────────
const PresenceStatCard: React.FC<{
  label: string;
  count: number;
  dotColor: string;
  onPress?: () => void;
}> = ({ label, count, dotColor, onPress }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: 12,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface.card,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 9,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: theme.colors.text.secondary,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: '400',
          letterSpacing: -0.6,
          color: theme.colors.text.primary,
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
};

// ─── Member row ─────────────────────────────────────────────
const MemberRow: React.FC<{
  member: TeamMemberAPI;
  isFirst: boolean;
  onPress: () => void;
}> = ({ member, isFirst, onPress }) => {
  const theme = useRedesignTheme();
  const dotColor = member.is_on_shift ? '#4ade80' : theme.colors.text.tertiary;
  const statusText = member.is_on_shift
    ? member.active_shift?.venue_name
      ? `On shift · ${member.active_shift.venue_name}`
      : 'On shift'
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: theme.colors.surface.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ position: 'relative' }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontSize: 15,
              fontWeight: '500',
              letterSpacing: -0.2,
              color: theme.colors.text.primary,
            }}
          >
            {getInitials(member) || '?'}
          </Text>
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: dotColor,
            borderWidth: 2,
            borderColor: theme.colors.canvas,
          }}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            fontSize: 14,
            color: theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.2,
          }}
        >
          {member.first_name} {member.last_name}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }}
        >
          {displayRole(member)}
        </Text>
        {statusText ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#4ade80' }} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 9,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: theme.colors.text.tertiary,
              }}
            >
              {statusText}
              {member.active_shift?.check_in_time ? ` · ${formatClock(member.active_shift.check_in_time)}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: theme.colors.surface.chip,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M1 1 L6 1 L 8 5 L 6 7 Q 8 11 13 13 L 15 11 L 19 13 V 19 Q 19 22 16 22 Q 7 22 1 15 Q 1 11 1 7 Z"
            stroke={theme.colors.text.primary}
            strokeWidth={1.5}
            fill="none"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </Pressable>
  );
};

// ─── Screen ─────────────────────────────────────────────────
export const TeamScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const { subscription } = useSubscription();
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rawMembers, setRawMembers] = useState<TeamMemberAPI[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTeamMembers = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await axios.get<TeamMemberAPI[]>(API_ENDPOINTS.TEAM.MEMBERS, {
        headers: getAuthHeaders(accessToken),
        timeout: 15000,
      });
      setRawMembers(response.data);
    } catch (error) {
      const isAxios = axios.isAxiosError(error);
      const status = isAxios ? error.response?.status : undefined;
      const isNetworkError =
        isAxios && !error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error');
      const isTimeout = isAxios && error.code === 'ECONNABORTED';

      if (isNetworkError || isTimeout) {
        // Transient connectivity issue — breadcrumb only, don't page Sentry.
        logger.warn('[TeamV2] fetch members offline/timeout', { code: (error as any)?.code });
        if (!refreshing) {
          Alert.alert(
            'Connection issue',
            'Could not reach the server. Check your connection and pull down to retry.',
          );
        }
      } else if (typeof status === 'number' && status >= 400 && status < 500) {
        logger.warn('[TeamV2] fetch members rejected', { status });
        if (!refreshing) {
          Alert.alert('Unable to load team', 'Please sign in again or pull down to retry.');
        }
      } else {
        logger.error('[TeamV2] fetch members', error);
        if (!refreshing) {
          Alert.alert('Error', 'Unable to load team members. Pull down to retry.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, refreshing]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTeamMembers();
    }, [fetchTeamMembers]),
  );

  // Keep the linter happy (SubscriptionContext is optional here)
  useEffect(() => {
    logger.info('[TeamV2] viewed', { total: rawMembers.length });
  }, [rawMembers.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTeamMembers();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return rawMembers;
    const q = searchQuery.toLowerCase();
    return rawMembers.filter(
      (m) =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        displayRole(m).toLowerCase().includes(q) ||
        (m.active_shift?.venue_name || '').toLowerCase().includes(q),
    );
  }, [rawMembers, searchQuery]);

  const onShift = useMemo(() => filtered.filter((m) => m.is_on_shift), [filtered]);
  const offDuty = useMemo(() => filtered.filter((m) => !m.is_on_shift), [filtered]);

  const venuesCount = useMemo(() => {
    const s = new Set(rawMembers.filter((m) => m.is_on_shift && m.active_shift?.venue_name).map((m) => m.active_shift!.venue_name!));
    return s.size;
  }, [rawMembers]);

  const openMember = (m: TeamMemberAPI) => {
    navigation.navigate('TeamMemberProfile', {
      memberId: m.id,
      name: `${m.first_name} ${m.last_name}`.trim() || 'Unknown',
      role: displayRole(m),
      photo: m.profile_image_url || undefined,
      presenceStatus: m.is_on_shift ? 'available' : 'offline',
      currentVenue: m.active_shift?.venue_name || undefined,
      statusMessage: m.is_on_shift ? 'On duty' : undefined,
      securityRoles: m.security_roles,
      employmentType: m.employment_type ?? undefined,
      siaLicenseTypes: m.sia_license_types,
      isOnShift: m.is_on_shift,
      activeShift: m.active_shift,
    });
  };

  const handleShare = async () => {
    try {
      const isOnShift = rawMembers.some((m) => m.is_current_user && m.is_on_shift);
      await Share.share({
        message: `I'm currently ${isOnShift ? 'on shift' : 'off duty'}. Sent via Mead Security.`,
      });
    } catch (error) {
      logger.error('[TeamV2] share', error);
    }
  };

  if (loading && rawMembers.length === 0) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.canvas,
            paddingTop: insets.top,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={{ marginTop: 14, color: theme.colors.text.secondary, fontSize: 14 }}>Loading team…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 28,
                color: theme.colors.text.primary,
                fontWeight: '400',
                letterSpacing: -0.8,
              }}
            >
              Team
            </Text>
            <Eyebrow style={{ marginTop: 6 }}>
              {subscription?.companyName || 'Your company'} · {rawMembers.length} member
              {rawMembers.length === 1 ? '' : 's'}
            </Eyebrow>
          </View>
          <Pressable
            onPress={handleShare}
            hitSlop={8}
            accessibilityLabel="Share status"
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
              marginRight: 8,
            })}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"
                stroke={theme.colors.text.primary}
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen((s) => !s)}
            hitSlop={8}
            accessibilityLabel="Search team"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: searchOpen ? theme.colors.accentSoft : theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: searchOpen ? theme.colors.accentBorder : theme.colors.surface.hairline,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M11 19a8 8 0 1 1 5.29-14M21 21l-4.71-4.71"
                stroke={searchOpen ? theme.colors.accent : theme.colors.text.primary}
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>

        {/* Search input */}
        {searchOpen ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search team…"
              placeholderTextColor={theme.colors.text.tertiary}
              autoFocus
              style={{
                height: 44,
                paddingHorizontal: 14,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surface.card,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
                color: theme.colors.text.primary,
                fontSize: 14,
              }}
            />
          </View>
        ) : null}

        {/* Presence summary */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 18 }}>
          <PresenceStatCard label="On shift" count={onShift.length} dotColor="#4ade80" />
          <PresenceStatCard label="Off duty" count={offDuty.length} dotColor={theme.colors.text.tertiary} />
          <PresenceStatCard
            label="Venues"
            count={venuesCount}
            dotColor={theme.colors.accent}
            onPress={() =>
              Alert.alert('Venues', `Currently covering ${venuesCount} venue${venuesCount === 1 ? '' : 's'}`)
            }
          />
        </View>

        {/* On-shift section */}
        {onShift.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
            <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
              On shift now · {onShift.length}
            </Eyebrow>
            <GlassCard pad={0}>
              {onShift.map((m, i) => (
                <MemberRow key={m.id} member={m} isFirst={i === 0} onPress={() => openMember(m)} />
              ))}
            </GlassCard>
          </View>
        ) : null}

        {/* Off-duty section */}
        {offDuty.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
            <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
              Off duty · {offDuty.length}
            </Eyebrow>
            <GlassCard pad={0}>
              {offDuty.map((m, i) => (
                <MemberRow key={m.id} member={m} isFirst={i === 0} onPress={() => openMember(m)} />
              ))}
            </GlassCard>
          </View>
        ) : null}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 }}>
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
                  d="M9 11 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6 M17 13 a2.5 2.5 0 1 0 0 -5 a2.5 2.5 0 0 0 0 5 M3 20 c0 -3 3 -5 6 -5 s6 2 6 5 M14 20 c0 -2.5 2 -4 4 -4 s3 1.5 3 4"
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
              style={{ fontSize: 17, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.3 }}
            >
              {searchQuery ? 'No team members found' : 'No team members yet'}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 13, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 6 }}
            >
              {searchQuery ? 'Try a different name, role, or venue.' : 'Pull down to refresh.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 16,
  },
});

export default TeamScreenV2;
