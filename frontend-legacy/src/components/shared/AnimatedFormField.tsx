import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TextField, ITextFieldProps, Icon, useTheme } from '@fluentui/react';

interface AnimatedFormFieldProps extends ITextFieldProps {
  error?: string;
  showValidation?: boolean;
  animateOnMount?: boolean;
  children?: React.ReactNode;
}

// Animation variants for form fields
const fieldVariants = {
  initial: {
    opacity: 0,
    y: 10,
    scale: 0.98
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  focus: {
    scale: 1.01,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  error: {
    x: [-4, 4, -4, 4, 0],
    transition: {
      duration: 0.4,
      ease: "easeInOut"
    }
  }
};

// Success animation for valid fields
const successVariants = {
  initial: { scale: 0, opacity: 0, rotate: -90 },
  animate: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      duration: 0.3,
      ease: "backOut"
    }
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

// Error animation for invalid fields
const errorVariants = {
  initial: { opacity: 0, y: -10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.15
    }
  }
};

const AnimatedFormField: React.FC<AnimatedFormFieldProps> = ({
  error,
  showValidation = true,
  animateOnMount = true,
  children,
  onFocus,
  onBlur,
  ...textFieldProps
}) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const hasError = Boolean(error && hasInteracted);
  const hasValue = Boolean(textFieldProps.value || textFieldProps.defaultValue);
  const isValid = hasInteracted && hasValue && !error;

  const handleFocus = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIsFocused(true);
    setHasInteracted(true);
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  // Generate dynamic styles based on state
  const getFieldStyles = () => {
    const baseStyles = {
      fieldGroup: {
        transition: 'all 0.2s ease',
        position: 'relative' as const,
        '&:hover': {
          borderColor: theme.palette.themePrimary,
          boxShadow: `0 0 0 1px ${theme.palette.themePrimary}20`,
        }
      },
      field: {
        transition: 'all 0.2s ease'
      }
    };

    if (isFocused) {
      return {
        ...baseStyles,
        fieldGroup: {
          ...baseStyles.fieldGroup,
          borderColor: theme.palette.themePrimary,
          boxShadow: `0 0 0 2px ${theme.palette.themePrimary}40, 0 4px 12px rgba(0, 0, 0, 0.1)`,
          transform: 'translateY(-1px)',
        }
      };
    }

    if (hasError) {
      return {
        ...baseStyles,
        fieldGroup: {
          ...baseStyles.fieldGroup,
          borderColor: theme.palette.red,
          boxShadow: `0 0 0 1px ${theme.palette.red}40`,
          backgroundColor: `${theme.palette.red}08`,
        }
      };
    }

    if (isValid) {
      return {
        ...baseStyles,
        fieldGroup: {
          ...baseStyles.fieldGroup,
          borderColor: theme.palette.green,
          boxShadow: `0 0 0 1px ${theme.palette.green}40`,
        }
      };
    }

    return baseStyles;
  };

  return (
    <motion.div
      variants={fieldVariants}
      initial={animateOnMount ? "initial" : false}
      animate={hasError ? "error" : isFocused ? "focus" : "animate"}
      className="relative"
    >
      {children || (
        <div className="relative">
          <TextField
            {...textFieldProps}
            onFocus={handleFocus}
            onBlur={handleBlur}
            styles={getFieldStyles()}
          />

          {/* Success indicator */}
          <AnimatePresence>
            {isValid && showValidation && (
              <motion.div
                variants={successVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute top-1/2 right-3 -translate-y-1/2 z-10"
              >
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <motion.svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M20 6L9 17l-5-5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                    />
                  </motion.svg>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating label animation */}
          {textFieldProps.placeholder && hasValue && (
            <motion.div
              initial={{ opacity: 0, y: 0, scale: 1 }}
              animate={{
                opacity: 1,
                y: -28,
                scale: 0.85,
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-3 top-3 pointer-events-none bg-white px-1 text-gray-600 text-sm"
              style={{ color: isFocused ? theme.palette.themePrimary : theme.palette.neutralSecondary }}
            >
              {textFieldProps.placeholder}
            </motion.div>
          )}
        </div>
      )}

      {/* Error message with animation */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            variants={errorVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex items-center mt-2 text-red-600 text-sm"
          >
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, -5, 5, -5, 5, 0] }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="mr-2"
            >
              <Icon iconName="ErrorBadge" styles={{ root: { fontSize: 14 } }} />
            </motion.div>
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus glow effect */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.6, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 -z-10 bg-blue-400 rounded-lg blur-xl"
            style={{ opacity: 0.1 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnimatedFormField;