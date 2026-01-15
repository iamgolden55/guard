/**
 * WelcomeSlide Component
 * First onboarding slide - App introduction with animated elements
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { SlideProps } from '../../../components/onboarding';

interface Props extends SlideProps {}

// Animated Feature Item
const FeatureItem: React.FC<{
  icon: string;
  label: string;
  delay: number;
}> = ({ icon, label, delay }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [opacity, translateY, scale, delay]);

  return (
    <Animated.View
      style={[
        styles.featureItem,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View style={styles.featureIconBg}>
        <Ionicons name={icon as any} size={20} color="#0061FF" />
      </View>
      <Text style={styles.featureText}>{label}</Text>
    </Animated.View>
  );
};

// Pulsing Ring Component
const PulsingRing: React.FC<{
  size: number;
  delay: number;
}> = ({ size, delay }) => {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      // Initial fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Continuous pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.05,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.95,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [scale, opacity, delay]);

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
};

export const WelcomeSlide: React.FC<Props> = ({ isActive }) => {
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Icon entrance with bounce and slight rotation
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          tension: 60,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(iconRotate, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Content entrance
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslate, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, 300);

    return () => clearTimeout(timer);
  }, [contentOpacity, contentTranslate, iconScale, iconRotate]);

  const rotateInterpolate = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-20deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Icon with rings */}
      <View style={styles.iconContainer}>
        <PulsingRing size={280} delay={400} />
        <PulsingRing size={240} delay={300} />
        <PulsingRing size={200} delay={200} />

        <Animated.View
          style={[
            styles.iconWrapper,
            {
              transform: [
                { scale: iconScale },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#0061FF', '#0047CC']}
            style={styles.iconGradient}
          >
            <Ionicons name="shield-checkmark" size={80} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Text Content */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslate }],
          },
        ]}
      >
        <Text style={styles.title}>Welcome to{'\n'}Mead Security</Text>

        <Text style={styles.description}>
          Your all-in-one platform for managing shifts, tracking attendance, and staying connected with your team.
        </Text>

        <View style={styles.featuresRow}>
          <FeatureItem icon="time-outline" label="Shifts" delay={600} />
          <FeatureItem icon="location-outline" label="GPS Check-in" delay={750} />
          <FeatureItem icon="card-outline" label="Virtual ID" delay={900} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    width: 280,
    height: 280,
  },
  iconWrapper: {
    position: 'absolute',
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0061FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 97, 255, 0.15)',
    borderStyle: 'dashed',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    maxWidth: 320,
    paddingHorizontal: 8,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  featureItem: {
    alignItems: 'center',
    gap: 8,
  },
  featureIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
