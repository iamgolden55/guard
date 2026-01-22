/**
 * UberShiftExchangesScreen - View shift exchange history and pending requests
 * Uber-style minimalist design with segmented tabs
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
import { uberColors, uberRadius, uberShadows, uberSpacing } from '../../../theme/uberTheme';
import exchangeService, { ShiftExchange, OpenShiftRequest } from '../../../services/exchangeService';
import { useAuth } from '../../../hooks/useAuth';
import { UberEmptyState } from './components';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type TabType = 'exchanges' | 'releases';

// Status color helper
const getStatusStyle = (status: string): { bg: string; text: string } => {
  switch (status) {
    case 'pending':
      return { bg: '#FEF3C7', text: '#D97706' };
    case 'accepted_by_target':
    case 'claimed':
      return { bg: '#DBEAFE', text: '#3B82F6' };
    case 'approved':
      return { bg: '#DCFCE7', text: '#22C55E' };
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return { bg: '#FEE2E2', text: '#EF4444' };
    case 'open':
      return { bg: '#DCFCE7', text: '#22C55E' };
    default:
      return { bg: '#F3F4F6', text: '#6B7280' };
  }
};

// Format status label
const getStatusLabel = (status: string): string => {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// Exchange Card Component
const ExchangeCard: React.FC<{
  exchange: ShiftExchange;
  index: number;
  currentUserId: number | undefined;
  onAccept: () => void;
  onCancel: () => void;
  isActioning: boolean;
}> = ({ exchange, index, currentUserId, onAccept, onCancel, isActioning }) => {
  const scale = useSharedValue(1);
  const startTime = new Date(exchange.original_shift_details.start_time);
  const statusStyle = getStatusStyle(exchange.status);

  const isRequestingUser = currentUserId == exchange.requesting_user;
  const isTargetUser = currentUserId == exchange.target_user;
  const isPending = exchange.status === 'pending';
  const isWaitingApproval = exchange.status === 'accepted_by_target';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="swap-horizontal" size={20} color={uberColors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>Direct Exchange</Text>
            <Text style={styles.cardSubtitle}>
              {isRequestingUser
                ? `With ${exchange.target_user_details.first_name} ${exchange.target_user_details.last_name}`
                : `From ${exchange.requesting_user_details.first_name} ${exchange.requesting_user_details.last_name}`}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {getStatusLabel(exchange.status)}
            </Text>
          </View>
        </View>

        {/* Shift Info */}
        <View style={styles.shiftInfo}>
          <Text style={styles.venueName}>{exchange.original_shift_details.venue.name}</Text>
          <Text style={styles.shiftTime}>
            {startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Reason */}
        {exchange.request_reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>{exchange.request_reason}</Text>
          </View>
        )}

        {/* Actions */}
        {isPending && isTargetUser && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={onAccept}
              disabled={isActioning}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onCancel}
              disabled={isActioning}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {isPending && isRequestingUser && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={isActioning}
          >
            <Text style={styles.cancelButtonText}>
              {isActioning ? 'Cancelling...' : 'Cancel Request'}
            </Text>
          </TouchableOpacity>
        )}

        {isWaitingApproval && (
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={14} color={uberColors.info} />
            <Text style={styles.infoText}>Waiting for manager approval</Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

// Release Card Component
const ReleaseCard: React.FC<{
  request: OpenShiftRequest;
  index: number;
  onCancel: () => void;
  isActioning: boolean;
}> = ({ request, index, onCancel, isActioning }) => {
  const startTime = new Date(request.original_shift_details.start_time);
  const statusStyle = getStatusStyle(request.status);
  const isOpen = request.status === 'open';
  const isClaimed = request.status === 'claimed';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${uberColors.success}15` }]}>
            <MaterialCommunityIcons name="hand-extended-outline" size={20} color={uberColors.success} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>Released to Pool</Text>
            {request.claimed_by_details && (
              <Text style={styles.cardSubtitle}>
                Claimed by {request.claimed_by_details.first_name} {request.claimed_by_details.last_name}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {getStatusLabel(request.status)}
            </Text>
          </View>
        </View>

        {/* Shift Info */}
        <View style={styles.shiftInfo}>
          <Text style={styles.venueName}>{request.original_shift_details.venue.name}</Text>
          <Text style={styles.shiftTime}>
            {startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Reason */}
        {request.request_reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>{request.request_reason}</Text>
          </View>
        )}

        {/* Status Info */}
        {isOpen && (
          <View style={styles.infoBox}>
            <Ionicons name="people-outline" size={14} color={uberColors.success} />
            <Text style={styles.infoText}>Available for others to claim</Text>
          </View>
        )}

        {isClaimed && (
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={14} color={uberColors.info} />
            <Text style={styles.infoText}>Claimed - awaiting approval</Text>
          </View>
        )}

        {/* Cancel Action */}
        {(isOpen || isClaimed) && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={isActioning}
          >
            <Text style={styles.cancelButtonText}>
              {isActioning ? 'Cancelling...' : 'Cancel Release'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

export const UberShiftExchangesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [activeTab, setActiveTab] = useState<TabType>('exchanges');
  const [directExchanges, setDirectExchanges] = useState<ShiftExchange[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const fetchExchangeData = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const data = await exchangeService.getAllExchangeActivities();
      setDirectExchanges(data.direct_exchanges);
      setOpenRequests(data.open_requests);
    } catch (error) {
      Alert.alert('Error', 'Failed to load exchanges.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExchangeData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchExchangeData();
    }, [])
  );

  const handleAcceptExchange = (exchange: ShiftExchange) => {
    Alert.alert('Accept Exchange', 'Accept this shift exchange?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            setActioningId(exchange.id);
            await exchangeService.acceptExchange(exchange.id);
            Alert.alert('Success', 'Exchange accepted! Awaiting approval.', [
              { text: 'OK', onPress: () => fetchExchangeData() },
            ]);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept.');
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  };

  const handleCancelExchange = (exchange: ShiftExchange) => {
    Alert.alert('Cancel Exchange', 'Cancel this exchange request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            setActioningId(exchange.id);
            await exchangeService.cancelExchange(exchange.id);
            Alert.alert('Cancelled', 'Exchange cancelled.', [
              { text: 'OK', onPress: () => fetchExchangeData() },
            ]);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to cancel.');
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  };

  const handleCancelOpenRequest = (request: OpenShiftRequest) => {
    Alert.alert('Cancel Release', 'Cancel this shift release?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            setActioningId(request.id);
            await exchangeService.cancelOpenShiftRequest(request.id);
            Alert.alert('Cancelled', 'Release cancelled.', [
              { text: 'OK', onPress: () => fetchExchangeData() },
            ]);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to cancel.');
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  };

  const currentData = activeTab === 'exchanges' ? directExchanges : openRequests;

  const renderEmpty = () => (
    <UberEmptyState
      title={activeTab === 'exchanges' ? 'No exchanges' : 'No releases'}
      subtitle={
        activeTab === 'exchanges'
          ? 'Your direct shift exchanges will appear here'
          : 'Shifts you release to the pool will appear here'
      }
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={uberColors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Exchanges</Text>
        <TouchableOpacity onPress={() => fetchExchangeData()} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color={uberColors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'exchanges' && styles.tabActive]}
            onPress={() => setActiveTab('exchanges')}
          >
            <Text style={[styles.tabText, activeTab === 'exchanges' && styles.tabTextActive]}>
              Exchanges
            </Text>
            {directExchanges.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'exchanges' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'exchanges' && styles.tabBadgeTextActive]}>
                  {directExchanges.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'releases' && styles.tabActive]}
            onPress={() => setActiveTab('releases')}
          >
            <Text style={[styles.tabText, activeTab === 'releases' && styles.tabTextActive]}>
              Releases
            </Text>
            {openRequests.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'releases' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'releases' && styles.tabBadgeTextActive]}>
                  {openRequests.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={uberColors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentData as any[]}
          renderItem={({ item, index }) =>
            activeTab === 'exchanges' ? (
              <ExchangeCard
                exchange={item as ShiftExchange}
                index={index}
                currentUserId={currentUserId}
                onAccept={() => handleAcceptExchange(item as ShiftExchange)}
                onCancel={() => handleCancelExchange(item as ShiftExchange)}
                isActioning={actioningId === item.id}
              />
            ) : (
              <ReleaseCard
                request={item as OpenShiftRequest}
                index={index}
                onCancel={() => handleCancelOpenRequest(item as OpenShiftRequest)}
                isActioning={actioningId === item.id}
              />
            )
          }
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchExchangeData(true);
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
  tabsContainer: {
    backgroundColor: uberColors.background.surface,
    paddingHorizontal: uberSpacing.base,
    paddingBottom: uberSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: uberColors.border.light,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: uberColors.background.light,
    borderRadius: uberRadius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: uberSpacing.sm,
    borderRadius: uberRadius.md,
    gap: uberSpacing.xs,
  },
  tabActive: {
    backgroundColor: uberColors.background.surface,
    ...uberShadows.soft,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: uberColors.text.muted,
  },
  tabTextActive: {
    color: uberColors.text.primary,
  },
  tabBadge: {
    backgroundColor: uberColors.text.muted,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: uberColors.primary,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: uberColors.text.inverse,
  },
  tabBadgeTextActive: {
    color: uberColors.text.inverse,
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
  card: {
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius.xl,
    padding: uberSpacing.base,
    marginBottom: uberSpacing.md,
    borderWidth: 1,
    borderColor: uberColors.border.light,
    ...uberShadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: uberSpacing.sm,
    gap: uberSpacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${uberColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: uberColors.text.primary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: uberColors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: uberSpacing.sm,
    paddingVertical: 4,
    borderRadius: uberRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shiftInfo: {
    marginBottom: uberSpacing.sm,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: uberColors.text.primary,
    marginBottom: 2,
  },
  shiftTime: {
    fontSize: 13,
    color: uberColors.text.secondary,
  },
  reasonBox: {
    backgroundColor: uberColors.background.light,
    padding: uberSpacing.sm,
    borderRadius: uberRadius.md,
    marginBottom: uberSpacing.sm,
  },
  reasonText: {
    fontSize: 13,
    color: uberColors.text.secondary,
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.xs,
    backgroundColor: `${uberColors.info}10`,
    padding: uberSpacing.sm,
    borderRadius: uberRadius.md,
    marginTop: uberSpacing.xs,
  },
  infoText: {
    fontSize: 13,
    color: uberColors.text.secondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: uberSpacing.sm,
    marginTop: uberSpacing.sm,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: uberColors.primary,
    paddingVertical: uberSpacing.sm,
    borderRadius: uberRadius.full,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: uberColors.text.inverse,
  },
  declineButton: {
    flex: 1,
    backgroundColor: uberColors.background.light,
    paddingVertical: uberSpacing.sm,
    borderRadius: uberRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: uberColors.border.medium,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: uberColors.text.primary,
  },
  cancelButton: {
    backgroundColor: uberColors.background.light,
    paddingVertical: uberSpacing.sm,
    borderRadius: uberRadius.full,
    alignItems: 'center',
    marginTop: uberSpacing.sm,
    borderWidth: 1,
    borderColor: uberColors.border.light,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: uberColors.text.secondary,
  },
});
