/**
 * Welcome Screen - Onboarding with Lottie Animation
 * Matches designapp/app/index.tsx exactly
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Logo } from '@components/Logo';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onLogin,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Animated community shield */}
        <View style={styles.animationContainer}>
          <LottieView
            source={require('../../assets/animations/community-shield.json')}
            autoPlay
            loop
            speed={1}
            resizeMode="cover"
            style={styles.lottie}
          />
        </View>

        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo />
          </View>

          {/* Main heading */}
          <Text style={styles.heading}>
            File transfer, bookmark anything made simple.
          </Text>

          {/* CTA Section */}
          <View style={styles.ctaContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onGetStarted}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>

            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={onLogin}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  animationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  lottie: {
    width: width * 0.8,
    height: width * 0.8,
  },
  content: {
    position: 'relative',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 48,
  },
  heading: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1E3A8A',
    lineHeight: 44,
    marginBottom: 32,
  },
  ctaContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginPromptText: {
    color: '#64748B',
    fontSize: 15,
  },
  loginLink: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
