/**
 * Mead Security Logo
 * Modern "M" monogram inspired by Facebook/Instagram app icons
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 72 }: LogoProps) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            borderRadius: size * 0.22,
          },
        ]}
      >
        {/* Gradient layers via stacked views */}
        <View style={[styles.gradientTop, { borderTopLeftRadius: size * 0.22, borderTopRightRadius: size * 0.22 }]} />
        <View style={[styles.gradientBottom, { borderBottomLeftRadius: size * 0.22, borderBottomRightRadius: size * 0.22 }]} />

        {/* Subtle shine overlay */}
        <View style={[styles.shine, { borderTopLeftRadius: size * 0.22, borderTopRightRadius: size * 0.22 }]} />

        {/* Monogram */}
        <Text
          style={[
            styles.monogram,
            {
              fontSize: size * 0.58,
              lineHeight: size * 0.58,
            },
          ]}
        >
          M
        </Text>
      </View>
      <Text style={styles.wordmark}>Mead Security</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tile: {
    backgroundColor: '#0A2540', // Deep navy base
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Soft shadow for depth
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: '#1E40AF', // Royal blue
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: '#0A2540', // Deep navy
    opacity: 0.85,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: '#FFFFFF',
    opacity: 0.08,
  },
  monogram: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: -2,
    textAlign: 'center',
    includeFontPadding: false,
    // Subtle glow
    textShadowColor: 'rgba(59, 130, 246, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  wordmark: {
    marginLeft: 14,
    fontSize: 22,
    fontWeight: '800',
    color: '#0A2540',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: -0.5,
  },
});
