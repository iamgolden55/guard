import React from 'react';
import { Stack, Text, ProgressIndicator, Icon, useTheme } from '@fluentui/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WizardStep } from '../../types/onboarding';

interface OnboardingProgressProps {
  steps: WizardStep[];
  currentStep: number;
  completedSteps: number[];
  className?: string;
}

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  steps,
  currentStep,
  completedSteps,
  className = ''
}) => {
  const theme = useTheme();

  const getStepStatus = (stepId: number) => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (stepId === currentStep) return 'active';
    if (stepId < currentStep) return 'available';
    return 'inactive';
  };

  const getStepIcon = (stepId: number) => {
    const status = getStepStatus(stepId);

    switch (status) {
      case 'completed':
        return 'CheckMark';
      case 'active':
        return 'Edit';
      default:
        return 'Circle';
    }
  };

  const getStepColor = (stepId: number) => {
    const status = getStepStatus(stepId);

    switch (status) {
      case 'completed':
        return theme.palette.green;
      case 'active':
        return theme.palette.themePrimary;
      case 'available':
        return theme.palette.neutralSecondary;
      default:
        return theme.palette.neutralTertiary;
    }
  };

  const progressPercentage = (completedSteps.length / steps.length) * 100;

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <Text variant="mediumPlus" className="font-semibold">
            Onboarding Progress
          </Text>
          <motion.div
            key={`${completedSteps.length}-${steps.length}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Text variant="medium" className="text-gray-600">
              {completedSteps.length} of {steps.length} completed
            </Text>
          </motion.div>
        </div>

        {/* Custom animated progress bar */}
        <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{
              duration: 0.8,
              ease: "easeInOut",
              delay: 0.1
            }}
          />

          {/* Shimmer effect */}
          <motion.div
            className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            initial={{ x: -32 }}
            animate={{ x: "100%" }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2,
              ease: "linear"
            }}
          />
        </div>

        <motion.div
          key={progressPercentage}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Text variant="small" className="text-gray-500 mt-1">
            {Math.round(progressPercentage)}% complete
          </Text>
        </motion.div>
      </div>

      {/* Step indicators */}
      <Stack tokens={{ childrenGap: 12 }}>
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const status = getStepStatus(stepNumber);
          const color = getStepColor(stepNumber);
          const isActive = stepNumber === currentStep;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              className={`flex items-center space-x-4 p-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 border-l-4 border-blue-500 shadow-sm'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Step icon with animations */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: status === 'completed' ? '#10b981' : status === 'active' ? '#3b82f6' : 'transparent'
                }}
                transition={{ duration: 0.3 }}
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  status === 'completed'
                    ? 'bg-green-500 border-green-500'
                    : status === 'active'
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300'
                }`}
              >
                <AnimatePresence mode="wait">
                  {status === 'completed' ? (
                    <motion.div
                      key="completed"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 90 }}
                      transition={{ duration: 0.4, ease: "backOut" }}
                    >
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
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                        />
                      </motion.svg>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="icon"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Icon
                        iconName={getStepIcon(stepNumber)}
                        styles={{
                          root: {
                            fontSize: 12,
                            color: status === 'completed' || status === 'active' ? 'white' : color
                          }
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Step content */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <motion.div
                    animate={{
                      color: isActive ? '#1d4ed8' : status === 'completed' ? '#059669' : '#374151'
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <Text
                      variant="medium"
                      className={`font-medium ${
                        isActive ? 'text-blue-700' : status === 'completed' ? 'text-green-700' : 'text-gray-700'
                      }`}
                    >
                      Step {stepNumber}: {step.title}
                    </Text>
                  </motion.div>

                  {/* Animated status badges */}
                  <AnimatePresence>
                    {status === 'completed' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: 20 }}
                        transition={{ duration: 0.3, ease: "backOut" }}
                        className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full"
                      >
                        Complete
                      </motion.div>
                    )}
                    {status === 'active' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: 20 }}
                        transition={{ duration: 0.3, ease: "backOut" }}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                      >
                        <motion.div
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="flex items-center space-x-1"
                        >
                          <span>In Progress</span>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full"
                          />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {step.subtitle && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <Text variant="small" className="text-gray-600 mt-1">
                      {step.subtitle}
                    </Text>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </Stack>

      {/* Estimated completion time */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Icon iconName="Clock" styles={{ root: { color: theme.palette.neutralSecondary } }} />
          <Text variant="small" className="text-gray-600">
            Estimated time remaining: {Math.max(0, (steps.length - completedSteps.length) * 8)} minutes
          </Text>
        </div>
      </div>
    </div>
  );
};

export default OnboardingProgress;