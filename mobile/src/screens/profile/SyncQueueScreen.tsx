/**
 * Sync Queue Screen
 * View and manage offline sync queue
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import offlineExchangeService from '../../services/offlineExchangeService';
import type { QueuedAction, QueueMetadata } from '../../services/queueService';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const SyncQueueScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [queueItems, setQueueItems] = useState<QueuedAction[]>([]);
  const [metadata, setMetadata] = useState<QueueMetadata | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingActionId, setSyncingActionId] = useState<string | null>(null);

  // Fetch queue data
  const fetchQueueData = useCallback(() => {
    const status = offlineExchangeService.getQueueStatus();
    setQueueItems(status.queue);
    setMetadata(status.metadata);
  }, []);

  // Initial load
  useEffect(() => {
    fetchQueueData();

    // Subscribe to queue changes
    const unsubscribe = offlineExchangeService.subscribeToQueue((queue, meta) => {
      setQueueItems([...queue]);
      setMetadata({ ...meta });
    });

    return unsubscribe;
  }, [fetchQueueData]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchQueueData();
    }, [fetchQueueData])
  );

  // Handle pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchQueueData();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Handle sync all
  const handleSyncAll = async () => {
    try {
      const result = await offlineExchangeService.syncQueuedActions();
      Alert.alert(
        'Sync Complete',
        `Successfully synced ${result.success} ${result.success === 1 ? 'item' : 'items'}${
          result.failed > 0 ? `, ${result.failed} failed` : ''
        }`
      );
      fetchQueueData();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Unable to sync at this time');
    }
  };

  // Handle retry single action
  const handleRetry = async (actionId: string) => {
    try {
      setSyncingActionId(actionId);
      await offlineExchangeService.retryFailedAction(actionId);
      fetchQueueData();
    } catch (error: any) {
      Alert.alert('Retry Failed', error.message || 'Unable to retry at this time');
    } finally {
      setSyncingActionId(null);
    }
  };

  // Handle clear completed
  const handleClearCompleted = async () => {
    Alert.alert(
      'Clear Completed Actions',
      'This will remove all synced and old failed actions from the queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await offlineExchangeService.clearCompletedActions();
            fetchQueueData();
          },
        },
      ]
    );
  };

  // Get status badge style
  const getStatusBadge = (status: QueuedAction['status']) => {
    switch (status) {
      case 'pending':
        return { color: colors.info, bg: colors.info + '20', text: 'PENDING' };
      case 'syncing':
        return { color: colors.primary, bg: colors.primary + '20', text: 'SYNCING' };
      case 'failed':
        return { color: colors.error, bg: colors.error + '20', text: 'FAILED' };
      case 'synced':
        return { color: colors.success, bg: colors.success + '20', text: 'SYNCED' };
      default:
        return { color: colors.text.secondary, bg: colors.background, text: 'UNKNOWN' };
    }
  };

  // Get action type label
  const getActionTypeLabel = (type: QueuedAction['type']) => {
    switch (type) {
      case 'CREATE_EXCHANGE':
        return 'Transfer Shift';
      case 'ACCEPT_EXCHANGE':
        return 'Accept Transfer';
      case 'CANCEL_EXCHANGE':
        return 'Cancel Transfer';
      case 'RELEASE_SHIFT':
        return 'Release Shift';
      case 'CLAIM_SHIFT':
        return 'Claim Shift';
      case 'CANCEL_OPEN_REQUEST':
        return 'Cancel Release';
      default:
        return type;
    }
  };

  // Get action icon
  const getActionIcon = (type: QueuedAction['type']) => {
    switch (type) {
      case 'CREATE_EXCHANGE':
        return 'swap-horizontal-outline';
      case 'ACCEPT_EXCHANGE':
        return 'checkmark-circle-outline';
      case 'CANCEL_EXCHANGE':
        return 'close-circle-outline';
      case 'RELEASE_SHIFT':
        return 'hand-left-outline';
      case 'CLAIM_SHIFT':
        return 'hand-right-outline';
      case 'CANCEL_OPEN_REQUEST':
        return 'trash-outline';
      default:
        return 'help-outline';
    }
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="cloud-check-outline"
        size={64}
        color={colors.text.secondary}
      />
      <Text style={styles.emptyTitle}>All Synced!</Text>
      <Text style={styles.emptyText}>
        You have no pending actions in the sync queue. Any changes made while offline will appear
        here.
      </Text>
    </View>
  );

  // Render queue item
  const renderQueueItem = (item: QueuedAction) => {
    const statusBadge = getStatusBadge(item.status);
    const isRetrying = syncingActionId === item.id;

    return (
      <View key={item.id} style={styles.queueItem}>
        {/* Header */}
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Ionicons
              name={getActionIcon(item.type) as any}
              size={20}
              color={colors.text.primary}
            />
            <Text style={styles.itemTitle}>{getActionTypeLabel(item.type)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.text}
            </Text>
          </View>
        </View>

        {/* Metadata */}
        {item.metadata && (
          <View style={styles.itemMetadata}>
            {item.metadata.venueName && (
              <Text style={styles.metadataText}>📍 {item.metadata.venueName}</Text>
            )}
            {item.metadata.targetUser && (
              <Text style={styles.metadataText}>👤 {item.metadata.targetUser}</Text>
            )}
            {item.metadata.shiftId && (
              <Text style={styles.metadataText}>🆔 Shift #{item.metadata.shiftId}</Text>
            )}
          </View>
        )}

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {/* Error message */}
        {item.error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{item.error}</Text>
          </View>
        )}

        {/* Retry info */}
        {item.retryCount > 0 && (
          <Text style={styles.retryInfo}>
            Retry {item.retryCount} of {item.maxRetries}
          </Text>
        )}

        {/* Retry button for failed items */}
        {item.status === 'failed' && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => handleRetry(item.id)}
            disabled={isRetrying}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.retryButtonText}>{isRetrying ? 'Retrying...' : 'Retry'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sync Queue</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Stats */}
      {metadata && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{queueItems.length}</Text>
            <Text style={styles.statLabel}>In Queue</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {metadata.totalSynced}
            </Text>
            <Text style={styles.statLabel}>Synced</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.error }]}>{metadata.totalFailed}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      {queueItems.length > 0 && (
        <View style={styles.actionsRow}>
          <Button
            title="Sync All"
            variant="primary"
            onPress={handleSyncAll}
            style={styles.actionButton}
            icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.white} />}
          />
          <Button
            title="Clear Completed"
            variant="secondary"
            onPress={handleClearCompleted}
            style={styles.actionButton}
            icon={<Ionicons name="trash-outline" size={18} color={colors.primary} />}
          />
        </View>
      )}

      {/* Queue List */}
      {queueItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {queueItems.map(renderQueueItem)}
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
  headerRight: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
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
  },
  queueItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
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
  itemMetadata: {
    gap: 4,
    marginBottom: spacing.xs,
  },
  metadataText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.error + '10',
    padding: spacing.sm,
    borderRadius: 6,
    marginTop: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.error,
    lineHeight: 16,
  },
  retryInfo: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
