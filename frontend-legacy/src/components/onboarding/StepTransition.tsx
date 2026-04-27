import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StepTransitionProps {
  children: React.ReactNode;
  currentStep: number;
  isLoading?: boolean;
  className?: string;
}

// Define animation variants for step transitions
const stepVariants = {
  enter: {
    opacity: 0,
    x: 100,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    x: -100,
    transition: {
      duration: 0.3,
      ease: "easeIn"
    }
  }
};

// Mobile-optimized variants (use fade instead of slide)
const mobileVariants = {
  enter: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  center: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeIn"
    }
  }
};

// Loading state variants
const loadingVariants = {
  enter: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  center: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    transition: {
      duration: 0.15,
      ease: "easeIn"
    }
  }
};

const StepTransition: React.FC<StepTransitionProps> = ({
  children,
  currentStep,
  isLoading = false,
  className = ''
}) => {
  // Memoize device and preference detection to avoid repeated DOM queries
  const isMobile = React.useMemo(() => window.innerWidth < 768, []);
  const prefersReducedMotion = React.useMemo(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  // Memoize variants to prevent re-creation on every render
  const variants = React.useMemo(() => {
    if (prefersReducedMotion) {
      return {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 }
      };
    }

    if (isLoading) return loadingVariants;
    if (isMobile) return mobileVariants;
    return stepVariants;
  }, [prefersReducedMotion, isLoading, isMobile]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={currentStep}
        initial="enter"
        animate="center"
        exit="exit"
        variants={variants}
        className={`w-full ${className}`}
        style={{
          // Optimize for performance and fix animation warnings
          willChange: 'transform, opacity',
          backgroundColor: 'rgba(0, 0, 0, 0)',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default StepTransition;