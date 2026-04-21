/**
 * LeaveBalanceScreenV2 — Phase 4 re-skin of the permanent-employee leave
 * balance view. Preserves Redux wiring (fetchMyBalances / fetchLeaveTypes)
 * and the contractor redirect gate. Dark canvas, red accent, glass cards.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import type { LeaveBalance } from '../../../types/leave.types';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import {
  fetchMyBalances,
  fetchLeaveTypes,
  selectLeaveBalances,
} from '../../../store/slices/leaveSlice';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const LEAVE_ICON_MAP: Record<string, string> = {
  ANNUAL: 'M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7',
  SICK: 'M12 4 v16 M4 12 h16',
  PERSONAL: 'M12 12 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 M4 20 c 0 -4 4 -6 8 -6 s 8 2 8 6',
  MATERNITY: 'M12 4 a4 4 0 1 0 0 8 a4 4 0 0 0 0 -8 M8 14 c 2 2 6 2 8 0 L18 20 H6 Z',
  PATERNITY: 'M12 4 a4 4 0 1 0 0 8 a4 4 0 0 0 0 -8 M8 14 c 2 2 6 2 8 0 L18 20 H6 Z',
  BEREAVEMENT: 'M6 3 V21 M6 4 H18 L16 10 L18 16 H6',
};

const formatDays = (n: number) => n.toFixed(n % 1 === 0 ? 0 : 1);

export const LeaveBalanceScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const employmentCategory = user?.staff_profile?.employment_type?.employment_category;
  const isContractor =
    employmentCategory === 'contractor' || employmentCategory === 'temporary';

  useEffect(() => {
    if (isContractor) {
      Alert.alert(
        'Access Restricted',
        'Leave balances are only available for permanent employees. As a contractor, please use the Availability feature to manage your schedule.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    }
  }, [isContractor, navigation]);

  const balances = useAppSelector(selectLeaveBalances);
  const balancesLoading = useAppSelector((state) => state.leave.balancesLoading);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    await Promise.all([dispatch(fetchMyBalances()), dispatch(fetchLeaveTypes())]);
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loading = balancesLoading && (!balances || balances.length === 0);

  const totalAvailable = (balances || []).reduce(
    (sum, b) => sum + (b.available_balance || 0),
    0,
  );
  const totalUsed = (balances || []).reduce(
    (sum, b) => sum + (b.used_balance || 0),
    0,
  );
  const totalPending = (balances || []).reduce(
    (sum, b) => sum + (b.pending_balance || 0),
    0,
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingHorizontal: 20,
          paddingBottom: 120 + insets.bottom,
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
      >
        {/* Title */}
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 28,
            color: theme.colors.text.primary,
            fontWeight: '400',
            letterSpacing: -0.8,
          }}
        >
          Leave balance
        </Text>
        <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
          {balances && balances.length > 0
            ? `${balances.length} leave type${balances.length !== 1 ? 's' : ''} · ${formatDays(totalAvailable)} days available`
            : 'View your available leave days'}
        </Eyebrow>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 12,
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: theme.colors.text.tertiary,
              }}
            >
              Loading balances
            </Text>
          </View>
        ) : balances && balances.length > 0 ? (
          <>
            {/* Summary strip */}
            <GlassCard style={{ padding: 16, marginBottom: 14 }}>
              <Eyebrow>This year</Eyebrow>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  marginTop: 8,
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 40,
                    color: theme.colors.text.primary,
                    fontWeight: '400',
                    letterSpacing: -1.4,
                  }}
                >
                  {formatDays(totalAvailable)}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    color: theme.colors.text.secondary,
                  }}
                >
                  days available
                </Text>
              </View>
              <View
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.colors.surface.hairline,
                  flexDirection: 'row',
                }}
              >
                <SummaryCell label="Used" value={formatDays(totalUsed)} />
                <CellDivider />
                <SummaryCell
                  label="Pending"
                  value={formatDays(totalPending)}
                  accent={totalPending > 0}
                />
                <CellDivider />
                <SummaryCell
                  label="Types"
                  value={String(balances.length)}
                />
              </View>
            </GlassCard>

            {/* Balance cards */}
            <Eyebrow style={{ marginLeft: 4, marginTop: 6, marginBottom: 10 }}>
              By leave type
            </Eyebrow>
            {balances.map((balance) => (
              <BalanceCard key={balance.id} balance={balance} />
            ))}
          </>
        ) : (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: theme.colors.surface.chip,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}
            >
              No leave balances found
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 6,
                textAlign: 'center',
                fontSize: 12,
                color: theme.colors.text.secondary,
                lineHeight: 18,
                maxWidth: 260,
              }}
            >
              Contact your manager to set up your leave entitlement.
            </Text>
          </GlassCard>
        )}
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

      {/* Footer CTA */}
      {balances && balances.length > 0 && !loading ? (
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: insets.bottom + 16,
          }}
        >
          <PrimaryCTA
            label="Request leave"
            trailingArrow
            onPress={() => navigation.navigate('LeaveRequest')}
          />
        </View>
      ) : null}
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────

const BalanceCard: React.FC<{ balance: LeaveBalance }> = ({ balance }) => {
  const theme = useRedesignTheme();
  const color = balance.leave_type.color_code || theme.colors.accent;
  const iconPath = LEAVE_ICON_MAP[balance.leave_type.code] || LEAVE_ICON_MAP.ANNUAL;
  const total = balance.total_entitlement || 0;
  const used = balance.used_balance || 0;
  const pending = balance.pending_balance || 0;
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const pendingPct = total > 0 ? Math.min((pending / total) * 100, 100) : 0;

  return (
    <GlassCard style={{ marginBottom: 10, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: hexAlpha(color, 0.14),
            borderWidth: 1,
            borderColor: hexAlpha(color, 0.4),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d={iconPath}
              stroke={color}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontSize: 15,
              color: theme.colors.text.primary,
              fontWeight: '500',
              letterSpacing: -0.2,
            }}
          >
            {balance.leave_type.name}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 2,
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: theme.colors.text.tertiary,
            }}
          >
            {balance.leave_type.code}
            {balance.leave_type.is_paid ? ' · Paid' : ' · Unpaid'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            allowFontScaling={false}
            style={{
              fontSize: 22,
              color,
              fontWeight: '400',
              letterSpacing: -0.6,
            }}
          >
            {formatDays(balance.available_balance || 0)}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: theme.colors.text.tertiary,
            }}
          >
            Days left
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={{
          marginTop: 14,
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.colors.surface.chip,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: color,
          }}
        />
        {pendingPct > 0 ? (
          <View
            style={{
              width: `${pendingPct}%`,
              height: '100%',
              backgroundColor: hexAlpha(color, 0.35),
            }}
          />
        ) : null}
      </View>

      {/* Detail row */}
      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
        }}
      >
        <SummaryCell
          label="Used"
          value={formatDays(used)}
          sub={total > 0 ? `of ${formatDays(total)}` : undefined}
        />
        <CellDivider />
        <SummaryCell
          label="Pending"
          value={formatDays(pending)}
          accent={pending > 0}
        />
        <CellDivider />
        <SummaryCell
          label="Entitled"
          value={formatDays(total)}
        />
      </View>
    </GlassCard>
  );
};

const SummaryCell: React.FC<{
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}> = ({ label, value, sub, accent }) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 16,
          color: accent ? theme.colors.accent : theme.colors.text.primary,
          fontWeight: '500',
          letterSpacing: -0.3,
        }}
      >
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 2,
          fontFamily: theme.fonts.mono,
          fontSize: 9,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: theme.colors.text.tertiary,
        }}
      >
        {label}
      </Text>
      {sub ? (
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 1,
            fontSize: 10,
            color: theme.colors.text.tertiary,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
};

const CellDivider: React.FC = () => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        alignSelf: 'stretch',
        backgroundColor: theme.colors.surface.hairline,
      }}
    />
  );
};

// ─── Utils ───────────────────────────────────────────────────
const hexAlpha = (hex: string, alpha: number): string => {
  const raw = hex.replace('#', '');
  if (raw.length !== 3 && raw.length !== 6) {
    return `rgba(225,52,44,${alpha})`;
  }
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) {
    return `rgba(225,52,44,${alpha})`;
  }
  return `rgba(${r},${g},${b},${alpha})`;
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

export default LeaveBalanceScreenV2;
