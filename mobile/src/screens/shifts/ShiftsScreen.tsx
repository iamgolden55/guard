/**
 * ShiftsScreen
 * List view of all shifts with filtering (All/Upcoming/Completed)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { Container, Heading2, Body, Card } from '@components/ui';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import {
  selectUpcomingShifts,
  selectPastScheduledShifts,
  selectCompletedShifts,
  selectActiveShift,
  selectShiftsLoadingMore,
  selectShiftsHasMore,
  Shift,
  loadMoreShifts,
  fetchShifts
} from '../../store/slices/shiftsSlice';
import { ShiftCard, ShiftFilterTabs, ShiftFilter } from './components';
import { colors, spacing, getColors } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../utils/logger';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useAuth } from '../../hooks/useAuth';
import exchangeService from '../../services/exchangeService';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const ShiftsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);
  const [activeFilter, setActiveFilter] = useState<ShiftFilter>('all');
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

  // Log screen view
  React.useEffect(() => {
    logger.info('Shifts screen viewed');
  }, []);

  // Refresh shifts when screen comes into focus
  // This ensures transfer/release status badges are updated after creating a transfer
  useFocusEffect(
    useCallback(() => {
      logger.info('[ShiftsScreen] Screen focused - refreshing shifts data');
      dispatch(fetchShifts({ page: 1, pageSize: 20 }));

      // Fetch badge counts for quick actions
      const fetchBadgeCounts = async () => {
        try {
          // Fetch pending exchange count (where user is target)
          if (user?.id) {
            const exchangeCount = await exchangeService.getPendingIncomingExchangesCount(user.id);
            setPendingExchangeCount(exchangeCount);
            logger.info('[ShiftsScreen] Pending exchange count:', exchangeCount);
          }

          // Fetch available shifts count
          const availableCount = await exchangeService.getAvailableShiftsCount();
          setAvailableShiftsCount(availableCount);
          logger.info('[ShiftsScreen] Available shifts count:', availableCount);
        } catch (error) {
          logger.error('[ShiftsScreen] Error fetching badge counts:', error);
        }
      };
      fetchBadgeCounts();
    }, [dispatch, user?.id])
  );

  // Combine all shifts with priority ordering:
  // 1. Active shift always first
  // 2. Upcoming shifts (soonest first - already sorted in Redux)
  // 3. Past scheduled shifts (missed - most recent first)
  // 4. Completed shifts (most recent first)
  const allShifts = useMemo(() => {
    const combined: Shift[] = [];

    // Add active shift first (highest priority)
    if (activeShift) {
      combined.push(activeShift);
    }

    // Add upcoming shifts (already sorted soonest first in Redux)
    combined.push(...upcomingShifts);

    // Add past scheduled shifts (missed/overdue)
    combined.push(...pastScheduledShifts);

    // Add completed shifts
    combined.push(...completedShifts);

    // DO NOT re-sort - preserve priority order established above
    return combined;
  }, [activeShift, upcomingShifts, pastScheduledShifts, completedShifts]);

  // Filter shifts based on active filter
  const filteredShifts = useMemo(() => {
    switch (activeFilter) {
      case 'upcoming':
        const upcoming = [...upcomingShifts];
        if (activeShift) {
          upcoming.unshift(activeShift);
        }
        return upcoming;
      case 'completed':
        return completedShifts;
      default:
        return allShifts;
    }
  }, [activeFilter, allShifts, upcomingShifts, completedShifts, activeShift]);

  // Calculate counts for tabs
  const filterCounts = useMemo(() => {
    const upcomingCount = upcomingShifts.length + (activeShift ? 1 : 0);
    return {
      all: allShifts.length,
      upcoming: upcomingCount,
      completed: completedShifts.length,
    };
  }, [allShifts, upcomingShifts, completedShifts, activeShift]);

  // Handle filter change
  const handleFilterChange = (filter: ShiftFilter) => {
    logger.info('Shift filter changed', { filter });
    setActiveFilter(filter);

    // Note: Pagination state is shared across all filters
    // The categorization happens in the Redux slice, so we don't need to reset pagination here
    // The user will see the filtered results from the currently loaded pages
  };

  // Handle pull to refresh
  const handleRefresh = async () => {
    logger.info('Refreshing shifts list');
    setRefreshing(true);

    try {
      // Fetch first page of shifts (resets pagination)
      await dispatch(fetchShifts({ page: 1, pageSize: 20 })).unwrap();
      logger.info('Shifts list refreshed');
    } catch (error) {
      logger.error('Error refreshing shifts', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle load more (infinite scroll)
  const handleLoadMore = () => {
    // Don't load more if already loading or no more data
    if (isLoadingMore || !hasMore) {
      return;
    }

    logger.info('Loading more shifts');
    dispatch(loadMoreShifts());
  };

  // Handle shift press
  const handleShiftPress = (shift: Shift) => {
    logger.info('Shift card tapped', { shiftId: shift.id });
    navigation.navigate('ShiftDetails', { shift });
  };

  // Render empty state
  const renderEmptyState = () => {
    const getEmptyMessage = () => {
      switch (activeFilter) {
        case 'upcoming':
          return 'No upcoming shifts scheduled';
        case 'completed':
          return 'No completed shifts yet';
        default:
          return 'No shifts found';
      }
    };

    return (
      <Card variant="flat" padding="xl" style={styles.emptyState}>
        <Ionicons
          name="calendar-outline"
          size={64}
          color={colors.gray[400]}
          style={styles.emptyIcon}
        />
        <Heading2 style={styles.emptyTitle}>No Shifts</Heading2>
        <Body color={colors.text.secondary} style={styles.emptyText}>
          {getEmptyMessage()}
        </Body>
      </Card>
    );
  };

  // Render shift card
  const renderShiftCard = ({ item }: { item: Shift }) => (
    <ShiftCard shift={item} onPress={() => handleShiftPress(item)} />
  );

  // Render loading footer
  const renderFooter = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Body color={colors.text.secondary} style={styles.loadingText}>
          Loading more shifts...
        </Body>
      </View>
    );
  };

  return (
    <Container scrollable={false} safeArea={false} style={{ padding: 0, backgroundColor: themeColors.background.secondary }}>
      <View style={styles.container}>
        {/* Header with Filters */}
        <View style={[styles.header, { backgroundColor: themeColors.background.primary, borderBottomColor: themeColors.border.light }]}>
          <Heading2 style={[styles.title, { color: themeColors.text.primary }]}>My Shifts</Heading2>
          <ShiftFilterTabs
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            counts={filterCounts}
          />
        </View>

        {/* Quick Actions */}
        <View style={[styles.quickActions, { backgroundColor: themeColors.background.primary, borderBottomColor: themeColors.border.light }]}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: themeColors.background.secondary }]}
            onPress={() => navigation.navigate('AvailableShifts')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: `${themeColors.primary}15` }]}>
              <MaterialCommunityIcons name="calendar-search" size={22} color={themeColors.primary} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: themeColors.text.primary }]}>Available Shifts</Text>
              <Text style={[styles.actionSubtitle, { color: themeColors.text.secondary }]}>Browse open shifts to claim</Text>
            </View>
            {/* Available shifts count badge */}
            {availableShiftsCount > 0 && (
              <View style={[styles.badge, styles.badgeSuccess]}>
                <Text style={styles.badgeText}>
                  {availableShiftsCount > 9 ? '9+' : availableShiftsCount}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={themeColors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: themeColors.background.secondary }]}
            onPress={() => navigation.navigate('ShiftExchanges')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: `${themeColors.primary}15` }]}>
              <MaterialCommunityIcons name="swap-horizontal" size={22} color={themeColors.primary} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: themeColors.text.primary }]}>My Exchanges</Text>
              <Text style={[styles.actionSubtitle, { color: themeColors.text.secondary }]}>View transfer history</Text>
            </View>
            {/* Pending exchange count badge */}
            {pendingExchangeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {pendingExchangeCount > 9 ? '9+' : pendingExchangeCount}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={themeColors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Shifts List */}
        <FlatList
          data={filteredShifts}
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
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    // backgroundColor and borderBottomColor applied inline with themeColors
    borderBottomWidth: 1,
  },
  title: {
    marginBottom: spacing.md,
    // color applied inline with themeColors
  },
  quickActions: {
    // backgroundColor and borderBottomColor applied inline with themeColors
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor applied inline with themeColors
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    gap: spacing.md,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor applied inline with themeColors
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    // color applied inline with themeColors
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    // color applied inline with themeColors
  },
  listContent: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyIcon: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  loadingFooter: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
  },
  badge: {
    backgroundColor: colors.error,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: spacing.xs,
  },
  badgeSuccess: {
    backgroundColor: colors.success,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
