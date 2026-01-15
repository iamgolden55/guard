/**
 * ShiftManagementSlide Component
 * Onboarding slide highlighting shift management features with animations
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
import type { SlideProps } from '../../../components/onboarding';

interface Props extends SlideProps {}

// Animated Feature Card with checkmark animation
const FeatureCard: React.FC<{
  icon: string;
  title: string;
  delay: number;
  color: string;
}> = ({ icon, title, delay, color }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-30)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      // Card entrance
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();

      // Checkmark appears after card
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            tension: 200,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(checkRotate, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);
    }, delay);

    return () => clearTimeout(timer);
  }, [opacity, translateX, scale, checkScale, checkRotate, delay]);

  const rotateInterpolate = checkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.featureCard,
        {
          opacity,
          transform: [{ translateX }, { scale }],
        },
      ]}
    >
      <View style={[styles.featureIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Animated.View
        style={{
          transform: [{ scale: checkScale }, { rotate: rotateInterpolate }],
        }}
      >
        <Ionicons name="checkmark-circle" size={22} color="#00C853" />
      </Animated.View>
    </Animated.View>
  );
};

export const ShiftManagementSlide: React.FC<Props> = ({ isActive }) => {
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(30)).current;
  const phoneScale = useRef(new Animated.Value(0.8)).current;
  const phoneOpacity = useRef(new Animated.Value(0)).current;
  const phoneRotate = useRef(new Animated.Value(-0.02)).current;

  useEffect(() => {
    // Phone entrance
    Animated.parallel([
      Animated.spring(phoneScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(phoneOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(phoneRotate, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
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
    }, 200);

    return () => clearTimeout(timer);
  }, [contentOpacity, contentTranslate, phoneScale, phoneOpacity, phoneRotate]);

  const rotateInterpolate = phoneRotate.interpolate({
    inputRange: [-0.02, 0],
    outputRange: ['-2deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Visual - Phone Mockup */}
      <Animated.View
        style={[
          styles.visualContainer,
          {
            opacity: phoneOpacity,
            transform: [{ scale: phoneScale }, { rotate: rotateInterpolate }],
          },
        ]}
      >
        <View style={styles.phoneFrame}>
          <View style={styles.phoneNotch} />
          <View style={styles.phoneScreen}>
            <View style={styles.phoneHeader}>
              <Ionicons name="menu" size={20} color="#333" />
              <Text style={styles.phoneHeaderText}>My Shifts</Text>
              <Ionicons name="notifications-outline" size={20} color="#333" />
            </View>
            <FeatureCard
              icon="location"
              title="GPS Check-in"
              delay={300}
              color="#0061FF"
            />
            <FeatureCard
              icon="create"
              title="Digital Signature"
              delay={450}
              color="#9C27B0"
            />
            <FeatureCard
              icon="time"
              title="Auto Checkout"
              delay={600}
              color="#FF9800"
            />
            <FeatureCard
              icon="swap-horizontal"
              title="Shift Exchange"
              delay={750}
              color="#00BCD4"
            />
          </View>
        </View>
      </Animated.View>

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
        <Text style={styles.title}>Effortless Shift{'\n'}Management</Text>

        <Text style={styles.description}>
          Check in with GPS verification, sign digitally, and manage your shifts all from your phone.
        </Text>
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
    paddingTop: 30,
    paddingBottom: 20,
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  phoneFrame: {
    width: 240,
    height: 340,
    backgroundColor: '#1A1A1A',
    borderRadius: 36,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  phoneNotch: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 24,
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    zIndex: 10,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
    paddingTop: 32,
    overflow: 'hidden',
  },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  phoneHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
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
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    maxWidth: 300,
    paddingHorizontal: 8,
  },
});
