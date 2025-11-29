/**
 * LeaveHistoryScreen - View Leave Request History
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import {
  fetchMyLeaveRequests,
  cancelLeaveRequest,
  setActiveFilters,
  selectLeaveRequests,
  selectActiveFilters,
} from '../../store/slices/leaveSlice';
import type { LeaveRequest, LeaveRequestStatus } from '../../types/leave.types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const STATUS_OPTIONS: Array<{ value: LeaveRequestStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DENIED', label: 'Denied' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const LeaveHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();

  const requests = useAppSelector(selectLeaveRequests);
  const activeFilters = useAppSelector(selectActiveFilters);
  const loading = useAppSelector((state) => state.leave.requestsLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Generate year options (current year ± 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  useEffect(() => {
    loadRequests();
  }, [activeFilters]);

  const loadRequests = async () => {
    await dispatch(fetchMyLeaveRequests(activeFilters));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleStatusFilter = (status: LeaveRequestStatus | 'ALL') => {
    dispatch(setActiveFilters({ status }));
  };

  const handleYearChange = (year: number) => {
    dispatch(setActiveFilters({ year }));
  };

  const handleCancelRequest = async (requestId: number) => {
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
      ]
    );
  };

  const getStatusColor = (status: LeaveRequestStatus) => {
    switch (status) {
      case 'PENDING':
        return '#F59E0B';
      case 'APPROVED':
        return '#22C55E';
      case 'DENIED':
        return '#EF4444';
      case 'CANCELLED':
        return '#6B7280';
      default:
        return colors.text.secondary;
    }
  };

  const getStatusIcon = (status: LeaveRequestStatus) => {
    switch (status) {
      case 'PENDING':
        return 'time-outline';
      case 'APPROVED':
        return 'checkmark-circle';
      case 'DENIED':
        return 'close-circle';
      case 'CANCELLED':
        return 'ban-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderRequestCard = (request: LeaveRequest) => {
    const statusColor = getStatusColor(request.status);
    const isPending = request.status === 'PENDING';
    const isCancelling = cancellingId === request.id;

    return (
      <TouchableOpacity
        key={request.id}
        style={styles.requestCard}
        onPress={() => navigation.navigate('LeaveRequestDetail', { requestId: request.id })}
        disabled={isCancelling}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.leaveTypeIndicator, { backgroundColor: `${request.leave_type.color_code}15` }]}>
              <View style={[styles.leaveTypeDot, { backgroundColor: request.leave_type.color_code }]} />
            </View>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>{request.leave_type.name}</Text>
              <Text style={styles.cardSubtitle}>
                {formatDate(request.start_date)} - {formatDate(request.end_date)}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons name={getStatusIcon(request.status) as any} size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{request.status}</Text>
          </View>
        </View>

        {/* Days */}
        <View style={styles.daysRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
          <Text style={styles.daysText}>
            {request.working_days} working day{request.working_days !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Approval Info */}
        {request.approved_by_user && (
          <View style={styles.approvalInfo}>
            <Ionicons name="person-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.approvalText}>
              {request.status === 'APPROVED' ? 'Approved' : 'Reviewed'} by{' '}
              {request.approved_by_user.full_name || request.approved_by_user.username}
            </Text>
          </View>
        )}

        {/* Actions */}
        {isPending && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelRequest(request.id)}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                  <Text style={styles.cancelButtonText}>Cancel Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Container style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
        <Ionicons name="close" size={28} color={colors.text.primary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <Text style={styles.mainHeading}>LEAVE HISTORY</Text>
        <Text style={styles.subtitle}>View and manage your leave requests</Text>

        {/* Filters */}
        <View style={styles.filtersSection}>
          {/* Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {STATUS_OPTIONS.map((option) => {
                const isActive = activeFilters.status === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => handleStatusFilter(option.value)}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Year Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {yearOptions.map((year) => {
                const isActive = activeFilters.year === year;
                return (
                  <TouchableOpacity
                    key={year}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => handleYearChange(year)}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Requests List */}
        {loading && (!requests || requests.length === 0) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : requests && requests.length > 0 ? (
          <View style={styles.requestsList}>
            {requests.map(renderRequestCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No leave requests found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or submit a new request</Text>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Request Leave"
          variant="primary"
          size="large"
          onPress={() => navigation.navigate('LeaveRequest')}
          icon={<Ionicons name="add-circle-outline" size={22} color={colors.white} />}
        />
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    backgroundColor: colors.white,
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dededeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    paddingTop: spacing['4xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  // Header
  mainHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  // Filters
  filtersSection: {
    marginBottom: spacing.lg,
  },
  filterGroup: {
    marginBottom: spacing.base,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    marginRight: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: `${colors.primary}10`,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  // Requests List
  requestsList: {
    gap: spacing.base,
  },
  requestCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  leaveTypeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveTypeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  daysText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  approvalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  approvalText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  cardActions: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['4xl'],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // Footer
  footer: {
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
