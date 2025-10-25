/**
 * Scale Animation Hook
 * For button press effects and interactive elements
 */

import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

interface UseScaleAnimationConfig {
  scaleValue?: number;
  duration?: number;
  useSpring?: boolean;
}

export const useScaleAnimation = (config: UseScaleAnimationConfig = {}) => {
  const {
    scaleValue = 0.95,
    duration = 150,
    useSpring: shouldUseSpring = false,
  } = config;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const scaleDown = () => {
    'worklet';
    if (shouldUseSpring) {
      scale.value = withSpring(scaleValue, {
        damping: 15,
        stiffness: 150,
      });
    } else {
      scale.value = withTiming(scaleValue, { duration });
    }
  };

  const scaleUp = () => {
    'worklet';
    if (shouldUseSpring) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });
    } else {
      scale.value = withTiming(1, { duration });
    }
  };

  const resetScale = () => {
    'worklet';
    scale.value = 1;
  };

  return {
    animatedStyle,
    scaleDown,
    scaleUp,
    resetScale,
  };
};
