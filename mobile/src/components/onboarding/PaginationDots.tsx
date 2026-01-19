/**
 * PaginationDots Component
 * Carousel pagination indicator with smooth animated transitions
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface DotProps {
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
  index: number;
}

const AnimatedDot: React.FC<DotProps> = ({
  isActive,
  activeColor,
  inactiveColor,
  index,
}) => {
  const widthAnim = useRef(new Animated.Value(isActive ? 24 : 8)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0.4)).current;

  useEffect(() => {
    // Animate width and opacity - must use useNativeDriver: false for width
    if (isActive) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(widthAnim, {
            toValue: 28,
            tension: 300,
            friction: 10,
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
        ]),
        Animated.spring(widthAnim, {
          toValue: 24,
          tension: 300,
          friction: 10,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(widthAnim, {
          toValue: 8,
          tension: 300,
          friction: 15,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isActive, widthAnim, opacityAnim]);

  const backgroundColor = isActive ? activeColor : inactiveColor;

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: widthAnim,
          backgroundColor,
          opacity: opacityAnim,
        },
      ]}
    />
  );
};

interface Props {
  total: number;
  current: number;
  activeColor?: string;
  inactiveColor?: string;
}

export const PaginationDots: React.FC<Props> = ({
  total,
  current,
  activeColor = '#0061FF',
  inactiveColor = '#E0E0E0',
}) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, index) => (
        <AnimatedDot
          key={index}
          index={index}
          isActive={index === current}
          activeColor={activeColor}
          inactiveColor={inactiveColor}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
