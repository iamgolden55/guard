/**
 * OrbitAnimation Component
 * Animated orbital elements with rotating icons and avatars
 * Based on the "Share Your Achievements" design mockup
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Easing } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

interface OrbitItemProps {
  rotation: Animated.Value;
  orbitRadius: number;
  startAngle: number;
  children: React.ReactNode;
  counterRotate?: boolean;
}

const OrbitItem: React.FC<OrbitItemProps> = ({
  rotation,
  orbitRadius,
  startAngle,
  children,
  counterRotate = true,
}) => {
  // Calculate position based on angle
  const rotationDeg = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: [`${startAngle}deg`, `${startAngle + 360}deg`],
  });

  // Counter-rotation to keep icons upright
  const counterRotationDeg = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.orbitItemContainer,
        {
          width: orbitRadius * 2,
          height: orbitRadius * 2,
          transform: [{ rotate: rotationDeg }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.orbitItem,
          counterRotate && { transform: [{ rotate: counterRotationDeg }] },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
};

interface Props {
  size?: number;
  primaryColor?: string;
}

export const OrbitAnimation: React.FC<Props> = ({
  size = 300,
  primaryColor = '#0061FF',
}) => {
  // Animation values for different orbit speeds
  const rotation1 = useRef(new Animated.Value(0)).current;
  const rotation2 = useRef(new Animated.Value(0)).current;
  const rotation3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Orbit 1: Slowest (innermost)
    Animated.loop(
      Animated.timing(rotation1, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Orbit 2: Medium speed
    Animated.loop(
      Animated.timing(rotation2, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Orbit 3: Fastest (outermost)
    Animated.loop(
      Animated.timing(rotation3, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotation1, rotation2, rotation3]);

  const centerSize = size * 0.25;
  const orbit1Radius = size * 0.22;
  const orbit2Radius = size * 0.35;
  const orbit3Radius = size * 0.48;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Orbit Circles */}
      <View
        style={[
          styles.orbitCircle,
          {
            width: orbit1Radius * 2,
            height: orbit1Radius * 2,
            borderColor: `${primaryColor}15`,
          },
        ]}
      />
      <View
        style={[
          styles.orbitCircle,
          {
            width: orbit2Radius * 2,
            height: orbit2Radius * 2,
            borderColor: `${primaryColor}10`,
          },
        ]}
      />
      <View
        style={[
          styles.orbitCircle,
          {
            width: orbit3Radius * 2,
            height: orbit3Radius * 2,
            borderColor: `${primaryColor}08`,
          },
        ]}
      />

      {/* Center Icon */}
      <View
        style={[
          styles.centerIcon,
          {
            width: centerSize,
            height: centerSize,
            backgroundColor: primaryColor,
          },
        ]}
      >
        <Ionicons name="share-social" size={centerSize * 0.5} color="#FFFFFF" />
      </View>

      {/* Orbit 1 - Social Icons */}
      <OrbitItem rotation={rotation1} orbitRadius={orbit1Radius} startAngle={0}>
        <View style={[styles.socialIcon, { backgroundColor: '#E4405F' }]}>
          <FontAwesome5 name="instagram" size={16} color="#FFFFFF" />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation1} orbitRadius={orbit1Radius} startAngle={180}>
        <View style={[styles.socialIcon, { backgroundColor: '#1DA1F2' }]}>
          <FontAwesome5 name="twitter" size={16} color="#FFFFFF" />
        </View>
      </OrbitItem>

      {/* Orbit 2 - More Social + Avatars */}
      <OrbitItem rotation={rotation2} orbitRadius={orbit2Radius} startAngle={45}>
        <View style={[styles.socialIcon, { backgroundColor: '#1877F2' }]}>
          <FontAwesome5 name="facebook-f" size={16} color="#FFFFFF" />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation2} orbitRadius={orbit2Radius} startAngle={135}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/100?img=1' }}
            style={styles.avatar}
          />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation2} orbitRadius={orbit2Radius} startAngle={225}>
        <View style={[styles.socialIcon, { backgroundColor: '#0088CC' }]}>
          <FontAwesome5 name="telegram-plane" size={16} color="#FFFFFF" />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation2} orbitRadius={orbit2Radius} startAngle={315}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/100?img=2' }}
            style={styles.avatar}
          />
        </View>
      </OrbitItem>

      {/* Orbit 3 - Outer avatars and icons */}
      <OrbitItem rotation={rotation3} orbitRadius={orbit3Radius} startAngle={20}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/100?img=3' }}
            style={styles.avatar}
          />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation3} orbitRadius={orbit3Radius} startAngle={90}>
        <View style={[styles.socialIcon, { backgroundColor: '#25D366' }]}>
          <FontAwesome5 name="whatsapp" size={16} color="#FFFFFF" />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation3} orbitRadius={orbit3Radius} startAngle={160}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/100?img=4' }}
            style={styles.avatar}
          />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation3} orbitRadius={orbit3Radius} startAngle={230}>
        <View style={[styles.socialIcon, { backgroundColor: '#0A66C2' }]}>
          <FontAwesome5 name="linkedin-in" size={16} color="#FFFFFF" />
        </View>
      </OrbitItem>

      <OrbitItem rotation={rotation3} orbitRadius={orbit3Radius} startAngle={300}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/100?img=5' }}
            style={styles.avatar}
          />
        </View>
      </OrbitItem>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbitCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  centerIcon: {
    position: 'absolute',
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0061FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  orbitItemContainer: {
    position: 'absolute',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  orbitItem: {
    position: 'absolute',
    right: -18,
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});
