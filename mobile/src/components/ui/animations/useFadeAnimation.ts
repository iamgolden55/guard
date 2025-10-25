/**
 * Fade Animation Hook
 * For opacity transitions and subtle appearance effects
 */

import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

interface UseFadeAnimationConfig {
  duration?: number;
  initialOpacity?: number;
}

export const useFadeAnimation = (config: UseFadeAnimationConfig = {}) => {
  const {
    duration = 300,
    initialOpacity = 0,
  } = config;

  const opacity = useSharedValue(initialOpacity);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const fadeIn = () => {
    'worklet';
    opacity.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.ease),
    });
  };

  const fadeOut = () => {
    'worklet';
    opacity.value = withTiming(0, {
      duration,
      easing: Easing.in(Easing.ease),
    });
  };

  const setOpacity = (value: number) => {
    'worklet';
    opacity.value = withTiming(value, {
      duration,
      easing: Easing.inOut(Easing.ease),
    });
  };

  return {
    animatedStyle,
    fadeIn,
    fadeOut,
    setOpacity,
  };
};
