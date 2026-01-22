/**
 * MapHeader
 * Uber-style header with illustration background and greeting card overlay
 * Features: Illustration background, gradient overlay, floating greeting card, offline indicator
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { uberColors, uberShadows, uberRadius, uberTypography, spacing } from '../../../theme';

interface MapHeaderProps {
  userName: string;
  avatarUrl?: string;
  date: Date;
  isOffline?: boolean;
}

// Format date for display
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-GB', options);
};

// Get greeting based on time of day
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export const MapHeader: React.FC<MapHeaderProps> = ({
  userName,
  avatarUrl,
  date,
  isOffline = false,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Illustration Background */}
      <View style={styles.illustrationBackground}>
        <Image
          source={require('../../../../assets/images/dashboard-illustration.png')}
          style={[
            styles.illustrationImage,
            isOffline && styles.illustrationImageOffline,
          ]}
          resizeMode="contain"
        />

        {/* Grayscale overlay when offline */}
        {isOffline && (
          <View style={styles.offlineOverlay} />
        )}

        {/* Gradient overlay for smooth transition to content */}
        <LinearGradient
          colors={
            isOffline
              ? ['rgba(251, 191, 36, 0.1)', 'rgba(248, 248, 248, 0.3)', 'rgba(248, 248, 248, 0.98)']
              : ['transparent', 'rgba(248, 248, 248, 0.2)', 'rgba(248, 248, 248, 0.98)']
          }
          locations={[0, 0.6, 1]}
          style={styles.gradient}
        />
      </View>

      {/* Floating Greeting Card */}
      <View style={[
        styles.greetingCard,
        isOffline && styles.greetingCardOffline,
      ]}>
        <View style={styles.greetingContent}>
          <Text style={styles.greetingText}>
            {getGreeting()}, {userName}
          </Text>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[
                styles.avatar,
                isOffline && styles.avatarOffline,
              ]}
            />
          ) : (
            <View style={[
              styles.avatarPlaceholder,
              isOffline && styles.avatarPlaceholderOffline,
            ]}>
              <Ionicons name="person" size={24} color={isOffline ? '#92400E' : uberColors.text.muted} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 340,
    backgroundColor: uberColors.background.light,
    position: 'relative',
  },
  illustrationBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: uberColors.background.light,
    overflow: 'hidden',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  illustrationImageOffline: {
    opacity: 0.6,
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(120, 120, 120, 0.15)',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // Greeting card
  greetingCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius['2xl'],
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...uberShadows.float,
  },
  greetingCardOffline: {
    borderWidth: 1,
    borderColor: '#FCD34D', // amber-300
  },
  greetingContent: {
    flex: 1,
  },
  greetingText: {
    ...uberTypography.greeting,
    marginBottom: 4,
  },
  dateText: {
    ...uberTypography.date,
  },
  avatarContainer: {
    marginLeft: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: uberColors.border.light,
  },
  avatarOffline: {
    borderColor: '#FCD34D', // amber-300
    opacity: 0.8,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: uberColors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderOffline: {
    backgroundColor: '#FEF3C7', // amber-100
    borderWidth: 2,
    borderColor: '#FCD34D', // amber-300
  },
});

export default MapHeader;
