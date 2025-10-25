/**
 * NetworkStatusBanner Component
 * Shows connection status and sync progress at top of screen
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const NetworkStatusBanner = () => {
  const { isOnline, isSyncing, queueCount } = useNetworkStatus();
  const [visible, setVisible] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(-60)).current;

  React.useEffect(() => {
    const shouldShow = !isOnline || isSyncing || queueCount > 0;

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
        toValue: -60,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [isOnline, isSyncing, queueCount, visible]);

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
          backgroundColor: config.backgroundColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={[styles.text, { color: config.textColor }]}>{config.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
