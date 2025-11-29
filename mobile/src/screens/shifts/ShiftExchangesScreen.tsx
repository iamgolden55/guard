/**
 * ShiftExchangesScreen - View shift exchange history and pending requests
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
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import exchangeService, { ShiftExchange, OpenShiftRequest } from '../../services/exchangeService';
import { useAuth } from '../../hooks/useAuth';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

type TabType = 'exchanges' | 'releases';

export const ShiftExchangesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [activeTab, setActiveTab] = useState<TabType>('exchanges');
  const [directExchanges, setDirectExchanges] = useState<ShiftExchange[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);

  // Fetch all exchange data
  const fetchExchangeData = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const data = await exchangeService.getAllExchangeActivities();
      setDirectExchanges(data.direct_exchanges);
      setOpenRequests(data.open_requests);
    } catch (error) {
      console.error('Error fetching exchange data:', error);
      Alert.alert('Error', 'Failed to load exchanges. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchExchangeData();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchExchangeData();
    }, [])
  );

  // Handle pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchExchangeData(true);
  };

  // Handle accepting an exchange
  const handleAcceptExchange = (exchange: ShiftExchange) => {
    Alert.alert(
      'Accept Exchange',
      `Accept shift exchange with ${exchange.requesting_user_details.first_name} ${exchange.requesting_user_details.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              setActioningId(exchange.id);
              await exchangeService.acceptExchange(exchange.id);
              Alert.alert(
                'Success',
                'Exchange accepted! Waiting for manager approval.',
                [{ text: 'OK', onPress: () => fetchExchangeData() }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to accept exchange');
            } finally {
              setActioningId(null);
            }
          },
        },
      ]
    );
  };

  // Handle canceling an exchange
  const handleCancelExchange = (exchange: ShiftExchange) => {
    Alert.alert(
      'Cancel Exchange',
      'Are you sure you want to cancel this exchange request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setActioningId(exchange.id);
              await exchangeService.cancelExchange(exchange.id);
              Alert.alert('Cancelled', 'Exchange request cancelled.', [
                { text: 'OK', onPress: () => fetchExchangeData() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel exchange');
            } finally {
              setActioningId(null);
            }
          },
        },
      ]
    );
  };

  // Handle canceling an open shift request
  const handleCancelOpenRequest = (request: OpenShiftRequest) => {
    Alert.alert(
      'Cancel Release',
      'Are you sure you want to cancel this shift release?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setActioningId(request.id);
              await exchangeService.cancelOpenShiftRequest(request.id);
              Alert.alert('Cancelled', 'Shift release cancelled.', [
                { text: 'OK', onPress: () => fetchExchangeData() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel release');
            } finally {
              setActioningId(null);
            }
          },
        },
      ]
    );
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return colors.warning;
      case 'accepted_by_target':
      case 'claimed':
        return colors.info;
      case 'approved':
        return colors.success;
      case 'rejected':
      case 'cancelled':
      case 'expired':
        return colors.error;
      default:
        return colors.text.secondary;
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Render direct exchange card
  const renderExchangeCard = (exchange: ShiftExchange) => {
    const startTime = new Date(exchange.original_shift_details.start_time);
    const isActioning = actioningId === exchange.id;
    const isPending = exchange.status === 'pending';
    const isWaitingForApproval = exchange.status === 'accepted_by_target';

    // Determine if current user is the requesting user or target user
    // Use loose equality (==) to handle number vs string comparison
    const isRequestingUser = currentUserId == exchange.requesting_user;
    const isTargetUser = currentUserId == exchange.target_user;

    return (
      <View key={exchange.id} style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.exchangeIcon}>
            <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Direct Exchange</Text>
            <Text style={styles.cardSubtitle}>
              {isRequestingUser
                ? `With ${exchange.target_user_details.first_name} ${exchange.target_user_details.last_name}`
                : `From ${exchange.requesting_user_details.first_name} ${exchange.requesting_user_details.last_name}`
              }
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(exchange.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(exchange.status) }]}>
              {getStatusLabel(exchange.status)}
            </Text>
          </View>
        </View>

        {/* Shift Info */}
        <View style={styles.shiftInfo}>
          <Text style={styles.venueName}>{exchange.original_shift_details.venue.name}</Text>
          <Text style={styles.shiftTime}>
            {startTime.toLocaleDateString()} • {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Reason */}
        {exchange.request_reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{exchange.request_reason}</Text>
          </View>
        )}

        {/* Actions - Different for target vs requesting user */}
        {isPending && isTargetUser && (
          <View style={styles.actions}>
            <Button
              title="Accept"
              variant="primary"
              size="small"
              onPress={() => handleAcceptExchange(exchange)}
              style={styles.actionButton}
              disabled={isActioning}
            />
            <Button
              title="Decline"
              variant="secondary"
              size="small"
              onPress={() => handleCancelExchange(exchange)}
              style={styles.actionButton}
              disabled={isActioning}
            />
          </View>
        )}

        {isPending && isRequestingUser && (
          <Button
            title={isActioning ? 'Cancelling...' : 'Cancel Request'}
            variant="secondary"
            size="small"
            onPress={() => handleCancelExchange(exchange)}
            disabled={isActioning}
            style={{ marginTop: spacing.sm }}
          />
        )}

        {isWaitingForApproval && (
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={16} color={colors.info} />
            <Text style={styles.infoText}>Waiting for manager approval</Text>
          </View>
        )}

        {(exchange.status === 'cancelled' || exchange.status === 'rejected') && (
          <TouchableOpacity onPress={() => handleCancelExchange(exchange)} style={styles.removeButton}>
            <Ionicons name="close-circle-outline" size={18} color={colors.error} />
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render open shift request card
  const renderOpenRequestCard = (request: OpenShiftRequest) => {
    const startTime = new Date(request.original_shift_details.start_time);
    const isActioning = actioningId === request.id;
    const isOpen = request.status === 'open';
    const isClaimed = request.status === 'claimed';

    return (
      <View key={request.id} style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.exchangeIcon, { backgroundColor: colors.success + '15' }]}>
            <MaterialCommunityIcons name="hand-extended-outline" size={20} color={colors.success} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Released to Pool</Text>
            {request.claimed_by_details && (
              <Text style={styles.cardSubtitle}>
                Claimed by {request.claimed_by_details.first_name} {request.claimed_by_details.last_name}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
              {getStatusLabel(request.status)}
            </Text>
          </View>
        </View>

        {/* Shift Info */}
        <View style={styles.shiftInfo}>
          <Text style={styles.venueName}>{request.original_shift_details.venue.name}</Text>
          <Text style={styles.shiftTime}>
            {startTime.toLocaleDateString()} • {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Reason */}
        {request.request_reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{request.request_reason}</Text>
          </View>
        )}

        {/* Status Info */}
        {isOpen && (
          <View style={styles.infoBox}>
            <Ionicons name="people-outline" size={16} color={colors.success} />
            <Text style={styles.infoText}>Available for others to claim</Text>
          </View>
        )}

        {isClaimed && (
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={16} color={colors.info} />
            <Text style={styles.infoText}>Claimed - waiting for manager approval</Text>
          </View>
        )}

        {/* Actions */}
        {(isOpen || isClaimed) && (
          <Button
            title={isActioning ? 'Cancelling...' : 'Cancel Release'}
            variant="secondary"
            size="small"
            onPress={() => handleCancelOpenRequest(request)}
            disabled={isActioning}
            style={{ marginTop: spacing.sm }}
          />
        )}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = (type: TabType) => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name={type === 'exchanges' ? 'swap-horizontal' : 'hand-extended-outline'}
        size={64}
        color={colors.text.secondary}
      />
      <Text style={styles.emptyTitle}>
        No {type === 'exchanges' ? 'Exchanges' : 'Releases'}
      </Text>
      <Text style={styles.emptyText}>
        {type === 'exchanges'
          ? 'You have no direct shift exchanges'
          : 'You have not released any shifts'}
      </Text>
    </View>
  );

  const currentData = activeTab === 'exchanges' ? directExchanges : openRequests;

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shift Exchanges</Text>
        <TouchableOpacity onPress={() => fetchExchangeData()} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'exchanges' && styles.tabActive]}
          onPress={() => setActiveTab('exchanges')}
        >
          <Text style={[styles.tabText, activeTab === 'exchanges' && styles.tabTextActive]}>
            Direct Exchanges
          </Text>
          {directExchanges.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{directExchanges.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'releases' && styles.tabActive]}
          onPress={() => setActiveTab('releases')}
        >
          <Text style={[styles.tabText, activeTab === 'releases' && styles.tabTextActive]}>
            Released Shifts
          </Text>
          {openRequests.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{openRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading exchanges...</Text>
        </View>
      ) : currentData.length === 0 ? (
        renderEmptyState(activeTab)
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {activeTab === 'exchanges'
            ? directExchanges.map(renderExchangeCard)
            : openRequests.map(renderOpenRequestCard)}
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    backgroundColor: colors.background,
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
  refreshButton: {
    padding: spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  exchangeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shiftInfo: {
    marginBottom: spacing.sm,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  shiftTime: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  reasonBox: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.info + '10',
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
});
