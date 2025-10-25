/**
 * Logo Component
 * Simple geometric logo with navy blue and light blue gradient
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

export function Logo() {
  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <View style={styles.gradientOverlay} />
        <View style={styles.accentCorner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 64,
    height: 64,
    backgroundColor: '#1E3A8A', // Navy blue
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#3B82F6', // Light blue
    opacity: 0.6,
  },
  accentCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    backgroundColor: '#60A5FA', // Sky blue
    borderTopLeftRadius: 12,
  },
});
