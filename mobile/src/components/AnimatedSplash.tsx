/**
 * Modern Splash Screen Component
 * Features: Zoom-out transition, flexible props, modern typography, footer info
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Platform,
  Dimensions,
  StatusBar,
  StyleProp,
  ViewStyle,
} from 'react-native';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

interface ModernSplashProps {
  onAnimationFinish?: () => void;
  animationSource?: any; // Allow passing different JSON files
  title?: string;
  subtitle?: string;
  primaryColor?: string;
  minDuration?: number;
  style?: StyleProp<ViewStyle>;
}

export const ModernSplash: React.FC<ModernSplashProps> = ({
  onAnimationFinish,
  animationSource = require('../assets/animations/splash-logo.json'), // Default
  title = "Mead Security",
  subtitle = "Secure. Professional. Reliable.",
  primaryColor = '#1E293B', // Modern Slate-900
  minDuration = 3000,
  style,
}) => {
  // Animation Values
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Text Entrance Animations
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;

  // State to track readiness
  const [animationComplete, setAnimationComplete] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // 1. Entrance Animation
  useEffect(() => {
    // Wait slightly for the Lottie to start, then animate text in
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // 2. Timer Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);
    return () => clearTimeout(timer);
  }, [minDuration]);

  // 3. Exit Transition Logic
  useEffect(() => {
    if (animationComplete && minTimeElapsed) {
      // Run parallel animations for a "Zoom & Fade" effect
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 2, // Stronger zoom out effect
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationFinish?.();
      });
    }
  }, [animationComplete, minTimeElapsed]);

  const handleLottieFinish = () => {
    setAnimationComplete(true);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Center Content */}
      <View style={styles.centerContent}>
        <View style={styles.animationWrapper}>
          <LottieView
            source={animationSource}
            autoPlay
            loop={false}
            speed={1}
            resizeMode="contain"
            style={styles.lottie}
            onAnimationFinish={handleLottieFinish}
          />
        </View>

        <Animated.View
          style={[
            styles.textWrapper,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }]
            }
          ]}
        >
          <Text style={[styles.title, { color: primaryColor }]}>
            {title}
          </Text>
          <Text style={styles.subtitle}>
            {subtitle}
          </Text>
        </Animated.View>
      </View>

      {/* Modern Footer (Version Info) */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>v1.0.0 • Mead Security Services</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: height * 0.05, // Adjusted visual offset
  },
  animationWrapper: {
    width: width * 0.7, // Slightly larger
    height: width * 0.7,
    marginBottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  textWrapper: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -20, // Pull text closer to animation if needed
  },
  title: {
    fontSize: 32,
    fontWeight: '800', // Extra bold for modern look
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B', // Slate-500
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    lineHeight: 24,
    fontWeight: '500',
  },
  footer: {
    paddingBottom: 40,
    opacity: 0.6,
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8', // Slate-400
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

// Export both names for backwards compatibility
export const AnimatedSplash = ModernSplash;
export default ModernSplash;
