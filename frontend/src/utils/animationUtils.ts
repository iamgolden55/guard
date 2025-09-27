import { Variants, Target, TargetAndTransition } from 'framer-motion';

// Animation configuration based on device and accessibility preferences
export interface AnimationConfig {
  duration: {
    fast: number;
    medium: number;
    slow: number;
  };
  easing: {
    standard: string;
    decelerated: string;
    accelerated: string;
    sharp: string;
  };
  mobile: {
    reducedMotion: boolean;
    preferFade: boolean;
    shortenDurations: boolean;
  };
}

// Detect user preferences and device capabilities
export const detectAnimationPreferences = (): AnimationConfig => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isMobile =
    typeof window !== 'undefined' &&
    window.innerWidth < 768;

  const isLowPerformance =
    typeof navigator !== 'undefined' &&
    'hardwareConcurrency' in navigator &&
    (navigator as any).hardwareConcurrency <= 2;

  return {
    duration: {
      fast: prefersReducedMotion || isLowPerformance ? 0.1 : isMobile ? 0.2 : 0.3,
      medium: prefersReducedMotion || isLowPerformance ? 0.15 : isMobile ? 0.3 : 0.4,
      slow: prefersReducedMotion || isLowPerformance ? 0.2 : isMobile ? 0.4 : 0.6
    },
    easing: {
      standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      decelerated: 'cubic-bezier(0, 0, 0.2, 1)',
      accelerated: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
    },
    mobile: {
      reducedMotion: prefersReducedMotion,
      preferFade: isMobile || prefersReducedMotion,
      shortenDurations: isLowPerformance
    }
  };
};

// Get animation configuration based on current context
export const getAnimationConfig = (): AnimationConfig => {
  return detectAnimationPreferences();
};

// Create responsive animation variants
export const createResponsiveVariants = (
  desktopVariants: Variants,
  mobileVariants?: Variants
): Variants => {
  const config = getAnimationConfig();
  const variants = config.mobile.preferFade && mobileVariants ? mobileVariants : desktopVariants;

  // Apply duration scaling for low-performance devices
  if (config.mobile.shortenDurations) {
    Object.keys(variants).forEach(key => {
      const variant = variants[key] as TargetAndTransition;
      if (variant?.transition?.duration) {
        variant.transition.duration *= 0.5;
      }
    });
  }

  return variants;
};

// Standard animation variants with responsive support
export const standardVariants = {
  // Page/Step transitions
  pageTransition: createResponsiveVariants(
    {
      enter: {
        opacity: 0,
        x: 100,
        transition: { duration: 0.4, ease: "easeOut" }
      },
      center: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.4, ease: "easeOut" }
      },
      exit: {
        opacity: 0,
        x: -100,
        transition: { duration: 0.3, ease: "easeIn" }
      }
    },
    {
      // Mobile variants - prefer fade over slide
      enter: {
        opacity: 0,
        transition: { duration: 0.2, ease: "easeOut" }
      },
      center: {
        opacity: 1,
        transition: { duration: 0.2, ease: "easeOut" }
      },
      exit: {
        opacity: 0,
        transition: { duration: 0.15, ease: "easeIn" }
      }
    }
  ),

  // Form field animations
  formField: createResponsiveVariants(
    {
      initial: { opacity: 0, y: 10, scale: 0.98 },
      animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.3, ease: "easeOut" }
      },
      focus: {
        scale: 1.01,
        transition: { duration: 0.2, ease: "easeOut" }
      },
      error: {
        x: [-4, 4, -4, 4, 0],
        transition: { duration: 0.4, ease: "easeInOut" }
      }
    },
    {
      // Mobile - reduce scale effects
      initial: { opacity: 0, y: 5 },
      animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.2, ease: "easeOut" }
      },
      focus: {
        transition: { duration: 0.15, ease: "easeOut" }
      },
      error: {
        x: [-2, 2, -2, 2, 0],
        transition: { duration: 0.3, ease: "easeInOut" }
      }
    }
  ),

  // Button interactions
  button: createResponsiveVariants(
    {
      whileHover: { scale: 1.02, y: -1 },
      whileTap: { scale: 0.98 },
      transition: { duration: 0.2, ease: "easeOut" }
    },
    {
      // Mobile - minimal scale effects
      whileHover: { scale: 1.01 },
      whileTap: { scale: 0.99 },
      transition: { duration: 0.1, ease: "easeOut" }
    }
  ),

  // Loading states
  loading: createResponsiveVariants(
    {
      initial: { opacity: 0, scale: 0.9 },
      animate: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.3, ease: "easeOut" }
      },
      exit: {
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.2, ease: "easeIn" }
      }
    }
  ),

  // Success animations
  success: createResponsiveVariants(
    {
      initial: { scale: 0, opacity: 0, rotate: -90 },
      animate: {
        scale: 1,
        opacity: 1,
        rotate: 0,
        transition: { duration: 0.4, ease: "backOut" }
      }
    },
    {
      // Mobile - simpler success animation
      initial: { scale: 0.8, opacity: 0 },
      animate: {
        scale: 1,
        opacity: 1,
        transition: { duration: 0.2, ease: "easeOut" }
      }
    }
  ),

  // Progress animations
  progress: {
    initial: { width: "0%" },
    animate: (progress: number) => ({
      width: `${progress}%`,
      transition: {
        duration: 0.8,
        ease: "easeInOut",
        delay: 0.1
      }
    })
  },

  // Card animations
  card: createResponsiveVariants(
    {
      initial: { opacity: 0, y: 20, scale: 0.95 },
      animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.3, ease: "easeOut" }
      },
      hover: {
        y: -4,
        scale: 1.02,
        boxShadow: "0 12px 24px rgba(0, 0, 0, 0.15)",
        transition: { duration: 0.2, ease: "easeOut" }
      }
    },
    {
      // Mobile - minimal hover effects
      initial: { opacity: 0, y: 10 },
      animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.2, ease: "easeOut" }
      },
      hover: {
        scale: 1.01,
        transition: { duration: 0.15, ease: "easeOut" }
      }
    }
  )
};

// Create stagger animations for lists
export const createStaggerVariants = (
  itemVariants: Variants,
  staggerDelay: number = 0.1
): Variants => {
  const config = getAnimationConfig();
  const adjustedDelay = config.mobile.shortenDurations ? staggerDelay * 0.5 : staggerDelay;

  return {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: adjustedDelay,
        delayChildren: 0.1
      }
    }
  };
};

// Performance optimized animation props
export const getOptimizedAnimationProps = () => {
  const config = getAnimationConfig();

  return {
    // Reduce motion for accessibility
    initial: config.mobile.reducedMotion ? false : "initial",
    animate: "animate",
    exit: config.mobile.reducedMotion ? false : "exit",

    // Performance optimizations
    style: {
      willChange: 'transform, opacity',
    },

    // Disable animations on low-performance devices
    transition: config.mobile.shortenDurations ? { duration: 0.1 } : undefined
  };
};

// Create responsive transition configs
export const createResponsiveTransition = (
  desktopTransition: any,
  mobileTransition?: any
) => {
  const config = getAnimationConfig();
  const transition = config.mobile.preferFade && mobileTransition ? mobileTransition : desktopTransition;

  // Scale down durations for low-performance devices
  if (config.mobile.shortenDurations && transition.duration) {
    transition.duration *= 0.5;
  }

  return transition;
};

// Utility to check if animations should be disabled
export const shouldDisableAnimations = (): boolean => {
  const config = getAnimationConfig();
  return config.mobile.reducedMotion;
};

// Custom hook for responsive animations
export const useResponsiveAnimation = () => {
  const config = getAnimationConfig();

  return {
    config,
    variants: standardVariants,
    shouldDisableAnimations: shouldDisableAnimations(),
    createStagger: createStaggerVariants,
    getOptimizedProps: getOptimizedAnimationProps
  };
};

// Animation performance monitoring
export const trackAnimationPerformance = (animationName: string, startTime: number) => {
  const endTime = performance.now();
  const duration = endTime - startTime;

  // Log slow animations for optimization
  if (duration > 16.67) { // More than one frame at 60fps
    console.warn(`Slow animation detected: ${animationName} took ${duration.toFixed(2)}ms`);
  }

  return duration;
};

// Presets for common animation patterns
export const animationPresets = {
  // Fast micro-interactions
  micro: createResponsiveTransition(
    { duration: 0.15, ease: "easeOut" },
    { duration: 0.1, ease: "easeOut" }
  ),

  // Standard UI transitions
  standard: createResponsiveTransition(
    { duration: 0.3, ease: "easeOut" },
    { duration: 0.2, ease: "easeOut" }
  ),

  // Emphasis animations
  emphasis: createResponsiveTransition(
    { duration: 0.4, ease: "backOut" },
    { duration: 0.25, ease: "easeOut" }
  ),

  // Page transitions
  page: createResponsiveTransition(
    { duration: 0.5, ease: "easeInOut" },
    { duration: 0.3, ease: "easeOut" }
  )
};

export default {
  config: getAnimationConfig(),
  variants: standardVariants,
  presets: animationPresets,
  utils: {
    shouldDisableAnimations,
    trackAnimationPerformance,
    createStaggerVariants,
    createResponsiveVariants,
    getOptimizedAnimationProps
  }
};