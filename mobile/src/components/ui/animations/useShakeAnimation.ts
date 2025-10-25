/**
 * Shake Animation Hook
 * For error states and validation feedback
 */

import { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';

interface UseShakeAnimationConfig {
  intensity?: number;
  duration?: number;
}

export const useShakeAnimation = (config: UseShakeAnimationConfig = {}) => {
  const {
    intensity = 10,
    duration = 50,
  } = config;

  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const shake = () => {
    'worklet';
    translateX.value = withSequence(
      withTiming(intensity, { duration, easing: Easing.linear }),
      withTiming(-intensity, { duration, easing: Easing.linear }),
      withTiming(intensity, { duration, easing: Easing.linear }),
      withTiming(-intensity, { duration, easing: Easing.linear }),
      withTiming(0, { duration, easing: Easing.linear })
    );
  };

  const resetShake = () => {
    'worklet';
    translateX.value = 0;
  };

  return {
    animatedStyle,
    shake,
    resetShake,
  };
};
