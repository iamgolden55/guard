/**
 * LeaveRequestDetailScreen - View Leave Request Details
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import {
  cancelLeaveRequest,
  selectLeaveRequests,
  fetchMyLeaveRequests,
} from '../../store/slices/leaveSlice';
import type { LeaveRequestStatus } from '../../types/leave.types';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RouteProps = RouteProp<MainStackParamList, 'LeaveRequestDetail'>;

export const LeaveRequestDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const dispatch = useAppDispatch();

  const { requestId } = route.params;
  const requests = useAppSelector(selectLeaveRequests);
  const request = requests.find((r) => r.id === requestId);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    // Refresh requests if not found
    if (!request) {
      dispatch(fetchMyLeaveRequests());
    }
  }, [requestId]);

  const handleCancel = async () => {
    if (!request) return;

    Alert.alert(
      'Cancel Leave Request',
      'Are you sure you want to cancel this leave request? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            await dispatch(cancelLeaveRequest(requestId));
            setCancelling(false);
            navigation.goBack();
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
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!request) {
    return (
      <Container style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading request details...</Text>
        </View>
      </Container>
    );
  }

  const statusColor = getStatusColor(request.status);
  const isPending = request.status === 'PENDING';

  return (
    <Container style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
        <Ionicons name="close" size={28} color={colors.text.primary} />
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.mainHeading}>REQUEST DETAILS</Text>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
          <Ionicons name={getStatusIcon(request.status) as any} size={24} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{request.status}</Text>
        </View>

        {/* Leave Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Leave Type</Text>
          <View style={styles.leaveTypeCard}>
            <View style={[styles.leaveTypeIndicator, { backgroundColor: `${request.leave_type.color_code}15` }]}>
              <Ionicons name="calendar" size={24} color={request.leave_type.color_code} />
            </View>
            <View style={styles.leaveTypeInfo}>
              <Text style={styles.leaveTypeName}>{request.leave_type.name}</Text>
              <Text style={styles.leaveTypeCode}>{request.leave_type.code}</Text>
            </View>
          </View>
        </View>

        {/* Dates Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.dateCard}>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <Text style={styles.dateValue}>{formatDate(request.start_date)}</Text>
              </View>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>End Date</Text>
                <Text style={styles.dateValue}>{formatDate(request.end_date)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.workingDaysCard}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.workingDaysText}>
              {request.working_days} working day{request.working_days !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Reason Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reason</Text>
          <View style={styles.reasonCard}>
            <Text style={styles.reasonText}>{request.reason}</Text>
          </View>
        </View>

        {/* Approval Information */}
        {(request.approved_by_user || request.approval_comments) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {request.status === 'APPROVED' ? 'Approval Information' : 'Review Information'}
            </Text>
            <View style={styles.approvalCard}>
              {request.approved_by_user && (
                <View style={styles.approverRow}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.text.secondary} />
                  <View style={styles.approverInfo}>
                    <Text style={styles.approverLabel}>Reviewed by</Text>
                    <Text style={styles.approverName}>
                      {request.approved_by_user.full_name || request.approved_by_user.username}
                    </Text>
                  </View>
                </View>
              )}
              {request.approved_at && (
                <View style={styles.timestampRow}>
                  <Ionicons name="time-outline" size={16} color={colors.text.tertiary} />
                  <Text style={styles.timestampText}>{formatDateTime(request.approved_at)}</Text>
                </View>
              )}
              {request.approval_comments && (
                <View style={styles.commentsBox}>
                  <Text style={styles.commentsLabel}>Comments</Text>
                  <Text style={styles.commentsText}>{request.approval_comments}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Submission Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Submission Details</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Submitted</Text>
              <Text style={styles.infoValue}>{formatDateTime(request.created_at)}</Text>
            </View>
            {request.updated_at !== request.created_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Updated</Text>
                <Text style={styles.infoValue}>{formatDateTime(request.updated_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer - Cancel Button for Pending Requests */}
      {isPending && (
        <View style={styles.footer}>
          <Button
            title={cancelling ? 'Cancelling...' : 'Cancel Request'}
            variant="secondary"
            size="large"
            onPress={handleCancel}
            disabled={cancelling}
            icon={
              cancelling ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Ionicons name="close-circle-outline" size={22} color={colors.error} />
              )
            }
            style={styles.cancelButton}
          />
        </View>
      )}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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
    marginBottom: spacing.lg,
    letterSpacing: -0.5,
  },
  // Status Badge
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    marginBottom: spacing.xl,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  // Leave Type Card
  leaveTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    gap: spacing.sm,
  },
  leaveTypeIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveTypeInfo: {
    flex: 1,
  },
  leaveTypeName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  leaveTypeCode: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Date Card
  dateCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dateDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: spacing.sm,
  },
  workingDaysCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12,
    gap: spacing.xs,
  },
  workingDaysText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  // Reason Card
  reasonCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: spacing.base,
  },
  reasonText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary,
  },
  // Approval Card
  approvalCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: spacing.base,
  },
  approverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  approverInfo: {
    flex: 1,
  },
  approverLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  approverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timestampText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  commentsBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  commentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  commentsText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  // Info Card
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: spacing.base,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
  },
  // Footer
  footer: {
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    backgroundColor: `${colors.error}10`,
    borderWidth: 2,
    borderColor: colors.error,
  },
});
