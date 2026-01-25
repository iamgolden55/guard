/**
 * Sync Status Banner
 * Displays offline queue sync status with Uber-style amber design
 * Handles: offline mode, syncing, pending changes, failed syncs
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import offlineExchangeService from '../../services/offlineExchangeService';
import { spacing } from '../../theme';

// Amber color palette for offline/sync states
const amberColors = {
  bg: '#FEF3C7',        // amber-100
  bgDark: '#FDE68A',    // amber-200
  border: '#FCD34D',    // amber-300
  text: '#92400E',      // amber-800
  textLight: '#B45309', // amber-700
  accent: '#F59E0B',    // amber-500
};

// Info color palette for syncing states
const infoColors = {
  bg: '#DBEAFE',        // blue-100
  border: '#93C5FD',    // blue-300
  text: '#1E40AF',      // blue-800
  accent: '#3B82F6',    // blue-500
};

// Error color palette for failed states
const errorColors = {
  bg: '#FEE2E2',        // red-100
  border: '#FCA5A5',    // red-300
  text: '#991B1B',      // red-800
  accent: '#EF4444',    // red-500
};

export const SyncStatusBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
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

    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -100,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
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

  // Determine banner style based on state
  const getBannerConfig = () => {
    if (!isOnline) {
      return {
        colors: amberColors,
        message: "You're offline",
        subtitle: 'Changes will sync when connected',
        icon: 'cloud-offline-outline' as const,
        showSync: false,
      };
    }

    if (isSyncing) {
      return {
        colors: infoColors,
        message: 'Syncing changes...',
        subtitle: null,
        icon: 'sync-outline' as const,
        showSync: false,
      };
    }

    if (failedCount > 0) {
      return {
        colors: errorColors,
        message: `${failedCount} ${failedCount === 1 ? 'change' : 'changes'} failed`,
        subtitle: 'Tap to retry',
        icon: 'alert-circle-outline' as const,
        showSync: true,
      };
    }

    if (pendingCount > 0) {
      return {
        colors: infoColors,
        message: `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} pending`,
        subtitle: 'Will sync automatically',
        icon: 'cloud-upload-outline' as const,
        showSync: true,
      };
    }

    return null;
  };

  const config = getBannerConfig();

  if (!config) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: config.colors.bg,
          borderBottomColor: config.colors.border,
          paddingTop: insets.top + 4,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        {/* Icon container */}
        <View style={[styles.iconContainer, { backgroundColor: config.colors.bgDark || config.colors.bg }]}>
          <Ionicons name={config.icon} size={16} color={config.colors.text} />
        </View>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: config.colors.text }]}>
            {config.message}
          </Text>
          {config.subtitle && (
            <Text style={[styles.subtitle, { color: config.colors.textLight || config.colors.text }]}>
              {config.subtitle}
            </Text>
          )}
        </View>

        {/* Sync button */}
        {config.showSync && isOnline && !isSyncing && (
          <TouchableOpacity
            onPress={handleSync}
            style={[styles.syncButton, { backgroundColor: config.colors.accent }]}
          >
            <Ionicons name="sync" size={14} color="#FFFFFF" />
            <Text style={styles.syncText}>Sync</Text>
          </TouchableOpacity>
        )}

        {/* Syncing spinner */}
        {isSyncing && (
          <View style={styles.syncingIndicator}>
            <Ionicons name="sync" size={18} color={config.colors.accent} />
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
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
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  syncingIndicator: {
    padding: 4,
  },
});
