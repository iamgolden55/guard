/**
 * Slide Animation Hook
 * For modal slide-up/down animations and drawer effects
 */

import { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface UseSlideAnimationConfig {
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  useSpring?: boolean;
}

export const useSlideAnimation = (config: UseSlideAnimationConfig = {}) => {
  const {
    direction = 'up',
    distance = SCREEN_HEIGHT,
    duration = 300,
    useSpring: shouldUseSpring = true,
  } = config;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Set initial position based on direction
  const getInitialPosition = () => {
    switch (direction) {
      case 'up':
        return { x: 0, y: distance };
      case 'down':
        return { x: 0, y: -distance };
      case 'left':
        return { x: distance, y: 0 };
      case 'right':
        return { x: -distance, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  const slideIn = () => {
    'worklet';
    if (shouldUseSpring) {
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
    } else {
      translateX.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }
  };

  const slideOut = () => {
    'worklet';
    const initialPos = getInitialPosition();

    if (shouldUseSpring) {
      translateX.value = withSpring(initialPos.x, {
        damping: 20,
        stiffness: 90,
      });
      translateY.value = withSpring(initialPos.y, {
        damping: 20,
        stiffness: 90,
      });
    } else {
      translateX.value = withTiming(initialPos.x, {
        duration,
        easing: Easing.in(Easing.cubic),
      });
      translateY.value = withTiming(initialPos.y, {
        duration,
        easing: Easing.in(Easing.cubic),
      });
    }
  };

  const resetPosition = () => {
    'worklet';
    const initialPos = getInitialPosition();
    translateX.value = initialPos.x;
    translateY.value = initialPos.y;
  };

  return {
    animatedStyle,
    slideIn,
    slideOut,
    resetPosition,
  };
};
