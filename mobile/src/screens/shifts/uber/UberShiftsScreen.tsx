/**
 * UberShiftsScreen - Uber-style shifts page with calendar navigation
 * Features calendar strip, expandable month picker, and date-based shift filtering
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector, useAppDispatch } from '../../../hooks/useRedux';
import {
  selectUpcomingShifts,
  selectPastScheduledShifts,
  selectCompletedShifts,
  selectActiveShift,
  selectShiftsLoadingMore,
  selectShiftsHasMore,
  Shift,
  loadMoreShifts,
  fetchShifts,
} from '../../../store/slices/shiftsSlice';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { useAuth } from '../../../hooks/useAuth';
import exchangeService from '../../../services/exchangeService';
import { logger } from '../../../utils/logger';
import { getUberColors, getUberShadows, uberRadius, uberSpacing } from '../../../theme/uberTheme';
import { useTheme } from '../../../hooks/useTheme';

import {
  UberCalendarStrip,
  UberMonthPicker,
  UberShiftCard,
  UberEmptyState,
} from './components';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Helper to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format date for section header
const formatDateHeader = (date: Date): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  if (targetDate.getTime() === today.getTime()) {
    return 'Today';
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (targetDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

export const UberShiftsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingExchangeCount, setPendingExchangeCount] = useState(0);
  const [availableShiftsCount, setAvailableShiftsCount] = useState(0);

  // Get shifts from Redux
  const upcomingShifts = useAppSelector(selectUpcomingShifts);
  const pastScheduledShifts = useAppSelector(selectPastScheduledShifts);
  const completedShifts = useAppSelector(selectCompletedShifts);
  const activeShift = useAppSelector(selectActiveShift);
  const isLoadingMore = useAppSelector(selectShiftsLoadingMore);
  const hasMore = useAppSelector(selectShiftsHasMore);

  // Combine all shifts
  const allShifts = useMemo(() => {
    const combined: Shift[] = [];
    if (activeShift) combined.push(activeShift);
    combined.push(...upcomingShifts);
    combined.push(...pastScheduledShifts);
    combined.push(...completedShifts);
    return combined;
  }, [activeShift, upcomingShifts, pastScheduledShifts, completedShifts]);

  // Group shifts by date for calendar dots
  const shiftCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    allShifts.forEach((shift) => {
      const dateKey = shift.start_time.split('T')[0];
      const count = map.get(dateKey) || 0;
      map.set(dateKey, count + 1);
    });
    return map;
  }, [allShifts]);

  // Get shifts for selected date
  const selectedDateShifts = useMemo(() => {
    const selectedKey = formatDateKey(selectedDate);
    return allShifts.filter((shift) => {
      const shiftKey = shift.start_time.split('T')[0];
      return shiftKey === selectedKey;
    });
  }, [allShifts, selectedDate]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      logger.info('[UberShiftsScreen] Screen focused - refreshing shifts data');
      dispatch(fetchShifts({ page: 1, pageSize: 20 }));

      // Fetch badge counts
      const fetchBadgeCounts = async () => {
        try {
          if (user?.id) {
            const exchangeCount = await exchangeService.getPendingIncomingExchangesCount(user.id);
            setPendingExchangeCount(exchangeCount);
          }
          const availableCount = await exchangeService.getAvailableShiftsCount();
          setAvailableShiftsCount(availableCount);
        } catch (error) {
          logger.error('[UberShiftsScreen] Error fetching badge counts:', error);
        }
      };
      fetchBadgeCounts();
    }, [dispatch, user?.id])
  );

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Collapse month picker when selecting a date
    if (isMonthExpanded) {
      setIsMonthExpanded(false);
    }
  };

  // Handle month change from month picker
  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  // Handle pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchShifts({ page: 1, pageSize: 20 })).unwrap();
    } catch (error) {
      logger.error('Error refreshing shifts', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      dispatch(loadMoreShifts());
    }
  };

  // Handle shift press
  const handleShiftPress = (shift: Shift) => {
    navigation.navigate('ShiftDetails', { shift });
  };

  // Render shift card
  const renderShiftCard = ({ item, index }: { item: Shift; index: number }) => (
    <UberShiftCard
      shift={item}
      index={index}
      onPress={() => handleShiftPress(item)}
    />
  );

  // Render empty state
  const renderEmptyState = () => (
    <UberEmptyState
      title="No shifts scheduled"
      subtitle={`No shifts for ${formatDateHeader(selectedDate).toLowerCase()}`}
      actionLabel="Browse Open Shifts"
      onAction={() => navigation.navigate('AvailableShifts')}
    />
  );

  // Render loading footer
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={getUberColors(isDark).primary} />
      </View>
    );
  };

  // Total upcoming count
  const upcomingCount = upcomingShifts.length + (activeShift ? 1 : 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: uberColors.background.light }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: uberColors.background.surface, borderBottomColor: uberColors.border.light }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: uberColors.text.primary }]}>My Shifts</Text>
          {upcomingCount > 0 && (
            <Text style={[styles.headerSubtitle, { color: uberColors.text.secondary }]}>
              {upcomingCount} upcoming {upcomingCount === 1 ? 'shift' : 'shifts'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: uberColors.primary }, uberShadows.soft]}
          onPress={() => navigation.navigate('AvailableShifts')}
        >
          <Ionicons name="add" size={24} color={uberColors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Calendar Strip */}
      <UberCalendarStrip
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        onMonthToggle={() => setIsMonthExpanded(!isMonthExpanded)}
        shiftCountByDate={shiftCountByDate}
        isMonthExpanded={isMonthExpanded}
      />

      {/* Expandable Month Picker */}
      <UberMonthPicker
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        onMonthChange={handleMonthChange}
        isExpanded={isMonthExpanded}
        shiftCountByDate={shiftCountByDate}
      />

      {/* Quick Actions */}
      <View style={[styles.quickActions, { backgroundColor: uberColors.background.surface, borderBottomColor: uberColors.border.light }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: uberColors.background.light }]}
          onPress={() => navigation.navigate('AvailableShifts')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: `${uberColors.primary}15` }]}>
            <MaterialCommunityIcons
              name="calendar-search"
              size={20}
              color={uberColors.primary}
            />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={[styles.actionTitle, { color: uberColors.text.primary }]}>Available Shifts</Text>
          </View>
          {availableShiftsCount > 0 && (
            <View style={[styles.badge, { backgroundColor: uberColors.success }]}>
              <Text style={[styles.badgeText, { color: uberColors.text.inverse }]}>
                {availableShiftsCount > 9 ? '9+' : availableShiftsCount}
              </Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={uberColors.text.muted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: uberColors.background.light }]}
          onPress={() => navigation.navigate('ShiftExchanges')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: `${uberColors.primary}15` }]}>
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={20}
              color={uberColors.primary}
            />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={[styles.actionTitle, { color: uberColors.text.primary }]}>My Exchanges</Text>
          </View>
          {pendingExchangeCount > 0 && (
            <View style={[styles.badge, { backgroundColor: uberColors.error }]}>
              <Text style={[styles.badgeText, { color: uberColors.text.inverse }]}>
                {pendingExchangeCount > 9 ? '9+' : pendingExchangeCount}
              </Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={uberColors.text.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Selected Date Header */}
      <View style={[styles.dateHeader, { backgroundColor: uberColors.background.light }]}>
        <Text style={[styles.dateHeaderText, { color: uberColors.text.primary }]}>{formatDateHeader(selectedDate)}</Text>
        <Text style={[styles.shiftCount, { color: uberColors.text.secondary }]}>
          {selectedDateShifts.length} {selectedDateShifts.length === 1 ? 'shift' : 'shifts'}
        </Text>
      </View>

      {/* Shifts List */}
      <FlatList
        data={selectedDateShifts}
        renderItem={renderShiftCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={uberColors.primary}
            colors={[uberColors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.base,
    paddingTop: uberSpacing.lg,
    paddingBottom: uberSpacing.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: uberSpacing.xs,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: uberRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.sm,
    flexDirection: 'row',
    gap: uberSpacing.sm,
    borderBottomWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: uberSpacing.sm,
    paddingHorizontal: uberSpacing.md,
    borderRadius: uberRadius.lg,
    gap: uberSpacing.sm,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: uberRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.md,
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: '700',
  },
  shiftCount: {
    fontSize: 14,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: uberSpacing.sm,
    paddingBottom: uberSpacing.xl,
  },
  loadingFooter: {
    paddingVertical: uberSpacing.lg,
    alignItems: 'center',
  },
});
