/**
 * AvailableShiftsScreen - Browse and claim shifts from the open pool
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@components/ui';
import { colors, spacing, getColors } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import exchangeService, { OpenShiftRequest } from '../../services/exchangeService';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const AvailableShiftsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);
  const [availableShifts, setAvailableShifts] = useState<OpenShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingShiftId, setClaimingShiftId] = useState<number | null>(null);

  // Fetch available shifts
  const fetchAvailableShifts = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const shifts = await exchangeService.getAvailableShifts();
      setAvailableShifts(shifts);
    } catch (error) {
      console.error('Error fetching available shifts:', error);
      Alert.alert('Error', 'Failed to load available shifts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAvailableShifts();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchAvailableShifts();
    }, [])
  );

  // Handle pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailableShifts(true);
  };

  // Handle claiming a shift
  const handleClaimShift = (shift: OpenShiftRequest) => {
    Alert.alert(
      'Claim Shift',
      `Are you sure you want to claim this shift at ${shift.original_shift_details.venue.name}?\n\nThis requires manager approval.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim Shift',
          onPress: async () => {
            try {
              setClaimingShiftId(shift.id);
              await exchangeService.claimShift(shift.id);

              Alert.alert(
                'Success',
                'Shift claim submitted! You will be notified when a manager approves it.',
                [
                  {
                    text: 'OK',
                    onPress: () => fetchAvailableShifts(),
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error claiming shift:', error);
              Alert.alert('Error', error.message || 'Failed to claim shift. Please try again.');
            } finally {
              setClaimingShiftId(null);
            }
          },
        },
      ]
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={64} color={themeColors.text.secondary} />
      <Text style={[styles.emptyTitle, { color: themeColors.text.primary }]}>No Available Shifts</Text>
      <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
        There are no shifts available to claim at the moment. Check back later!
      </Text>
      <Button
        title="Refresh"
        variant="secondary"
        onPress={() => fetchAvailableShifts()}
        style={styles.refreshButton}
        icon={<Ionicons name="refresh" size={18} color={themeColors.primary} />}
      />
    </View>
  );

  // Render shift card
  const renderShiftCard = (shift: OpenShiftRequest) => {
    const startTime = new Date(shift.original_shift_details.start_time);
    const endTime = new Date(shift.original_shift_details.end_time);
    const isClaiming = claimingShiftId === shift.id;

    return (
      <View key={shift.id} style={[styles.shiftCard, { backgroundColor: themeColors.background.secondary, borderColor: themeColors.border.light }]}>
        {/* Shift Header */}
        <View style={styles.shiftHeader}>
          <View style={styles.venueInfo}>
            <Ionicons name="location" size={20} color={themeColors.primary} />
            <Text style={[styles.venueName, { color: themeColors.text.primary }]}>{shift.original_shift_details.venue.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: themeColors.success + '20' }]}>
            <Text style={[styles.statusText, { color: themeColors.success }]}>OPEN</Text>
          </View>
        </View>

        {/* Shift Details */}
        <View style={styles.shiftDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={themeColors.text.secondary} />
            <Text style={[styles.detailText, { color: themeColors.text.secondary }]}>
              {startTime.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={themeColors.text.secondary} />
            <Text style={[styles.detailText, { color: themeColors.text.secondary }]}>
              {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' - '}
              {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {shift.original_shift_details.required_security_role && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="shield-account" size={16} color={themeColors.text.secondary} />
              <Text style={[styles.detailText, { color: themeColors.text.secondary }]}>{shift.original_shift_details.required_security_role}</Text>
            </View>
          )}
        </View>

        {/* Release Info */}
        <View style={[styles.releaseInfo, { borderTopColor: themeColors.border.light }]}>
          <Text style={[styles.releaseLabel, { color: themeColors.text.secondary }]}>Released by:</Text>
          <Text style={[styles.releasedBy, { color: themeColors.text.primary }]}>
            {shift.requesting_user_details.first_name} {shift.requesting_user_details.last_name}
          </Text>
        </View>

        {shift.request_reason && (
          <View style={[styles.reasonBox, { backgroundColor: themeColors.background.tertiary }]}>
            <Text style={[styles.reasonLabel, { color: themeColors.text.secondary }]}>Reason:</Text>
            <Text style={[styles.reasonText, { color: themeColors.text.primary }]}>{shift.request_reason}</Text>
          </View>
        )}

        {/* Action Button */}
        <Button
          title={isClaiming ? 'Claiming...' : 'Claim Shift'}
          variant="primary"
          onPress={() => handleClaimShift(shift)}
          style={styles.claimButton}
          disabled={isClaiming}
          icon={
            isClaiming ? undefined : (
              <MaterialCommunityIcons name="hand-back-right-outline" size={20} color={themeColors.white} />
            )
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.background.secondary, borderBottomColor: themeColors.border.light }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Available Shifts</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => fetchAvailableShifts()} style={styles.refreshIconButton}>
            <Ionicons name="refresh" size={22} color={themeColors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Banner */}
      <View style={[styles.infoBanner, { backgroundColor: themeColors.info + '15' }]}>
        <Ionicons name="information-circle-outline" size={20} color={themeColors.info} />
        <Text style={[styles.infoBannerText, { color: themeColors.text.secondary }]}>
          These shifts have been released by other staff members. Claims require manager approval.
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>Loading available shifts...</Text>
        </View>
      ) : availableShifts.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.text.secondary} />}
        >
          {/* Shift Count */}
          <Text style={[styles.shiftCount, { color: themeColors.text.secondary }]}>
            {availableShifts.length} {availableShifts.length === 1 ? 'shift' : 'shifts'} available
          </Text>

          {/* Shift List */}
          {availableShifts.map(renderShiftCard)}

          {/* Bottom Spacing */}
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  refreshIconButton: {
    padding: spacing.xs,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.info + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  refreshButton: {
    minWidth: 120,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  shiftCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  venueName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  shiftDetails: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  releaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  releaseLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  releasedBy: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  reasonBox: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  claimButton: {
    marginTop: spacing.md,
  },
});
