/**
 * ManageShiftsListScreen - Admin/manager-only view of every company shift
 * Paginated list with status filter chips. Tap a row to open ShiftDetails.
 */

import React, { useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppSelector, useAppDispatch } from '../../../hooks/useRedux';
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
} from '../../../store/slices/manageShiftsSlice';
import type { Shift } from '../../../store/slices/shiftsSlice';
import type { MainStackParamList } from '../../../types/navigation';
import { useTheme } from '../../../hooks/useTheme';
import { getUberColors, uberRadius, uberSpacing } from '../../../theme/uberTheme';
import { UberShiftCard, UberEmptyState } from '../uber/components';
import { logger } from '../../../utils/logger';

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

export const ManageShiftsListScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const colors = getUberColors(isDark);

  const shifts = useAppSelector(selectManageShiftsFiltered);
  const filter = useAppSelector(selectManageShiftsFilter);
  const isLoading = useAppSelector(selectManageShiftsLoading);
  const isLoadingMore = useAppSelector(selectManageShiftsLoadingMore);
  const hasMore = useAppSelector(selectManageShiftsHasMore);
  const error = useAppSelector(selectManageShiftsError);

  const [refreshing, setRefreshing] = React.useState(false);

  const loadPageOne = useCallback(
    (activeFilter: ManageShiftsFilter) => {
      const status = activeFilter === 'all' ? undefined : activeFilter;
      return dispatch(fetchAllCompanyShifts({ page: 1, pageSize: 6, status }));
    },
    [dispatch]
  );

  useFocusEffect(
    useCallback(() => {
      loadPageOne(filter);
    }, [loadPageOne, filter])
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

  const handleShiftPress = (shift: Shift) => {
    navigation.navigate('ShiftDetails', { shift });
  };

  const renderItem = ({ item, index }: { item: Shift; index: number }) => (
    <UberShiftCard shift={item} index={index} onPress={() => handleShiftPress(item)} />
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <UberEmptyState
        title="No shifts"
        subtitle={
          filter === 'all'
            ? 'No shifts have been scheduled yet.'
            : `No ${filter.replace('_', ' ')} shifts right now.`
        }
      />
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.light }]}>
      <View
        style={[
          styles.filterBar,
          { backgroundColor: colors.background.surface, borderBottomColor: colors.border.light },
        ]}
      >
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = item.value === filter;
            return (
              <TouchableOpacity
                onPress={() => handleFilterChange(item.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.background.light,
                    borderColor: active ? colors.primary : colors.border.light,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.text.inverse : colors.text.primary },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {isLoading && shifts.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={shifts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
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
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('CreateShift')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.text.inverse} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: {
    borderBottomWidth: 1,
  },
  filterContent: {
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.sm,
    gap: uberSpacing.sm,
  },
  chip: {
    paddingHorizontal: uberSpacing.md,
    paddingVertical: uberSpacing.xs,
    borderRadius: uberRadius.full,
    borderWidth: 1,
    marginRight: uberSpacing.sm,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
    paddingTop: uberSpacing.sm,
    paddingBottom: uberSpacing.xl,
  },
  footer: {
    paddingVertical: uberSpacing.lg,
    alignItems: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: uberSpacing.base,
    bottom: uberSpacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
});
