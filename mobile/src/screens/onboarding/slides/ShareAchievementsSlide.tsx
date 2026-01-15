/**
 * ShareAchievementsSlide Component
 * Final onboarding slide with animated orbital elements and sharing features
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
  Linking,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OrbitAnimation } from '../../../components/onboarding';
import type { SlideProps } from '../../../components/onboarding';

interface Props extends SlideProps {}

// Floating Achievement Badge Component
const AchievementBadge: React.FC<{
  icon: string;
  color: string;
  style: object;
  delay: number;
}> = ({ icon, color, style, delay }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      // Entrance animation
      Animated.spring(scale, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Floating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2500 + Math.random() * 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2500 + Math.random() * 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Subtle rotation
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [scale, floatAnim, rotateAnim, delay]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <Animated.View
      style={[
        styles.achievementBadge,
        style,
        {
          transform: [{ scale }, { translateY }, { rotate }],
        },
      ]}
    >
      <LinearGradient
        colors={[color, `${color}DD`]}
        style={styles.badgeGradient}
      >
        <Ionicons name={icon as any} size={18} color="#FFFFFF" />
      </LinearGradient>
    </Animated.View>
  );
};

// Pulsing Glow Ring Component
const GlowRing: React.FC<{ size: number; delay: number }> = ({ size, delay }) => {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      // Fade in
      Animated.timing(opacity, {
        toValue: 0.6,
        duration: 600,
        useNativeDriver: true,
      }).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.9,
            duration: 2500,
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
        styles.glowRing,
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

// Feature Highlight Component
const FeatureHighlight: React.FC<{
  icon: string;
  label: string;
  delay: number;
  color: string;
}> = ({ icon, label, delay, color }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

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
      ]).start();

      setTimeout(() => {
        Animated.spring(iconScale, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }, 100);
    }, delay);

    return () => clearTimeout(timer);
  }, [opacity, translateY, iconScale, delay]);

  return (
    <Animated.View
      style={[
        styles.featureHighlight,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.featureIconContainer,
          { backgroundColor: `${color}15`, transform: [{ scale: iconScale }] },
        ]}
      >
        <Ionicons name={icon as any} size={20} color={color} />
      </Animated.View>
      <Text style={styles.featureLabel}>{label}</Text>
    </Animated.View>
  );
};

export const ShareAchievementsSlide: React.FC<Props> = ({ isActive }) => {
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(30)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  const orbitScale = useRef(new Animated.Value(0.7)).current;
  const orbitOpacity = useRef(new Animated.Value(0)).current;
  const privacyOpacity = useRef(new Animated.Value(0)).current;
  const privacyTranslate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // Orbit entrance
    Animated.parallel([
      Animated.spring(orbitScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(orbitOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Content entrance with stagger
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
        Animated.spring(titleScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, 300);

    // Privacy link entrance
    const privacyTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(privacyOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(privacyTranslate, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1200);

    return () => {
      clearTimeout(timer);
      clearTimeout(privacyTimer);
    };
  }, [
    contentOpacity,
    contentTranslate,
    titleScale,
    orbitScale,
    orbitOpacity,
    privacyOpacity,
    privacyTranslate,
  ]);

  const handlePrivacyPress = () => {
    Linking.openURL('https://www.meadsecurity.co.uk/privacy-policy');
  };

  return (
    <View style={styles.container}>
      {/* Orbital Animation with Glow */}
      <View style={styles.animationContainer}>
        {/* Background glow rings */}
        <GlowRing size={340} delay={100} />
        <GlowRing size={300} delay={200} />

        <Animated.View
          style={{
            transform: [{ scale: orbitScale }],
            opacity: orbitOpacity,
          }}
        >
          <OrbitAnimation size={280} primaryColor="#0061FF" />
        </Animated.View>

        {/* Floating achievement badges */}
        <AchievementBadge
          icon="trophy"
          color="#FFB800"
          style={styles.badge1}
          delay={600}
        />
        <AchievementBadge
          icon="star"
          color="#00C853"
          style={styles.badge2}
          delay={750}
        />
        <AchievementBadge
          icon="ribbon"
          color="#9C27B0"
          style={styles.badge3}
          delay={900}
        />
        <AchievementBadge
          icon="medal"
          color="#0061FF"
          style={styles.badge4}
          delay={1050}
        />
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
        <Animated.Text
          style={[styles.title, { transform: [{ scale: titleScale }] }]}
        >
          Share Your{'\n'}Achievements
        </Animated.Text>

        <Text style={styles.description}>
          Invite your friends to join the team and share your accomplishments.
          Build your network and grow together.
        </Text>

        {/* Feature highlights */}
        <View style={styles.featuresRow}>
          <FeatureHighlight
            icon="share-social"
            label="Share"
            delay={800}
            color="#0061FF"
          />
          <FeatureHighlight
            icon="people"
            label="Connect"
            delay={950}
            color="#00C853"
          />
          <FeatureHighlight
            icon="trending-up"
            label="Grow"
            delay={1100}
            color="#FF9800"
          />
        </View>

        <Animated.View
          style={{
            opacity: privacyOpacity,
            transform: [{ translateY: privacyTranslate }],
          }}
        >
          <TouchableOpacity onPress={handlePrivacyPress} activeOpacity={0.7}>
            <Text style={styles.privacyLink}>
              Learn more about our Privacy Policy
            </Text>
          </TouchableOpacity>
        </Animated.View>
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
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
    width: 340,
    height: 280,
  },
  glowRing: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(0, 97, 255, 0.2)',
  },
  achievementBadge: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  badgeGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge1: {
    top: 0,
    right: 40,
  },
  badge2: {
    top: 60,
    left: 10,
  },
  badge3: {
    bottom: 30,
    left: 25,
  },
  badge4: {
    bottom: 50,
    right: 20,
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
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 24,
  },
  featureHighlight: {
    alignItems: 'center',
    gap: 8,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  privacyLink: {
    fontSize: 14,
    color: '#0061FF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    textDecorationLine: 'underline',
  },
});
