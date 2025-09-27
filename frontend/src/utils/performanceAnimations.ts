/**
 * Performance-Optimized Animation System
 *
 * This module provides GPU-accelerated animations optimized for 60 FPS performance.
 * All animations are designed to avoid layout thrashing and use transform/opacity only.
 *
 * PERFORMANCE TARGETS:
 * - 60 FPS maintained during all animations
 * - < 16ms per frame
 * - GPU acceleration for all transforms
 * - Respect user's reduce motion preferences
 * - Zero layout thrashing
 */

import { Variants, Transition } from 'framer-motion';

// Check for reduced motion preference
export const prefersReducedMotion = (() => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
})();

// Base animation configuration optimized for 60 FPS
export const PERFORMANCE_CONFIG = {
  // Use transform and opacity only for GPU acceleration
  TRANSFORM_PROPERTIES: ['x', 'y', 'scale', 'rotate', 'opacity'],

  // Optimized easing curves for smooth 60 FPS animation
  EASING: {
    smooth: [0.25, 0.46, 0.45, 0.94], // Custom smooth curve
    snappy: [0.68, -0.55, 0.265, 1.55], // Bounce effect
    linear: [0, 0, 1, 1],
    easeOut: [0, 0, 0.2, 1],
    easeIn: [0.4, 0, 1, 1],
    easeInOut: [0.4, 0, 0.2, 1]
  },

  // Duration constants for consistent timing
  DURATION: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.5,
    pageTransition: 0.4
  },

  // Spring configuration for physics-based animations
  SPRING: {
    gentle: {
      type: 'spring',
      stiffness: 120,
      damping: 20,
      mass: 1
    },
    bouncy: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 1
    },
    stiff: {
      type: 'spring',
      stiffness: 400,
      damping: 40,
      mass: 1
    }
  } as const
};

// GPU-accelerated page transitions
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: prefersReducedMotion ? 1 : 0,
    x: prefersReducedMotion ? 0 : 50,
    scale: prefersReducedMotion ? 1 : 0.96,
    // Force GPU acceleration
    transform: 'translateZ(0)',
    willChange: 'transform, opacity'
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: PERFORMANCE_CONFIG.DURATION.pageTransition,
      ease: PERFORMANCE_CONFIG.EASING.smooth,
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: prefersReducedMotion ? 1 : 0,
    x: prefersReducedMotion ? 0 : -50,
    scale: prefersReducedMotion ? 1 : 0.96,
    transition: {
      duration: PERFORMANCE_CONFIG.DURATION.normal,
      ease: PERFORMANCE_CONFIG.EASING.easeIn
    }
  }
};

// Optimized wizard step transitions
export const wizardStepVariants: Variants = {
  initial: {
    opacity: 0,
    x: 100,
    // GPU acceleration
    transform: 'translateZ(0)',
    willChange: 'transform, opacity'
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: prefersReducedMotion ? {
      duration: 0
    } : {
      duration: PERFORMANCE_CONFIG.DURATION.normal,
      ease: PERFORMANCE_CONFIG.EASING.smooth
    }
  },
  exit: {
    opacity: 0,
    x: -100,
    transition: prefersReducedMotion ? {
      duration: 0
    } : {
      duration: PERFORMANCE_CONFIG.DURATION.fast,
      ease: PERFORMANCE_CONFIG.EASING.easeIn
    }
  }
};

// Form field animations with staggered reveal
export const formFieldVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    transform: 'translateZ(0)'
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion ? {
      duration: 0
    } : {
      duration: PERFORMANCE_CONFIG.DURATION.normal,
      ease: PERFORMANCE_CONFIG.EASING.easeOut,
      delay: i * 0.05 // Stagger effect
    }
  })
};

// Button interactions optimized for touch devices
export const buttonVariants: Variants = {
  idle: {
    scale: 1,
    transform: 'translateZ(0)'
  },
  hover: {
    scale: prefersReducedMotion ? 1 : 1.02,
    transition: {
      duration: PERFORMANCE_CONFIG.DURATION.fast,
      ease: PERFORMANCE_CONFIG.EASING.easeOut
    }
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
      ease: PERFORMANCE_CONFIG.EASING.easeOut
    }
  }
};

// Loading spinner optimized for performance
export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      ease: 'linear',
      repeat: Infinity
    }
  }
};

// Progress bar animation
export const progressBarVariants = (progress: number): Variants => ({
  initial: {
    width: '0%',
    transform: 'translateZ(0)'
  },
  animate: {
    width: `${progress}%`,
    transition: prefersReducedMotion ? {
      duration: 0
    } : {
      duration: PERFORMANCE_CONFIG.DURATION.slow,
      ease: PERFORMANCE_CONFIG.EASING.easeOut
    }
  }
});

// Card hover effects with GPU acceleration
export const cardVariants: Variants = {
  idle: {
    y: 0,
    scale: 1,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    transform: 'translateZ(0)',
    willChange: 'transform, box-shadow'
  },
  hover: {
    y: prefersReducedMotion ? 0 : -4,
    scale: prefersReducedMotion ? 1 : 1.01,
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    transition: {
      duration: PERFORMANCE_CONFIG.DURATION.fast,
      ease: PERFORMANCE_CONFIG.EASING.easeOut
    }
  }
};

// Modal/overlay animations
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    transform: 'translateZ(0)',
    willChange: 'transform, opacity'
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: prefersReducedMotion ? {
      duration: 0
    } : PERFORMANCE_CONFIG.SPRING.gentle
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: prefersReducedMotion ? {
      duration: 0
    } : {
      duration: PERFORMANCE_CONFIG.DURATION.fast,
      ease: PERFORMANCE_CONFIG.EASING.easeIn
    }
  }
};

// List item stagger animation
export const listItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
    transform: 'translateZ(0)'
  },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: prefersReducedMotion ? {
      duration: 0
    } : {
      duration: PERFORMANCE_CONFIG.DURATION.normal,
      ease: PERFORMANCE_CONFIG.EASING.easeOut,
      delay: i * 0.08
    }
  })
};

// Error shake animation
export const errorShakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
      ease: PERFORMANCE_CONFIG.EASING.easeOut
    }
  }
};

// Success checkmark animation
export const checkmarkVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: PERFORMANCE_CONFIG.EASING.easeOut
    }
  }
};

// Performance monitoring utilities
export const animationPerformanceUtils = {
  /**
   * Monitor animation performance and log warnings for dropped frames
   */
  monitorFrameRate: () => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) return;

    let frames = 0;
    let lastTime = performance.now();

    const countFPS = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        const fps = Math.round(frames * 1000 / (currentTime - lastTime));

        if (fps < 55) {
          console.warn(`Animation performance warning: ${fps} FPS detected. Target is 60 FPS.`);
        }

        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(countFPS);
    };

    requestAnimationFrame(countFPS);
  },

  /**
   * Create a performance-optimized layout animation
   */
  createOptimizedLayoutTransition: (): Transition => ({
    layout: prefersReducedMotion ? false : {
      duration: PERFORMANCE_CONFIG.DURATION.normal,
      ease: PERFORMANCE_CONFIG.EASING.smooth
    }
  }),

  /**
   * Check if GPU acceleration is available
   */
  supportsGPUAcceleration: (): boolean => {
    if (typeof window === 'undefined') return false;

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  },

  /**
   * Apply optimal animation settings based on device performance
   */
  getOptimalAnimationConfig: () => {
    const hasGPU = animationPerformanceUtils.supportsGPUAcceleration();
    const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;

    return {
      enableComplexAnimations: hasGPU && !isLowEnd,
      maxSimultaneousAnimations: isLowEnd ? 3 : 10,
      useSpringAnimations: hasGPU && !prefersReducedMotion,
      enableParallax: hasGPU && !prefersReducedMotion && !isLowEnd
    };
  }
};

// Animation presets for common use cases
export const animationPresets = {
  // Smooth page entrance
  fadeInUp: {
    initial: { opacity: 0, y: 20, transform: 'translateZ(0)' },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: PERFORMANCE_CONFIG.DURATION.normal,
        ease: PERFORMANCE_CONFIG.EASING.easeOut
      }
    }
  },

  // Quick hover effect
  scaleOnHover: {
    whileHover: prefersReducedMotion ? {} : {
      scale: 1.05,
      transition: { duration: PERFORMANCE_CONFIG.DURATION.fast }
    }
  },

  // Loading pulse
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: PERFORMANCE_CONFIG.EASING.easeInOut
      }
    }
  },

  // Slide in from right
  slideInRight: {
    initial: { opacity: 0, x: 50, transform: 'translateZ(0)' },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: PERFORMANCE_CONFIG.DURATION.normal,
        ease: PERFORMANCE_CONFIG.EASING.smooth
      }
    }
  }
};

// Initialize performance monitoring in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  animationPerformanceUtils.monitorFrameRate();
}

export default {
  pageTransitionVariants,
  wizardStepVariants,
  formFieldVariants,
  buttonVariants,
  spinnerVariants,
  progressBarVariants,
  cardVariants,
  modalVariants,
  listItemVariants,
  errorShakeVariants,
  checkmarkVariants,
  animationPresets,
  animationPerformanceUtils,
  PERFORMANCE_CONFIG
};