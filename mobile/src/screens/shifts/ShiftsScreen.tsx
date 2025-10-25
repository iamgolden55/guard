/**
 * ShiftsScreen
 * List view of all shifts with filtering (All/Upcoming/Completed)
 */

import React, { useState, useMemo } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { Container, Heading2, Body, Card } from '@components/ui';
import { Ionicons } from '@expo/vector-icons';
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
import { colors, spacing } from '../../theme';
import { logger } from '../../utils/logger';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const ShiftsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const [activeFilter, setActiveFilter] = useState<ShiftFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

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

  // Combine all shifts
  const allShifts = useMemo(() => {
    const combined: Shift[] = [];

    // Add active shift first
    if (activeShift) {
      combined.push(activeShift);
    }

    // Add upcoming shifts
    combined.push(...upcomingShifts);

    // Add past scheduled shifts (missed/overdue)
    combined.push(...pastScheduledShifts);

    // Add completed shifts
    combined.push(...completedShifts);

    // Sort by start time (most recent first)
    return combined.sort((a, b) => {
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
    });
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
    <Container scrollable={false} safeArea={false} style={{ padding: 0, backgroundColor: colors.background.secondary }}>
      <View style={styles.container}>
        {/* Header with Filters */}
        <View style={styles.header}>
          <Heading2 style={styles.title}>My Shifts</Heading2>
          <ShiftFilterTabs
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            counts={filterCounts}
          />
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
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    marginBottom: spacing.md,
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
});
