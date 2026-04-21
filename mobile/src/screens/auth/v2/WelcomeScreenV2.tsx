/**
 * WelcomeScreenV2 — dark premium redesign
 *
 * Post-onboarding entry point. Preserves existing navigation actions
 * (Login navigate, Create account opens apply URL via WebBrowser).
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome, AntDesign } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import type { AuthStackParamList } from '../../../types/navigation';
import {
  redesignColors,
  redesignFonts,
  redesignShadows,
  redesignText,
} from '../../../theme/redesign';

const { width: SCREEN_W } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

// Small Mead mark: dashed outer circle, solid accent dot, accent arc
const MeadMark: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Circle
      cx="16"
      cy="16"
      r="14"
      stroke={redesignColors.text.primary}
      strokeOpacity={0.3}
      strokeWidth={1}
      fill="none"
    />
    <Circle cx="16" cy="16" r="5" fill={redesignColors.accent} />
    <Path
      d="M16 2 A14 14 0 0 1 30 16"
      stroke={redesignColors.accent}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

export const WelcomeScreenV2: React.FC = () => {
  const navigation = useNavigation<Nav>();

  // Ambient glow breathing
  const breathe = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.06,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(rise, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [breathe, fade, rise]);

  const openApply = () =>
    WebBrowser.openBrowserAsync(
      'https://admin.meadsecurity.co.uk/apply/mead-security-1',
    );

  const openPrivacy = () =>
    WebBrowser.openBrowserAsync(
      'https://www.meadsecurity.co.uk/privacy-policy',
    );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Ambient red glow behind mark */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { transform: [{ scale: breathe }] }]}
      >
        <LinearGradient
          colors={[
            'rgba(225,52,44,0.38)',
            'rgba(225,52,44,0.12)',
            'transparent',
          ]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Brand block */}
      <Animated.View
        style={[
          styles.brand,
          { opacity: fade, transform: [{ translateY: rise }] },
        ]}
      >
        <MeadMark size={44} />
        <Text style={styles.brandName}>Mead Security</Text>
        <Text style={styles.brandTag} allowFontScaling={false}>
          WORKFORCE PLATFORM
        </Text>
      </Animated.View>

      {/* Value prop */}
      <Animated.View
        style={[
          styles.valueProp,
          { opacity: fade, transform: [{ translateY: rise }] },
        ]}
      >
        <Text style={styles.valueTitle}>Sign in to start your shift.</Text>
        <Text style={styles.valueBody}>
          Shifts, check-in, team chat and virtual ID — all in one place.
        </Text>
      </Animated.View>

      {/* CTA stack */}
      <Animated.View
        style={[styles.ctaStack, { opacity: fade }]}
      >
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.appleBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <FontAwesome
              name="apple"
              size={18}
              color="#000"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.appleBtnText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.googleBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <AntDesign
            name="google"
            size={18}
            color="#fff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.hairline} />
          <Text style={styles.dividerText} allowFontScaling={false}>
            OR
          </Text>
          <View style={styles.hairline} />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.emailBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.emailBtnText}>Continue with email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.createWrap}
          onPress={openApply}
        >
          <Text style={styles.createText}>
            New here? <Text style={styles.createLink}>Create an account</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing you agree to our{' '}
          <Text style={styles.termsLink} onPress={openPrivacy}>
            Privacy Policy
          </Text>
          .
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: redesignColors.canvas,
  },
  glow: {
    position: 'absolute',
    left: SCREEN_W / 2 - 300,
    top: 80,
    width: 600,
    height: 600,
    borderRadius: 300,
  },
  brand: {
    marginTop: Platform.OS === 'ios' ? 130 : 100,
    alignItems: 'center',
    gap: 14,
  },
  brandName: {
    ...redesignText.title,
    fontSize: 32,
  },
  brandTag: {
    ...redesignText.meta,
    fontSize: 10,
    letterSpacing: 3.0,
    color: redesignColors.text.secondary,
  },
  valueProp: {
    marginTop: 56,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  valueTitle: {
    ...redesignText.heading,
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 12,
  },
  valueBody: {
    ...redesignText.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  ctaStack: {
    marginTop: 'auto',
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 42 : 36,
    gap: 12,
  },
  appleBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleBtnText: {
    ...redesignText.button,
    color: '#000',
    fontSize: 16,
  },
  googleBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: redesignColors.surface.chip,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairlineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    ...redesignText.button,
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: redesignColors.surface.hairlineStrong,
  },
  dividerText: {
    fontFamily: redesignFonts.mono,
    fontSize: 10,
    letterSpacing: 2.4,
    color: redesignColors.text.tertiary,
  },
  emailBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: redesignColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...redesignShadows.primaryGlow,
  },
  emailBtnText: {
    ...redesignText.button,
    fontSize: 16,
  },
  createWrap: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  createText: {
    ...redesignText.body,
    fontSize: 13,
    color: redesignColors.text.secondary,
  },
  createLink: {
    color: redesignColors.accent,
    fontWeight: '500',
  },
  terms: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 11,
    color: redesignColors.text.tertiary,
    lineHeight: 16,
    maxWidth: 280,
    alignSelf: 'center',
    fontFamily: redesignFonts.sans,
  },
  termsLink: {
    color: redesignColors.text.secondary,
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreenV2;
