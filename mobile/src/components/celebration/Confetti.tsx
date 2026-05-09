import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

interface ConfettiProps {
  visible: boolean;
  onComplete?: () => void;
  durationMs?: number;
  count?: number;
}

const COLORS = ['#E1342C', '#22c55e', '#facc15', '#3b82f6', '#a855f7', '#fb923c', '#06b6d4'];

interface Particle {
  x: number;
  size: number;
  color: string;
  shape: 'square' | 'circle';
  delay: number;
  drift: number;
  rotateTo: number;
}

const buildParticles = (count: number, width: number): Particle[] =>
  Array.from({ length: count }, () => ({
    x: Math.random() * width,
    size: 6 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: Math.random() > 0.5 ? 'square' : 'circle',
    // Stagger over a wide window so the "storm" sustains rather than
    // arriving in one burst.
    delay: Math.random() * 1100,
    drift: (Math.random() - 0.5) * 140,
    rotateTo: (Math.random() - 0.5) * 720,
  }));

export const Confetti: React.FC<ConfettiProps> = ({
  visible,
  onComplete,
  durationMs = 4200,
  count = 80,
}) => {
  const { width, height } = Dimensions.get('window');
  const particles = useMemo(() => buildParticles(count, width), [count, width]);
  const progressRefs = useRef<Animated.Value[]>(
    particles.map(() => new Animated.Value(0)),
  );

  useEffect(() => {
    if (!visible) return;
    progressRefs.current.forEach((v) => v.setValue(0));

    const animations = particles.map((p, i) =>
      Animated.timing(progressRefs.current[i], {
        toValue: 1,
        duration: durationMs,
        delay: p.delay,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    );

    const composite = Animated.parallel(animations);
    composite.start(({ finished }) => {
      if (finished) onComplete?.();
    });

    return () => {
      composite.stop();
    };
  }, [visible, particles, durationMs, onComplete]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {particles.map((p, i) => {
        const progress = progressRefs.current[i];
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-40, height + 60],
        });
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.drift],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotateTo}deg`],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.85, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: p.x,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === 'circle' ? p.size / 2 : 2,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
};

export default Confetti;
