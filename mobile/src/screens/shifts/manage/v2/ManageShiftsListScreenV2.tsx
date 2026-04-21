/**
 * ManageShiftsListScreenV2 — Admin/manager "Manage" tab re-skin to match the
 * Phase 4 design language. Preserves Redux wiring (fetchAllCompanyShifts,
 * loadMoreCompanyShifts, setFilter) and navigation to ShiftDetails / CreateShift.
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
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../../hooks/useRedux';
import {
  fetchAllCompanyShifts,
  loadMoreCompanyShifts,
  selectManageShiftsFiltered,
  selectManageShiftsLoading,
  selectManageShiftsLoadingMore,
  selectManageShiftsHasMore,
  selectManageShiftsFilter,
  selectManageShiftsError,
  setFilter,
  type ManageShiftsFilter,
} from '../../../../store/slices/manageShiftsSlice';
import type { Shift } from '../../../../store/slices/shiftsSlice';
import type { MainStackParamList } from '../../../../types/navigation';
import { logger } from '../../../../utils/logger';
import { useRedesignTheme } from '../../../../theme/redesign';
import { Eyebrow } from '../../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface FilterOption {
  value: ManageShiftsFilter;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'in_progress', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const STATUS_COLORS: Record<Shift['status'], string> = {
  scheduled: '#9ca3af',
  in_progress: '#E1342C',
  completed: '#22c55e',
  cancelled: '#6b7280',
  pending_approval: '#f59e0b',
  approved: '#22c55e',
  no_show: '#ef4444',
};

const STATUS_LABEL: Record<Shift['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending_approval: 'Pending',
  approved: 'Approved',
  no_show: 'No show',
};

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

export const ManageShiftsListScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const dispatch = useAppDispatch();

  const shifts = useAppSelector(selectManageShiftsFiltered);
  const filter = useAppSelector(selectManageShiftsFilter);
  const isLoading = useAppSelector(selectManageShiftsLoading);
  const isLoadingMore = useAppSelector(selectManageShiftsLoadingMore);
  const hasMore = useAppSelector(selectManageShiftsHasMore);
  const error = useAppSelector(selectManageShiftsError);

  const [refreshing, setRefreshing] = useState(false);

  const loadPageOne = useCallback(
    (activeFilter: ManageShiftsFilter) => {
      const status = activeFilter === 'all' ? undefined : activeFilter;
      return dispatch(fetchAllCompanyShifts({ page: 1, pageSize: 6, status }));
    },
    [dispatch],
  );

  useFocusEffect(
    useCallback(() => {
      loadPageOne(filter);
    }, [loadPageOne, filter]),
  );

  useEffect(() => {
    if (error) {
      logger.error('[ManageShifts] error', error);
    }
  }, [error]);

  const handleFilterChange = (next: ManageShiftsFilter) => {
    if (next === filter) return;
    dispatch(setFilter(next));
    loadPageOne(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPageOne(filter).unwrap();
    } catch (err) {
      logger.error('[ManageShifts] refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      dispatch(loadMoreCompanyShifts());
    }
  };

  const renderItem = ({ item }: { item: Shift }) => (
    <ManageShiftRow
      shift={item}
      onPress={() => navigation.navigate('ShiftDetails', { shift: item })}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 28,
                color: theme.colors.text.primary,
                fontWeight: '400',
                letterSpacing: -0.8,
              }}
            >
              Manage shifts
            </Text>
            <Eyebrow style={{ marginTop: 4 }}>
              {shifts.length > 0
                ? `${shifts.length}${hasMore ? '+' : ''} ${
                    filter === 'all' ? 'total' : filter.replace('_', ' ')
                  }`
                : 'All company shifts'}
            </Eyebrow>
          </View>
          <Pressable
            onPress={() => navigation.navigate('CreateShift')}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.accent,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              opacity: pressed ? 0.88 : 1,
              shadowColor: theme.colors.accent,
              shadowOpacity: 0.45,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
            })}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M12 5v14M5 12h14"
                stroke="#fff"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <Text
              allowFontScaling={false}
              style={{
                color: '#fff',
                fontSize: 13,
                fontWeight: '500',
                letterSpacing: -0.1,
              }}
            >
              New
            </Text>
          </Pressable>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20, marginTop: 16 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = opt.value === filter;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleFilterChange(opt.value)}
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
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {isLoading && shifts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
            Loading shifts
          </Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 40 + insets.bottom,
            gap: 10,
          }}
          ListEmptyComponent={
            <EmptyState filter={filter} onCreate={() => navigation.navigate('CreateShift')} />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
              </View>
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
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

// ─── Subcomponents ───────────────────────────────────────────

const ManageShiftRow: React.FC<{
  shift: Shift;
  onPress: () => void;
}> = ({ shift, onPress }) => {
  const theme = useRedesignTheme();
  const start = new Date(shift.start_time);
  const day = DAY_ABBR[start.getDay()];
  const dateNum = start.getDate();
  const timeRange = `${formatTime(shift.start_time)} — ${formatTime(shift.end_time)}`;
  const role = shift.required_security_role || 'Security Staff';
  const isLive = shift.status === 'in_progress';
  const statusColor = STATUS_COLORS[shift.status] || theme.colors.text.tertiary;
  const statusLabel = STATUS_LABEL[shift.status] || String(shift.status);
  const coworkerCount = (shift.coworkers?.length || 0) + 1;
  const venueName = shift.venue?.name || 'Unknown venue';

  const Body = (
    <View
      style={{
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 48,
          paddingVertical: 8,
          borderRadius: 10,
          alignItems: 'center',
          backgroundColor: theme.isDark
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(11,11,14,0.03)',
          borderWidth: 1,
          borderColor: isLive
            ? theme.colors.accentBorder
            : theme.colors.surface.hairline,
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 9,
            letterSpacing: 1.6,
            color: isLive ? theme.colors.accent : theme.colors.text.secondary,
            fontWeight: '500',
          }}
        >
          {day}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 1,
            fontSize: 18,
            color: theme.colors.text.primary,
            fontWeight: '400',
            letterSpacing: -0.4,
          }}
        >
          {dateNum}
        </Text>
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
          {venueName}
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
          {timeRange} · {role}
        </Text>
        <View
          style={{
            marginTop: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {coworkerCount > 1 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 12 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 M4 20 c 0 -4 4 -6 8 -6 s 8 2 8 6"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={1.6}
                  fill="none"
                />
              </Svg>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.4,
                  color: theme.colors.text.tertiary,
                }}
              >
                {coworkerCount} staff
              </Text>
            </View>
          ) : null}
          {shift.is_special_event ? (
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 9,
                letterSpacing: 1.4,
                color: theme.colors.accent,
                fontWeight: '500',
              }}
            >
              ★ SPECIAL
            </Text>
          ) : null}
        </View>
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
          {statusLabel}
        </Text>
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: theme.radii.xl,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {isLive ? (
        <LinearGradient
          colors={theme.shiftCardGradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            borderRadius: theme.radii.xl,
            borderWidth: 1,
            borderColor: theme.shiftCardBorder,
          }}
        >
          {Body}
        </LinearGradient>
      ) : (
        <View
          style={{
            backgroundColor: theme.colors.surface.card,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            borderRadius: theme.radii.xl,
          }}
        >
          {Body}
        </View>
      )}
    </Pressable>
  );
};

const EmptyState: React.FC<{
  filter: ManageShiftsFilter;
  onCreate: () => void;
}> = ({ filter, onCreate }) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
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
            d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
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
        style={{
          fontSize: 17,
          color: theme.colors.text.primary,
          fontWeight: '500',
          letterSpacing: -0.3,
        }}
      >
        No shifts
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 6,
          fontSize: 13,
          color: theme.colors.text.secondary,
          textAlign: 'center',
          maxWidth: 280,
        }}
      >
        {filter === 'all'
          ? 'No shifts have been scheduled yet.'
          : `No ${filter.replace('_', ' ')} shifts right now.`}
      </Text>
      <Pressable
        onPress={onCreate}
        style={({ pressed }) => ({
          marginTop: 18,
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: theme.colors.accent,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path
            d="M12 5v14M5 12h14"
            stroke="#fff"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
        <Text
          allowFontScaling={false}
          style={{
            color: '#fff',
            fontSize: 13,
            fontWeight: '500',
            letterSpacing: -0.1,
          }}
        >
          Create shift
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default ManageShiftsListScreenV2;
