/**
 * PresenceBadge Component
 * Microsoft Teams-style presence indicator
 * Small colored dot showing availability status
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { teamsColors } from '../../../theme/teamsColors';

export type PresenceStatus = 'available' | 'away' | 'busy' | 'in_call' | 'offline' | 'presenting';

interface PresenceBadgeProps {
  status: PresenceStatus;
  size?: 'small' | 'medium' | 'large';
  showRing?: boolean; // For "in call" status
}

export const PresenceBadge: React.FC<PresenceBadgeProps> = ({
  status,
  size = 'medium',
  showRing = false,
}) => {
  const presenceConfig = {
    available: {
      color: teamsColors.presence.available,
      icon: null,
    },
    away: {
      color: teamsColors.presence.away,
      icon: null,
    },
    busy: {
      color: teamsColors.presence.busy,
      icon: null,
    },
    in_call: {
      color: teamsColors.presence.inCall,
      icon: null,
      showRing: true,
    },
    offline: {
      color: teamsColors.presence.offline,
      icon: null,
    },
    presenting: {
      color: teamsColors.presence.presenting,
      icon: null,
    },
  };

  const config = presenceConfig[status];
  const sizeConfig = {
    small: { dot: 8, ring: 12, border: 2 },
    medium: { dot: 10, ring: 16, border: 2 },
    large: { dot: 12, ring: 18, border: 3 },
  };

  const dimensions = sizeConfig[size];
  const shouldShowRing = config.showRing || showRing;

  return (
    <View style={styles.container}>
      {/* Presence Dot */}
      <View
        style={[
          styles.dot,
          {
            width: dimensions.dot,
            height: dimensions.dot,
            borderRadius: dimensions.dot / 2,
            backgroundColor: config.color,
          },
        ]}
      />

      {/* Ring for "in call" status */}
      {shouldShowRing && (
        <View
          style={[
            styles.ring,
            {
              width: dimensions.ring,
              height: dimensions.ring,
              borderRadius: dimensions.ring / 2,
              borderWidth: dimensions.border,
              borderColor: config.color,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    borderWidth: 2,
    borderColor: teamsColors.white,
  },
  ring: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});
