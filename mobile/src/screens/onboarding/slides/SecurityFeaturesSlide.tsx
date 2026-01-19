/**
 * SecurityFeaturesSlide Component
 * Onboarding slide highlighting security compliance features with animations
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

// Floating Badge Component
const FloatingBadge: React.FC<{
  icon: string;
  style: object;
  delay: number;
}> = ({ icon, style, delay }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    const timer = setTimeout(() => {
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Floating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [scale, floatAnim, delay]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View
      style={[
        styles.floatingBadge,
        style,
        {
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      <Ionicons name={icon as any} size={16} color="#0061FF" />
    </Animated.View>
  );
};

// Benefit Item Component
const BenefitItem: React.FC<{
  text: string;
  delay: number;
}> = ({ text, delay }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-20)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
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
      ]).start();

      setTimeout(() => {
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }, 150);
    }, delay);

    return () => clearTimeout(timer);
  }, [opacity, translateX, checkScale, delay]);

  return (
    <Animated.View
      style={[
        styles.benefitItem,
        {
          opacity,
          transform: [{ translateX }],
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: checkScale }] }}>
        <Ionicons name="checkmark-circle" size={18} color="#00C853" />
      </Animated.View>
      <Text style={styles.benefitText}>{text}</Text>
    </Animated.View>
  );
};

export const SecurityFeaturesSlide: React.FC<Props> = ({ isActive }) => {
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.7)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardRotateX = useRef(new Animated.Value(0.3)).current;
  const cardRotateZ = useRef(new Animated.Value(-0.05)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Card entrance with 3D effect
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(cardRotateX, {
        toValue: 0,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(cardRotateZ, {
        toValue: 0,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloat, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardFloat, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

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
  }, [
    contentOpacity,
    contentTranslate,
    cardScale,
    cardOpacity,
    cardRotateX,
    cardRotateZ,
    cardFloat,
    shimmerAnim,
  ]);

  const floatTranslateY = cardFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const rotateXInterpolate = cardRotateX.interpolate({
    inputRange: [0, 0.3],
    outputRange: ['0deg', '15deg'],
  });

  const rotateZInterpolate = cardRotateZ.interpolate({
    inputRange: [-0.05, 0],
    outputRange: ['-3deg', '0deg'],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View style={styles.container}>
      {/* Visual - Virtual ID Card */}
      <View style={styles.visualContainer}>
        <Animated.View
          style={[
            styles.idCardContainer,
            {
              opacity: cardOpacity,
              transform: [
                { scale: cardScale },
                { rotateX: rotateXInterpolate },
                { rotate: rotateZInterpolate },
                { translateY: floatTranslateY },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#1E3A8A', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.idCard}
          >
            {/* Shimmer Effect */}
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />

            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={styles.companyBadge}>
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.companyName}>MEAD SECURITY</Text>
            </View>

            {/* Card Body */}
            <View style={styles.cardBody}>
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={36} color="rgba(255,255,255,0.5)" />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.staffName}>John Smith</Text>
                <Text style={styles.staffRole}>Door Supervisor</Text>
                <View style={styles.licenseRow}>
                  <Ionicons name="card" size={12} color="#60A5FA" />
                  <Text style={styles.licenseNumber}>SIA: 1234567890</Text>
                </View>
              </View>
            </View>

            {/* Card Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={28} color="rgba(255,255,255,0.8)" />
              </View>
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#00C853" />
                <Text style={styles.statusText}>VERIFIED</Text>
              </View>
            </View>

            {/* Decorative Elements */}
            <View style={styles.cardPattern} />
          </LinearGradient>
        </Animated.View>

        {/* Floating badges */}
        <FloatingBadge icon="shield-checkmark" style={styles.badge1} delay={500} />
        <FloatingBadge icon="finger-print" style={styles.badge2} delay={700} />
        <FloatingBadge icon="scan" style={styles.badge3} delay={900} />
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
        <Text style={styles.title}>Your Digital{'\n'}ID Card</Text>

        <Text style={styles.description}>
          Carry your SIA license digitally. Show your verified credentials with a quick scan.
        </Text>

        <View style={styles.benefitsRow}>
          <BenefitItem text="Always Updated" delay={800} />
          <BenefitItem text="Instant Verification" delay={950} />
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
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    width: 320,
    height: 240,
  },
  idCardContainer: {
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  idCard: {
    width: 280,
    height: 175,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ skewX: '-20deg' }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  companyName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  photoPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  staffRole: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  licenseNumber: {
    fontSize: 9,
    color: '#60A5FA',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qrPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00C853',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  cardPattern: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  floatingBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  badge1: {
    top: 10,
    right: 30,
  },
  badge2: {
    bottom: 40,
    left: 10,
  },
  badge3: {
    top: 80,
    left: 20,
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
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
