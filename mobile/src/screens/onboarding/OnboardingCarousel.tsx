/**
 * OnboardingCarousel Screen
 * Multi-screen swipeable onboarding experience with smooth animations
 * Shows on first app launch and can be replayed from Settings
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Platform,
  SafeAreaView,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch } from '../../hooks/useRedux';
import {
  completeOnboarding,
  setCurrentSlide,
} from '../../store/slices/onboardingSlice';
import { PaginationDots } from '../../components/onboarding';

// Import slides
import {
  WelcomeSlide,
  ShiftManagementSlide,
  SecurityFeaturesSlide,
  ShareAchievementsSlide,
} from './slides';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Slide configuration - 4 onboarding slides
const ONBOARDING_SLIDES = [
  {
    id: 'welcome',
    component: WelcomeSlide,
  },
  {
    id: 'shifts',
    component: ShiftManagementSlide,
  },
  {
    id: 'security',
    component: SecurityFeaturesSlide,
  },
  {
    id: 'share',
    component: ShareAchievementsSlide,
  },
];

interface SlideItem {
  id: string;
  component: React.FC<{ isActive: boolean; slideIndex: number }>;
}

// Animated Button Component
const AnimatedButton: React.FC<{
  onPress: () => void;
  isLastSlide: boolean;
}> = ({ onPress, isLastSlide }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const textChangeAnim = useRef(new Animated.Value(isLastSlide ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(textChangeAnim, {
      toValue: isLastSlide ? 1 : 0,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isLastSlide, textChangeAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.nextButton,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={styles.nextButtonText}>
          {isLastSlide ? "LET'S GO!" : 'Next'}
        </Text>
        {!isLastSlide && (
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#FFFFFF"
            style={styles.buttonIcon}
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Skip Button with fade animation
const SkipButton: React.FC<{
  visible: boolean;
  onPress: () => void;
}> = ({ visible, onPress }) => {
  const opacityAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  return (
    <Animated.View style={[styles.skipButton, { opacity: opacityAnim }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!visible}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const OnboardingCarousel = () => {
  const dispatch = useAppDispatch();
  // Always start from first slide when onboarding opens
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const footerTranslate = useRef(new Animated.Value(30)).current;

  const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

  // Animate footer on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.spring(footerTranslate, {
        toValue: 0,
        tension: 50,
        friction: 8,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [footerOpacity, footerTranslate]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const slideIndex = Math.round(
        event.nativeEvent.contentOffset.x / SCREEN_WIDTH
      );
      setCurrentIndex(slideIndex);
      dispatch(setCurrentSlide(slideIndex));
    },
    [dispatch]
  );

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      dispatch(completeOnboarding());
    } else {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
      dispatch(setCurrentSlide(nextIndex));
    }
  }, [currentIndex, isLastSlide, dispatch]);

  const handleSkip = useCallback(() => {
    dispatch(completeOnboarding());
  }, [dispatch]);

  const renderSlide = useCallback(
    ({ item, index }: { item: SlideItem; index: number }) => {
      const SlideComponent = item.component;

      // Calculate parallax/fade effects based on scroll position
      const inputRange = [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ];

      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.3, 1, 0.3],
        extrapolate: 'clamp',
      });

      const scale = scrollX.interpolate({
        inputRange,
        outputRange: [0.9, 1, 0.9],
        extrapolate: 'clamp',
      });

      const translateX = scrollX.interpolate({
        inputRange,
        outputRange: [50, 0, -50],
        extrapolate: 'clamp',
      });

      return (
        <Animated.View
          style={[
            styles.slideContainer,
            {
              opacity,
              transform: [{ scale }, { translateX }],
            },
          ]}
        >
          <SlideComponent isActive={index === currentIndex} slideIndex={index} />
        </Animated.View>
      );
    },
    [currentIndex, scrollX]
  );

  const keyExtractor = useCallback((item: SlideItem) => item.id, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Skip Button */}
      <SkipButton visible={!isLastSlide} onPress={handleSkip} />

      {/* Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        initialScrollIndex={0}
        style={styles.flatList}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="center"
      />

      {/* Footer */}
      <Animated.View
        style={[
          styles.footer,
          {
            opacity: footerOpacity,
            transform: [{ translateY: footerTranslate }],
          },
        ]}
      >
        <PaginationDots
          total={ONBOARDING_SLIDES.length}
          current={currentIndex}
          activeColor="#0061FF"
          inactiveColor="#E0E0E0"
        />

        <AnimatedButton onPress={handleNext} isLastSlide={isLastSlide} />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  flatList: {
    flex: 1,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 30,
    paddingTop: 20,
    gap: 24,
  },
  nextButton: {
    backgroundColor: '#0061FF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0061FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
