import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  text?: string;
  show?: boolean;
  fullScreen?: boolean;
  className?: string;
}

const sizeMap = {
  small: { spinner: 16, text: 'text-sm' },
  medium: { spinner: 24, text: 'text-base' },
  large: { spinner: 32, text: 'text-lg' }
};

const colorMap = {
  primary: {
    spinner: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.1)',
    text: 'text-blue-600'
  },
  secondary: {
    spinner: '#6b7280',
    background: 'rgba(107, 114, 128, 0.1)',
    text: 'text-gray-600'
  },
  success: {
    spinner: '#10b981',
    background: 'rgba(16, 185, 129, 0.1)',
    text: 'text-green-600'
  },
  warning: {
    spinner: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.1)',
    text: 'text-yellow-600'
  },
  error: {
    spinner: '#ef4444',
    background: 'rgba(239, 68, 68, 0.1)',
    text: 'text-red-600'
  }
};

// Loading spinner animations
const spinnerVariants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Pulse animation for dots
const dotsVariants = {
  animate: {
    scale: [1, 1.2, 1],
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Container animation
const containerVariants = {
  initial: {
    opacity: 0,
    scale: 0.9
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.2,
      ease: "easeIn"
    }
  }
};

// Backdrop animation
const backdropVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  variant = 'primary',
  text,
  show = true,
  fullScreen = false,
  className = ''
}) => {
  const sizeConfig = sizeMap[size];
  const colorConfig = colorMap[variant];

  const SpinnerContent = () => (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      {/* Enhanced spinner with multiple rings */}
      <div className="relative">
        {/* Outer ring */}
        <motion.div
          variants={spinnerVariants}
          animate="animate"
          style={{
            width: sizeConfig.spinner * 1.5,
            height: sizeConfig.spinner * 1.5,
            border: `2px solid ${colorConfig.background}`,
            borderTop: `2px solid ${colorConfig.spinner}`,
            borderRadius: '50%'
          }}
        />

        {/* Inner ring - counter-rotating */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute inset-2"
          style={{
            border: `1px solid ${colorConfig.background}`,
            borderBottom: `1px solid ${colorConfig.spinner}`,
            borderRadius: '50%',
            opacity: 0.6
          }}
        />

        {/* Center pulse */}
        <motion.div
          animate={{
            scale: [0.8, 1.2, 0.8],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: sizeConfig.spinner * 0.3,
            height: sizeConfig.spinner * 0.3,
            backgroundColor: colorConfig.spinner,
            borderRadius: '50%'
          }}
        />
      </div>

      {/* Loading text with dots animation */}
      {text && (
        <div className={`${colorConfig.text} ${sizeConfig.text} font-medium flex items-center space-x-1`}>
          <span>{text}</span>
          <div className="flex space-x-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                variants={dotsVariants}
                animate="animate"
                transition={{
                  delay: index * 0.2
                }}
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: colorConfig.spinner }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Progress pulse effect */}
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colorConfig.spinner}20 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
      />
    </motion.div>
  );

  return (
    <AnimatePresence>
      {show && (
        <>
          {fullScreen ? (
            <>
              {/* Full screen backdrop */}
              <motion.div
                variants={backdropVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
              >
                <SpinnerContent />
              </motion.div>
            </>
          ) : (
            <SpinnerContent />
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default LoadingSpinner;

// Export additional spinner variants
export const SkeletonLoader: React.FC<{
  lines?: number;
  height?: number;
  className?: string;
}> = ({ lines = 3, height = 16, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <motion.div
        key={index}
        className="bg-gray-200 rounded"
        style={{ height }}
        animate={{
          opacity: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          delay: index * 0.2,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

// Progress ring component
export const ProgressRing: React.FC<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}> = ({ progress, size = 40, strokeWidth = 4, color = '#3b82f6', className = '' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeInOut" }}
          strokeLinecap="round"
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="text-xs font-semibold"
          style={{ color }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          {Math.round(progress)}%
        </motion.span>
      </div>
    </div>
  );
};