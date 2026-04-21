/**
 * LeaveHistoryScreenV2 — Phase 4 re-skin of the leave request history view.
 * Preserves Redux wiring (fetchMyLeaveRequests / cancelLeaveRequest /
 * setActiveFilters) and detail navigation.
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
import { useNavigation } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import type { LeaveRequest, LeaveRequestStatus } from '../../../types/leave.types';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import {
  fetchMyLeaveRequests,
  cancelLeaveRequest,
  setActiveFilters,
  selectLeaveRequests,
  selectActiveFilters,
} from '../../../store/slices/leaveSlice';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

type StatusFilter = LeaveRequestStatus | 'ALL';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DENIED', label: 'Denied' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_COLORS: Record<LeaveRequestStatus, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#22c55e',
  DENIED: '#ef4444',
  CANCELLED: '#9ca3af',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const hexAlpha = (hex: string, alpha: number): string => {
  const raw = (hex || '').replace('#', '');
  if (raw.length !== 3 && raw.length !== 6) return `rgba(225,52,44,${alpha})`;
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
  if ([r, g, b].some(Number.isNaN)) return `rgba(225,52,44,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};

export const LeaveHistoryScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const dispatch = useAppDispatch();

  const requests = useAppSelector(selectLeaveRequests);
  const activeFilters = useAppSelector(selectActiveFilters);
  const loading = useAppSelector((state) => state.leave.requestsLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const loadRequests = useCallback(async () => {
    await dispatch(fetchMyLeaveRequests(activeFilters));
  }, [dispatch, activeFilters]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleStatusFilter = (status: StatusFilter) => {
    dispatch(setActiveFilters({ status }));
  };
  const handleYearChange = (year: number) => {
    dispatch(setActiveFilters({ year }));
  };

  const handleCancelRequest = (requestId: number) => {
    Alert.alert(
      'Cancel Leave Request',
      'Are you sure you want to cancel this leave request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(requestId);
            await dispatch(cancelLeaveRequest(requestId));
            setCancellingId(null);
            await loadRequests();
          },
        },
      ],
    );
  };

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
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 28,
            color: theme.colors.text.primary,
            fontWeight: '400',
            letterSpacing: -0.8,
          }}
        >
          Leave history
        </Text>
        <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
          View and manage your leave requests
        </Eyebrow>

        {/* Status filter */}
        <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>Status</Eyebrow>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20, marginBottom: 14 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const active = activeFilters.status === opt.value;
            return (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={active}
                onPress={() => handleStatusFilter(opt.value)}
              />
            );
          })}
        </ScrollView>

        {/* Year filter */}
        <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>Year</Eyebrow>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20, marginBottom: 18 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {yearOptions.map((year) => {
            const active = activeFilters.year === year;
            return (
              <FilterChip
                key={year}
                label={String(year)}
                active={active}
                onPress={() => handleYearChange(year)}
              />
            );
          })}
        </ScrollView>

        {/* List */}
        <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
          {requests && requests.length > 0
            ? `${requests.length} request${requests.length !== 1 ? 's' : ''}`
            : 'Requests'}
        </Eyebrow>

        {loading && (!requests || requests.length === 0) ? (
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
              Loading requests
            </Text>
          </View>
        ) : requests && requests.length > 0 ? (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              cancelling={cancellingId === request.id}
              onPress={() =>
                navigation.navigate('LeaveRequestDetail', { requestId: request.id })
              }
              onCancel={() => handleCancelRequest(request.id)}
            />
          ))
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
                  d="M6 3 H16 L20 7 V21 H6 Z M6 7 H16 M9 13 H17 M9 17 H15"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}
            >
              No leave requests found
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 6,
                textAlign: 'center',
                fontSize: 12,
                color: theme.colors.text.secondary,
                lineHeight: 18,
                maxWidth: 280,
              }}
            >
              Try adjusting your filters, or tap Request leave to submit a new one.
            </Text>
          </GlassCard>
        )}
      </ScrollView>

      {/* Back */}
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
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active
          ? theme.colors.accentSoft
          : theme.colors.surface.chip,
        borderWidth: 1,
        borderColor: active
          ? theme.colors.accentBorder
          : theme.colors.surface.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: active ? theme.colors.accent : theme.colors.text.secondary,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const RequestCard: React.FC<{
  request: LeaveRequest;
  cancelling: boolean;
  onPress: () => void;
  onCancel: () => void;
}> = ({ request, cancelling, onPress, onCancel }) => {
  const theme = useRedesignTheme();
  const typeColor = request.leave_type.color_code || theme.colors.accent;
  const statusColor = STATUS_COLORS[request.status] || theme.colors.text.secondary;
  const isPending = request.status === 'PENDING';

  return (
    <Pressable
      onPress={onPress}
      disabled={cancelling}
      style={({ pressed }) => ({
        marginBottom: 10,
        padding: 16,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface.card,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: hexAlpha(typeColor, 0.14),
            borderWidth: 1,
            borderColor: hexAlpha(typeColor, 0.4),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: typeColor,
            }}
          />
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
            {request.leave_type.name}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              marginTop: 2,
              fontSize: 12,
              color: theme.colors.text.secondary,
            }}
          >
            {formatDate(request.start_date)} – {formatDate(request.end_date)}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            backgroundColor: hexAlpha(statusColor, 0.14),
            borderWidth: 1,
            borderColor: hexAlpha(statusColor, 0.4),
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: statusColor,
              fontWeight: '500',
            }}
          >
            {request.status}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
            stroke={theme.colors.text.tertiary}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: theme.colors.text.secondary,
          }}
        >
          {request.working_days} working day{request.working_days !== 1 ? 's' : ''}
        </Text>
      </View>

      {request.approved_by_user ? (
        <View
          style={{
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 12 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 M4 20 c 0 -4 4 -6 8 -6 s 8 2 8 6"
              stroke={theme.colors.text.tertiary}
              strokeWidth={1.5}
              fill="none"
            />
          </Svg>
          <Text
            allowFontScaling={false}
            style={{
              fontSize: 11,
              color: theme.colors.text.tertiary,
              fontStyle: 'italic',
            }}
          >
            {request.status === 'APPROVED' ? 'Approved' : 'Reviewed'} by{' '}
            {request.approved_by_user.full_name || request.approved_by_user.username}
          </Text>
        </View>
      ) : null}

      {isPending ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.surface.hairline,
          }}
        >
          <Pressable
            onPress={onCancel}
            disabled={cancelling}
            style={({ pressed }) => ({
              paddingVertical: 10,
              borderRadius: theme.radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              backgroundColor: theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: theme.colors.accentBorder,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <>
                <Svg width={12} height={12} viewBox="0 0 24 24">
                  <Path
                    d="M5 5L19 19M19 5L5 19"
                    stroke={theme.colors.accent}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.8,
                    textTransform: 'uppercase',
                    color: theme.colors.accent,
                    fontWeight: '500',
                  }}
                >
                  Cancel request
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
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

export default LeaveHistoryScreenV2;
