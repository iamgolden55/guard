import React from 'react';
import { Text, Icon, Stack, useTheme } from '@fluentui/react';

interface OnboardingHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  stepNumber: number;
  totalSteps: number;
  icon?: string;
}

const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({
  title,
  subtitle,
  description,
  stepNumber,
  totalSteps,
  icon
}) => {
  const theme = useTheme();

  return (
    <div className="mb-8">
      {/* Step indicator */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Step {stepNumber} of {totalSteps}
        </div>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Header content */}
      <Stack horizontal verticalAlign="start" tokens={{ childrenGap: 16 }}>
        {/* Icon */}
        {icon && (
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full flex-shrink-0"
            style={{ backgroundColor: theme.palette.themeLighterAlt }}
          >
            <Icon
              iconName={icon}
              styles={{
                root: {
                  fontSize: 24,
                  color: theme.palette.themePrimary
                }
              }}
            />
          </div>
        )}

        {/* Text content */}
        <div className="flex-1">
          <Text
            as="h1"
            variant="xxLarge"
            className="font-bold text-gray-900 mb-2"
            styles={{
              root: {
                fontWeight: 600,
                lineHeight: 1.2
              }
            }}
          >
            {title}
          </Text>

          {subtitle && (
            <Text
              variant="large"
              className="text-gray-600 mb-3"
              styles={{
                root: {
                  fontWeight: 400,
                  lineHeight: 1.4
                }
              }}
            >
              {subtitle}
            </Text>
          )}

          {description && (
            <Text
              variant="medium"
              className="text-gray-500 max-w-3xl"
              styles={{
                root: {
                  lineHeight: 1.5
                }
              }}
            >
              {description}
            </Text>
          )}
        </div>
      </Stack>

      {/* Divider */}
      <div className="mt-6 border-t border-gray-200" />
    </div>
  );
};

export default OnboardingHeader;