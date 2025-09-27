import React from 'react';
import {
  PrimaryButton,
  DefaultButton,
  Stack,
  Spinner,
  SpinnerSize,
  Icon,
  Text
} from '@fluentui/react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingNavigationProps {
  currentStep: number;
  totalSteps: number;
  isLoading: boolean;
  isValid: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  backLabel?: string;
  skipLabel?: string;
  showSkip?: boolean;
}

const OnboardingNavigation: React.FC<OnboardingNavigationProps> = ({
  currentStep,
  totalSteps,
  isLoading,
  isValid,
  canGoBack,
  canGoNext,
  onNext,
  onBack,
  onSkip,
  nextLabel,
  backLabel = 'Back',
  skipLabel = 'Skip this step',
  showSkip = false
}) => {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  const getNextLabel = () => {
    if (nextLabel) return nextLabel;
    if (isLastStep) return 'Complete Onboarding';
    return 'Continue';
  };

  const getNextIcon = () => {
    if (isLastStep) return 'CheckMark';
    return 'ChevronRight';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-white border-t border-gray-200 p-6"
    >
      <div className="flex items-center justify-between">
        {/* Left side - Back button and skip */}
        <div className="flex items-center space-x-3">
          <AnimatePresence>
            {canGoBack && !isFirstStep && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <DefaultButton
                  text={backLabel}
                  iconProps={{ iconName: 'ChevronLeft' }}
                  onClick={onBack}
                  disabled={isLoading}
                  styles={{
                    root: {
                      minWidth: 100,
                      transition: 'all 0.2s ease',
                    },
                    rootHovered: {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }
                  }}
                />
              </motion.div>
            )}

            {showSkip && onSkip && !isLastStep && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <DefaultButton
                  text={skipLabel}
                  iconProps={{ iconName: 'Skip' }}
                  onClick={onSkip}
                  disabled={isLoading}
                  styles={{
                    root: {
                      color: '#666',
                      border: 'none',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease'
                    },
                    rootHovered: {
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      color: '#333'
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center - Progress info (on mobile) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="hidden sm:flex items-center space-x-2 text-sm text-gray-500"
        >
          <Text variant="small">
            Step {currentStep} of {totalSteps}
          </Text>
        </motion.div>

        {/* Right side - Next/Complete button */}
        <div className="flex items-center space-x-3">
          {/* Validation status with shake animation */}
          <AnimatePresence>
            {!isValid && !isLoading && (
              <motion.div
                initial={{ opacity: 0, x: 10, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  // Shake animation for attention
                  x: [0, -4, 4, -4, 4, 0]
                }}
                exit={{ opacity: 0, x: 10, scale: 0.9 }}
                transition={{
                  duration: 0.3,
                  x: { duration: 0.6, ease: "easeInOut" }
                }}
                className="flex items-center space-x-2 text-orange-600"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Icon iconName="Warning" styles={{ root: { fontSize: 14 } }} />
                </motion.div>
                <Text variant="small">Please complete required fields</Text>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <PrimaryButton
              text={isLoading ? undefined : getNextLabel()}
              iconProps={!isLoading ? { iconName: getNextIcon() } : undefined}
              onClick={onNext}
              disabled={!canGoNext || isLoading || !isValid}
              styles={{
                root: {
                  minWidth: isLastStep ? 180 : 120,
                  backgroundColor: isLastStep ? '#10b981' : undefined,
                  borderColor: isLastStep ? '#10b981' : undefined,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                },
                rootHovered: {
                  backgroundColor: isLastStep ? '#059669' : undefined,
                  borderColor: isLastStep ? '#059669' : undefined,
                  transform: 'translateY(-1px)',
                  boxShadow: isLastStep ? '0 8px 24px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(37, 99, 235, 0.3)'
                },
                rootPressed: {
                  backgroundColor: isLastStep ? '#047857' : undefined,
                  borderColor: isLastStep ? '#047857' : undefined,
                  transform: 'translateY(0)',
                }
              }}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center space-x-2"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Spinner size={SpinnerSize.small} />
                    </motion.div>
                    <span>Saving...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="button-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center space-x-2"
                  >
                    {isLastStep && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1, ease: "backOut" }}
                      >
                        <Icon iconName={getNextIcon()} />
                      </motion.div>
                    )}
                    <span>{getNextLabel()}</span>
                    {!isLastStep && (
                      <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                      >
                        <Icon iconName={getNextIcon()} />
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </PrimaryButton>
          </motion.div>
        </div>
      </div>

      {/* Mobile progress bar */}
      <div className="sm:hidden mt-4">
        <div className="flex justify-center">
          <Text variant="small" className="text-gray-500">
            Step {currentStep} of {totalSteps}
          </Text>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Save reminder */}
      {!isLoading && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-500">
          <Icon iconName="Save" styles={{ root: { fontSize: 12 } }} />
          <Text variant="small">Your progress is automatically saved</Text>
        </div>
      )}
    </motion.div>
  );
};

export default OnboardingNavigation;