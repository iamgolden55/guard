/**
 * ShiftExchangesScreenV2 — Re-skinned "My Exchanges" screen matching the
 * Phase 4 design. Preserves all business logic from UberShiftExchangesScreen
 * (direct exchanges + releases, accept/cancel/decline actions).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import exchangeService, {
  ShiftExchange,
  OpenShiftRequest,
} from '../../../services/exchangeService';
import { useAuth } from '../../../hooks/useAuth';
import { useRedesignTheme } from '../../../theme/redesign';
import { GlassCard, AccentDot } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type TabType = 'exchanges' | 'releases';

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const formatClock = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

const statusLabel = (s: string) =>
  s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// ─── Date cube ────────────────────────────────────────────────
const DateCube: React.FC<{ iso: string }> = ({ iso }) => {
  const theme = useRedesignTheme();
  const d = new Date(iso);
  return (
    <View
      style={{
        width: 48,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: theme.colors.surface.chip,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
      }}
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
        {DAY_ABBR[d.getDay()]}
      </Text>
      <Text
        allowFontScaling={false}
        style={{ fontSize: 18, color: theme.colors.text.primary, fontWeight: '400', marginTop: 1 }}
      >
        {d.getDate()}
      </Text>
    </View>
  );
};

// ─── Shared action button ─────────────────────────────────────
const ActionButton: React.FC<{
  label: string;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}> = ({ label, variant = 'ghost', disabled, onPress }) => {
  const theme = useRedesignTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const bg = isPrimary ? theme.colors.accent : theme.colors.surface.chip;
  const fg = isPrimary ? '#fff' : isDanger ? theme.colors.accent : theme.colors.text.primary;
  const border = isPrimary
    ? 'transparent'
    : isDanger
      ? theme.colors.accentBorder
      : theme.colors.surface.hairline;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.lg,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: fg,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

// ─── Exchange card ────────────────────────────────────────────
const ExchangeCardV2: React.FC<{
  exchange: ShiftExchange;
  currentUserId?: number;
  onAccept: () => void;
  onCancel: () => void;
  isActioning: boolean;
}> = ({ exchange, currentUserId, onAccept, onCancel, isActioning }) => {
  const theme = useRedesignTheme();
  const start = new Date(exchange.original_shift_details.start_time);
  const end = new Date(exchange.original_shift_details.end_time);
  const isRequestingUser = currentUserId == exchange.requesting_user;
  const isTargetUser = currentUserId == exchange.target_user;
  const isPending = exchange.status === 'pending';
  const isWaitingApproval = exchange.status === 'accepted_by_target';

  return (
    <GlassCard style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <DateCube iso={exchange.original_shift_details.start_time} />
        <View style={{ flex: 1 }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
          >
            {exchange.original_shift_details.venue.name}
          </Text>
          <Text
            allowFontScaling={false}
            style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }}
          >
            {formatClock(start)} — {formatClock(end)}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 4,
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: theme.colors.text.tertiary,
            }}
          >
            {isRequestingUser
              ? `To ${exchange.target_user_details.first_name} ${exchange.target_user_details.last_name}`
              : `From ${exchange.requesting_user_details.first_name} ${exchange.requesting_user_details.last_name}`}
          </Text>
        </View>
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 6,
            backgroundColor: isPending ? theme.colors.accentSoft : theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: isPending ? theme.colors.accentBorder : theme.colors.surface.hairline,
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: isPending ? theme.colors.accent : theme.colors.text.secondary,
            }}
          >
            {statusLabel(exchange.status)}
          </Text>
        </View>
      </View>

      {exchange.request_reason ? (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
          }}
        >
          <Text style={{ fontSize: 12, color: theme.colors.text.secondary, lineHeight: 18 }}>
            {exchange.request_reason}
          </Text>
        </View>
      ) : null}

      {isPending && isTargetUser ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <ActionButton label="Accept" variant="primary" disabled={isActioning} onPress={onAccept} />
          <ActionButton label="Decline" variant="danger" disabled={isActioning} onPress={onCancel} />
        </View>
      ) : null}

      {isPending && isRequestingUser ? (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <ActionButton
            label={isActioning ? 'Cancelling…' : 'Cancel request'}
            variant="danger"
            disabled={isActioning}
            onPress={onCancel}
          />
        </View>
      ) : null}

      {isWaitingApproval ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <AccentDot size={5} pulse />
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: theme.colors.accent,
            }}
          >
            Waiting for manager approval
          </Text>
        </View>
      ) : null}
    </GlassCard>
  );
};

// ─── Release card ─────────────────────────────────────────────
const ReleaseCardV2: React.FC<{
  request: OpenShiftRequest;
  onCancel: () => void;
  isActioning: boolean;
}> = ({ request, onCancel, isActioning }) => {
  const theme = useRedesignTheme();
  const start = new Date(request.original_shift_details.start_time);
  const end = new Date(request.original_shift_details.end_time);
  const isOpen = request.status === 'open';
  const isClaimed = request.status === 'claimed';

  return (
    <GlassCard style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <DateCube iso={request.original_shift_details.start_time} />
        <View style={{ flex: 1 }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
          >
            {request.original_shift_details.venue.name}
          </Text>
          <Text
            allowFontScaling={false}
            style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }}
          >
            {formatClock(start)} — {formatClock(end)}
          </Text>
          {request.claimed_by_details ? (
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 4,
                fontFamily: theme.fonts.mono,
                fontSize: 9,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: theme.colors.text.tertiary,
              }}
            >
              Claimed by {request.claimed_by_details.first_name} {request.claimed_by_details.last_name}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 6,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
          }}
        >
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
            {statusLabel(request.status)}
          </Text>
        </View>
      </View>

      {request.request_reason ? (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
          }}
        >
          <Text style={{ fontSize: 12, color: theme.colors.text.secondary, lineHeight: 18 }}>
            {request.request_reason}
          </Text>
        </View>
      ) : null}

      {(isOpen || isClaimed) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <AccentDot size={5} pulse={isOpen} color={isClaimed ? undefined : undefined} />
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: theme.colors.text.secondary,
            }}
          >
            {isOpen ? 'Available for others to claim' : 'Claimed · awaiting approval'}
          </Text>
        </View>
      ) : null}

      {(isOpen || isClaimed) ? (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <ActionButton
            label={isActioning ? 'Cancelling…' : 'Cancel release'}
            variant="danger"
            disabled={isActioning}
            onPress={onCancel}
          />
        </View>
      ) : null}
    </GlassCard>
  );
};

// ─── Screen ───────────────────────────────────────────────────
export const ShiftExchangesScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [tab, setTab] = useState<TabType>('exchanges');
  const [directExchanges, setDirectExchanges] = useState<ShiftExchange[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const data = await exchangeService.getAllExchangeActivities();
      setDirectExchanges(data.direct_exchanges);
      setOpenRequests(data.open_requests);
    } catch (e) {
      Alert.alert('Error', 'Failed to load exchanges.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const handleAccept = (exchange: ShiftExchange) =>
    Alert.alert('Accept exchange', 'Accept this shift exchange?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            setActioningId(exchange.id);
            await exchangeService.acceptExchange(exchange.id);
            Alert.alert('Accepted', 'Awaiting approval.', [{ text: 'OK', onPress: () => fetchAll() }]);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to accept.');
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);

  const handleCancelExchange = (exchange: ShiftExchange) =>
    Alert.alert('Cancel exchange', 'Cancel this exchange request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            setActioningId(exchange.id);
            await exchangeService.cancelExchange(exchange.id);
            Alert.alert('Cancelled', 'Exchange cancelled.', [{ text: 'OK', onPress: () => fetchAll() }]);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to cancel.');
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);

  const handleCancelOpen = (request: OpenShiftRequest) =>
    Alert.alert('Cancel release', 'Cancel this shift release?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            setActioningId(request.id);
            await exchangeService.cancelOpenShiftRequest(request.id);
            Alert.alert('Cancelled', 'Release cancelled.', [{ text: 'OK', onPress: () => fetchAll() }]);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to cancel.');
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);

  const renderEmpty = () => (
    <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 }}>
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
            d="M3 7 H10 L12 9 H21 V19 H3 Z"
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
        {tab === 'exchanges' ? 'No exchanges' : 'No releases'}
      </Text>
      <Text
        allowFontScaling={false}
        style={{ fontSize: 13, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 6 }}
      >
        {tab === 'exchanges'
          ? 'Your direct shift exchanges will appear here.'
          : 'Shifts you release to the pool will appear here.'}
      </Text>
    </View>
  );

  const listData = tab === 'exchanges' ? directExchanges : openRequests;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
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
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d="M8 2 L2 8 L8 14" stroke={theme.colors.text.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            allowFontScaling={false}
            style={{ fontSize: 18, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
          >
            My exchanges
          </Text>
        </View>
        <Pressable
          onPress={() => fetchAll()}
          hitSlop={8}
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
              d="M20 12 a8 8 0 1 1 -2.34 -5.66 M20 4 v4 h-4"
              stroke={theme.colors.text.primary}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      {/* Segmented tabs */}
      <View style={{ marginHorizontal: 20, marginTop: 4, marginBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.surface.hairline,
          }}
        >
          {(['exchanges', 'releases'] as TabType[]).map((key) => {
            const active = tab === key;
            const count = key === 'exchanges' ? directExchanges.length : openRequests.length;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                hitSlop={8}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' }}
              >
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
                  {key === 'exchanges' ? 'Exchanges' : 'Releases'}
                  {count > 0 ? (
                    <Text style={{ color: active ? theme.colors.accent : theme.colors.text.quaternary }}>
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
          })}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={listData as any[]}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, flexGrow: 1 }}
          renderItem={({ item }) =>
            tab === 'exchanges' ? (
              <ExchangeCardV2
                exchange={item as ShiftExchange}
                currentUserId={currentUserId}
                onAccept={() => handleAccept(item as ShiftExchange)}
                onCancel={() => handleCancelExchange(item as ShiftExchange)}
                isActioning={actioningId === item.id}
              />
            ) : (
              <ReleaseCardV2
                request={item as OpenShiftRequest}
                onCancel={() => handleCancelOpen(item as OpenShiftRequest)}
                isActioning={actioningId === item.id}
              />
            )
          }
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAll(true);
              }}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});

export default ShiftExchangesScreenV2;
