/**
 * UberAvailableShiftsScreen - Browse and claim shifts from the open pool
 * Uber-style minimalist design with animations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../types/navigation';
import { uberColors, uberRadius, uberShadows, uberSpacing, uberShiftStatus } from '../../../theme/uberTheme';
import exchangeService, { OpenShiftRequest } from '../../../services/exchangeService';
import { UberEmptyState } from './components';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Animated shift card component
const AvailableShiftCard: React.FC<{
  shift: OpenShiftRequest;
  index: number;
  onClaim: () => void;
  isClaiming: boolean;
}> = ({ shift, index, onClaim, isClaiming }) => {
  const scale = useSharedValue(1);
  const startTime = new Date(shift.original_shift_details.start_time);
  const endTime = new Date(shift.original_shift_details.end_time);

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Format hour for badge
  const hour = startTime.getHours();
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? 'PM' : 'AM';

  // Format time range
  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Calculate duration
  const durationHours = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[styles.card, animatedStyle]}>
          {/* Time Badge */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeNumber}>{String(displayHour).padStart(2, '0')}</Text>
            <Text style={styles.timePeriod}>{period}</Text>
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <Text style={styles.venueName} numberOfLines={1}>
              {shift.original_shift_details.venue_details?.name || 'Unknown Venue'}
            </Text>
            {shift.original_shift_details.venue_details?.address && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color={uberColors.text.muted} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {shift.original_shift_details.venue_details?.address}
                </Text>
              </View>
            )}
            <Text style={styles.shiftDate}>
              {startTime.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })} • {formatTime(startTime)} - {formatTime(endTime)} • {durationHours}h
            </Text>

            {/* Released by info */}
            <View style={styles.releasedByRow}>
              <Ionicons name="person-outline" size={12} color={uberColors.text.muted} />
              <Text style={styles.releasedByText}>
                Released by {shift.requesting_user_details.first_name}
              </Text>
            </View>
          </View>

          {/* Claim Button */}
          <TouchableOpacity
            style={[styles.claimButton, isClaiming && styles.claimButtonDisabled]}
            onPress={onClaim}
            disabled={isClaiming}
            activeOpacity={0.8}
          >
            {isClaiming ? (
              <ActivityIndicator size="small" color={uberColors.text.inverse} />
            ) : (
              <Text style={styles.claimButtonText}>Claim</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

export const UberAvailableShiftsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [availableShifts, setAvailableShifts] = useState<OpenShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingShiftId, setClaimingShiftId] = useState<number | null>(null);

  const fetchAvailableShifts = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const shifts = await exchangeService.getAvailableShifts();
      setAvailableShifts(shifts);
    } catch (error) {
      console.error('Error fetching available shifts:', error);
      Alert.alert('Error', 'Failed to load available shifts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAvailableShifts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAvailableShifts();
    }, [])
  );

  const handleClaimShift = (shift: OpenShiftRequest) => {
    Alert.alert(
      'Claim Shift',
      `Claim this shift at ${shift.original_shift_details.venue_details?.name || 'this venue'}?\n\nRequires manager approval.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: async () => {
            try {
              setClaimingShiftId(shift.id);
              await exchangeService.claimShift(shift.id);
              Alert.alert('Success', 'Shift claimed! Awaiting manager approval.', [
                { text: 'OK', onPress: () => fetchAvailableShifts() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to claim shift.');
            } finally {
              setClaimingShiftId(null);
            }
          },
        },
      ]
    );
  };

  const renderShiftCard = ({ item, index }: { item: OpenShiftRequest; index: number }) => (
    <AvailableShiftCard
      shift={item}
      index={index}
      onClaim={() => handleClaimShift(item)}
      isClaiming={claimingShiftId === item.id}
    />
  );

  const renderEmpty = () => (
    <UberEmptyState
      title="No available shifts"
      subtitle="Check back later for new opportunities"
      actionLabel="Refresh"
      onAction={() => fetchAvailableShifts()}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={uberColors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Shifts</Text>
        <TouchableOpacity onPress={() => fetchAvailableShifts()} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color={uberColors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <View style={styles.infoBannerIcon}>
          <Ionicons name="information-circle" size={18} color={uberColors.info} />
        </View>
        <Text style={styles.infoBannerText}>
          Released shifts require manager approval after claiming
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={uberColors.primary} />
        </View>
      ) : (
        <FlatList
          data={availableShifts}
          renderItem={renderShiftCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          ListHeaderComponent={
            availableShifts.length > 0 ? (
              <Text style={styles.shiftCount}>
                {availableShifts.length} {availableShifts.length === 1 ? 'shift' : 'shifts'} available
              </Text>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAvailableShifts(true);
              }}
              tintColor={uberColors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uberColors.background.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.md,
    backgroundColor: uberColors.background.surface,
    borderBottomWidth: 1,
    borderBottomColor: uberColors.border.light,
  },
  backButton: {
    padding: uberSpacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: uberColors.text.primary,
  },
  refreshButton: {
    padding: uberSpacing.xs,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${uberColors.info}10`,
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.sm,
    gap: uberSpacing.sm,
  },
  infoBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${uberColors.info}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: uberColors.text.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    padding: uberSpacing.base,
  },
  shiftCount: {
    fontSize: 13,
    fontWeight: '600',
    color: uberColors.text.muted,
    marginBottom: uberSpacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius.xl,
    padding: uberSpacing.base,
    marginBottom: uberSpacing.md,
    borderWidth: 1,
    borderColor: uberColors.border.light,
    alignItems: 'center',
    ...uberShadows.soft,
  },
  timeBadge: {
    width: 52,
    height: 52,
    borderRadius: uberRadius.lg,
    backgroundColor: uberColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uberSpacing.md,
  },
  timeNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: uberColors.text.inverse,
  },
  timePeriod: {
    fontSize: 10,
    fontWeight: '600',
    color: uberColors.text.inverse,
    opacity: 0.9,
  },
  cardContent: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '700',
    color: uberColors.text.primary,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: uberColors.text.muted,
    flex: 1,
  },
  shiftDate: {
    fontSize: 13,
    fontWeight: '500',
    color: uberColors.text.secondary,
    marginBottom: uberSpacing.xs,
  },
  releasedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  releasedByText: {
    fontSize: 11,
    color: uberColors.text.muted,
  },
  claimButton: {
    backgroundColor: uberColors.primary,
    paddingHorizontal: uberSpacing.lg,
    paddingVertical: uberSpacing.sm,
    borderRadius: uberRadius.full,
    marginLeft: uberSpacing.sm,
  },
  claimButtonDisabled: {
    opacity: 0.7,
  },
  claimButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: uberColors.text.inverse,
  },
});
