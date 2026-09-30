/**
 * NetworkStatusBanner Component
 * Shows connection status and sync progress at top of screen
 */

import React from 'react';
import { Alert, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncService } from '../../services/syncService';
import type { SyncQueueItem } from '../../services/database';

const ACTION_LABEL: Record<SyncQueueItem['type'], string> = {
  check_in: 'Check-in',
  check_out: 'Check-out',
  create_incident: 'Incident report',
  update_incident: 'Incident update',
  create_shift_check: 'Venue check',
  create_logbook_signoff: 'Logbook sign-off',
  update_shift: 'Shift update',
};

/** The server's reason, without the "HTTP 400:" prefix ApiError adds. */
const reasonOf = (item: SyncQueueItem) =>
  (item.error || 'No reason given').replace(/^HTTP \d+:\s*/, '');

/**
 * Items the queue gave up on used to be counted as "waiting to sync" for
 * good, with nothing the officer could do. Show what they are and why, and
 * let them try again or discard them. Discarding is their explicit choice:
 * a failed check-in is the only evidence they tried.
 */
const reviewFailed = async () => {
  const failed = await syncService.getFailedItems();
  if (failed.length === 0) return;
  const lines = failed.map((item) => `• ${ACTION_LABEL[item.type] ?? item.type}: ${reasonOf(item)}`);
  Alert.alert(
    failed.length === 1 ? '1 item was not sent' : `${failed.length} items were not sent`,
    `${lines.join('\n')}\n\nTry again, or discard to remove ${failed.length === 1 ? 'it' : 'them'} from this phone.`,
    [
      { text: 'Close', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => void syncService.clearFailedItems(),
      },
      { text: 'Try again', onPress: () => void syncService.retryFailedItems() },
    ],
  );
};

export const NetworkStatusBanner = () => {
  const { isOnline, isSyncing, queueCount, failedCount } = useNetworkStatus();
  // The banner's colour runs up behind the status bar, but its text and tap
  // target start below it: iOS doesn't deliver taps in the status bar, so a
  // "tap to review" drawn there couldn't be tapped.
  const insets = useSafeAreaInsets();
  const hiddenOffset = -(insets.top + 60);
  const [visible, setVisible] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(hiddenOffset)).current;

  React.useEffect(() => {
    const shouldShow = !isOnline || isSyncing || queueCount > 0 || failedCount > 0;

    if (shouldShow && !visible) {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else if (!shouldShow && visible) {
      Animated.timing(slideAnim, {
        toValue: hiddenOffset,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [isOnline, isSyncing, queueCount, failedCount, visible, hiddenOffset]);

  if (!visible) {
    return null;
  }

  const getBannerConfig = () => {
    if (!isOnline) {
      return {
        backgroundColor: '#DC2626', // Red
        icon: '📡',
        text: 'Offline - Changes will sync when connected',
        textColor: '#FFFFFF',
      };
    }

    if (isSyncing) {
      return {
        backgroundColor: '#2563EB', // Blue
        icon: '🔄',
        text: `Syncing ${queueCount} ${queueCount === 1 ? 'item' : 'items'}...`,
        textColor: '#FFFFFF',
      };
    }

    if (queueCount > 0) {
      return {
        backgroundColor: '#F59E0B', // Amber
        icon: '⏸',
        text: `${queueCount} ${queueCount === 1 ? 'item' : 'items'} waiting to sync`,
        textColor: '#FFFFFF',
      };
    }

    if (failedCount > 0) {
      return {
        backgroundColor: '#DC2626', // Red
        icon: '⚠️',
        text: `${failedCount} ${failedCount === 1 ? 'item' : 'items'} not sent · tap to review`,
        textColor: '#FFFFFF',
        onPress: reviewFailed,
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
          paddingTop: insets.top + 12,
          backgroundColor: config.backgroundColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable
        style={styles.row}
        onPress={config.onPress}
        disabled={!config.onPress}
        accessibilityRole={config.onPress ? 'button' : undefined}
      >
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={[styles.text, { color: config.textColor }]}>{config.text}</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
