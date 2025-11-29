/**
 * Sync Status Banner
 * Displays offline queue sync status and allows manual sync
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import offlineExchangeService from '../../services/offlineExchangeService';
import { colors, spacing } from '../../theme';

export const SyncStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Subscribe to network status
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      // Auto-sync when coming back online
      if (online && pendingCount > 0 && !isSyncing) {
        handleSync();
      }
    });

    // Subscribe to queue changes
    const unsubscribeQueue = offlineExchangeService.subscribeToQueue((queue, metadata) => {
      const pending = queue.filter((a) => a.status === 'pending').length;
      const failed = queue.filter((a) => a.status === 'failed').length;
      setPendingCount(pending);
      setFailedCount(failed);
      setIsSyncing(offlineExchangeService.getQueueStatus().isSyncing);
    });

    // Initial status check
    const status = offlineExchangeService.getQueueStatus();
    setPendingCount(status.pending);
    setFailedCount(status.failed);
    setIsSyncing(status.isSyncing);

    return () => {
      unsubscribeNetInfo();
      unsubscribeQueue();
    };
  }, []);

  // Show/hide banner based on status
  useEffect(() => {
    const shouldShow = !isOnline || pendingCount > 0 || failedCount > 0 || isSyncing;

    Animated.timing(slideAnim, {
      toValue: shouldShow ? 0 : -100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, pendingCount, failedCount, isSyncing]);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await offlineExchangeService.syncQueuedActions();
      console.log(`Sync completed: ${result.success} success, ${result.failed} failed`);

      // Clear completed actions after successful sync
      if (result.success > 0) {
        await offlineExchangeService.clearCompletedActions();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine banner color and message
  const getBannerStyle = () => {
    if (!isOnline) {
      return {
        backgroundColor: colors.warning + '20',
        borderColor: colors.warning,
        iconColor: colors.warning,
        message: 'Offline - Changes will sync when online',
        icon: 'cloud-offline-outline' as const,
      };
    }

    if (isSyncing) {
      return {
        backgroundColor: colors.info + '20',
        borderColor: colors.info,
        iconColor: colors.info,
        message: 'Syncing changes...',
        icon: 'sync-outline' as const,
      };
    }

    if (failedCount > 0) {
      return {
        backgroundColor: colors.error + '20',
        borderColor: colors.error,
        iconColor: colors.error,
        message: `${failedCount} ${failedCount === 1 ? 'change' : 'changes'} failed to sync`,
        icon: 'alert-circle-outline' as const,
      };
    }

    if (pendingCount > 0) {
      return {
        backgroundColor: colors.info + '20',
        borderColor: colors.info,
        iconColor: colors.info,
        message: `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} pending sync`,
        icon: 'cloud-upload-outline' as const,
      };
    }

    return null;
  };

  const bannerStyle = getBannerStyle();

  if (!bannerStyle) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: bannerStyle.backgroundColor,
          borderBottomColor: bannerStyle.borderColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={bannerStyle.icon} size={20} color={bannerStyle.iconColor} />
        <Text style={[styles.message, { color: bannerStyle.iconColor }]}>
          {bannerStyle.message}
        </Text>

        {/* Sync button (only show when online and not syncing) */}
        {isOnline && (pendingCount > 0 || failedCount > 0) && !isSyncing && (
          <TouchableOpacity onPress={handleSync} style={styles.syncButton}>
            <Ionicons name="sync" size={18} color={bannerStyle.iconColor} />
            <Text style={[styles.syncText, { color: bannerStyle.iconColor }]}>Sync</Text>
          </TouchableOpacity>
        )}

        {/* Syncing indicator */}
        {isSyncing && (
          <View style={styles.syncingIndicator}>
            <Ionicons name="sync" size={18} color={bannerStyle.iconColor} />
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncingIndicator: {
    padding: 4,
  },
});
