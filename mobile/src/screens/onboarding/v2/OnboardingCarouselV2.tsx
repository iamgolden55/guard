/**
 * OnboardingCarouselV2 — dark premium redesign
 *
 * Swappable drop-in for the original OnboardingCarousel. Uses the same
 * redux actions (completeOnboarding / setCurrentSlide), so navigation
 * flow is unchanged.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Platform,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch } from '../../../hooks/useRedux';
import {
  completeOnboarding,
  setCurrentSlide,
} from '../../../store/slices/onboardingSlice';

import WelcomeSlideV2 from './WelcomeSlideV2';
import ShiftsSlideV2 from './ShiftsSlideV2';
import CredentialsSlideV2 from './CredentialsSlideV2';
import TeamSlideV2 from './TeamSlideV2';

import {
  redesignColors,
  redesignFonts,
  redesignShadows,
  redesignText,
} from '../../../theme/redesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideItem {
  id: string;
  ctaLabel: string;
  component: React.FC;
}

const SLIDES: SlideItem[] = [
  { id: 'welcome', ctaLabel: 'Get started', component: WelcomeSlideV2 },
  { id: 'shifts', ctaLabel: 'Continue', component: ShiftsSlideV2 },
  { id: 'credentials', ctaLabel: 'Continue', component: CredentialsSlideV2 },
  { id: 'team', ctaLabel: "Let's go", component: TeamSlideV2 },
];

// ─────────────────────────────────────────────────────────────
// Animated pill pagination (active grows to 24px, others 6px)
// ─────────────────────────────────────────────────────────────
const PillPagination: React.FC<{ total: number; current: number }> = ({
  total,
  current,
}) => (
  <View style={styles.pillsRow}>
    {Array.from({ length: total }).map((_, i) => {
      const active = i === current;
      return (
        <View
          key={i}
          style={[
            styles.pill,
            {
              width: active ? 24 : 6,
              backgroundColor: active
                ? redesignColors.accent
                : 'rgba(255,255,255,0.22)',
            },
          ]}
        />
      );
    })}
  </View>
);

// ─────────────────────────────────────────────────────────────
// Primary CTA with arrow
// ─────────────────────────────────────────────────────────────
interface CtaProps {
  label: string;
  onPress: () => void;
  isLast: boolean;
}

const PrimaryCTA: React.FC<CtaProps> = ({ label, onPress, isLast }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => press(0.97)}
      onPressOut={() => press(1)}
    >
      <Animated.View style={[styles.cta, { transform: [{ scale }] }]}>
        <Text style={styles.ctaLabel}>{label}</Text>
        {!isLast && (
          <Ionicons
            name="arrow-forward"
            size={18}
            color={redesignColors.text.primary}
            style={{ marginLeft: 8 }}
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const OnboardingCarouselV2: React.FC = () => {
  const dispatch = useAppDispatch();
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLastSlide = currentIndex === SLIDES.length - 1;

  const footerFade = useRef(new Animated.Value(0)).current;
  const footerY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(footerFade, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.spring(footerY, {
        toValue: 0,
        tension: 50,
        friction: 9,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [footerFade, footerY]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentIndex(idx);
      dispatch(setCurrentSlide(idx));
    },
    [dispatch],
  );

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      dispatch(completeOnboarding());
      return;
    }
    const next = currentIndex + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
    dispatch(setCurrentSlide(next));
  }, [isLastSlide, currentIndex, dispatch]);

  const handleSkip = useCallback(() => {
    dispatch(completeOnboarding());
  }, [dispatch]);

  const renderItem = useCallback(
    ({ item }: { item: SlideItem }) => {
      const Slide = item.component;
      return (
        <View style={styles.slideWrap}>
          <Slide />
        </View>
      );
    },
    [],
  );

  const keyExtractor = useCallback((item: SlideItem) => item.id, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        {/* Skip button */}
        {!isLastSlide && (
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skip}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.skipLabel} allowFontScaling={false}>
              SKIP
            </Text>
          </TouchableOpacity>
        )}

        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_, i) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * i,
            index: i,
          })}
          style={styles.flatList}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="center"
        />

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: footerFade,
              transform: [{ translateY: footerY }],
            },
          ]}
        >
          <PillPagination total={SLIDES.length} current={currentIndex} />
          <PrimaryCTA
            label={SLIDES[currentIndex].ctaLabel}
            onPress={handleNext}
            isLast={isLastSlide}
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: redesignColors.canvas,
  },
  safe: {
    flex: 1,
  },
  skip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 18 : 36,
    right: 24,
    zIndex: 20,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skipLabel: {
    fontFamily: redesignFonts.mono,
    fontSize: 11,
    color: redesignColors.text.secondary,
    letterSpacing: 2.0,
  },
  flatList: {
    flex: 1,
  },
  slideWrap: {
    width: SCREEN_WIDTH,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 32 : 36,
    paddingTop: 12,
    gap: 24,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pill: {
    height: 6,
    borderRadius: 3,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: redesignColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...redesignShadows.primaryGlow,
  },
  ctaLabel: {
    ...redesignText.button,
    fontSize: 17,
  },
});

export default OnboardingCarouselV2;
