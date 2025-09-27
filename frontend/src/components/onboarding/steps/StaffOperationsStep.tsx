import React from 'react';
import {
  TextField,
  Dropdown,
  Stack,
  Text,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Slider,
  SpinButton,
  ISpinButtonStyles
} from '@fluentui/react';
import type {
  OnboardingWizardData,
  StaffOperationsData,
  ValidationError
} from '../../../types/onboarding';
import { StaffSizeRange } from '../../../types/onboarding';

interface StaffOperationsStepProps {
  data: Partial<OnboardingWizardData>;
  onChange: (data: Partial<OnboardingWizardData>) => void;
  errors: ValidationError[];
  isLoading: boolean;
}

const StaffOperationsStep: React.FC<StaffOperationsStepProps> = ({
  data,
  onChange,
  errors,
  isLoading
}) => {
  const staffOps = data.staffOperations || {} as StaffOperationsData;

  const updateStaffOps = (updates: Partial<StaffOperationsData>) => {
    onChange({
      staffOperations: { ...staffOps, ...updates }
    });
  };

  const updateCapacity = (updates: Partial<StaffOperationsData['operationalCapacity']>) => {
    updateStaffOps({
      operationalCapacity: { ...staffOps.operationalCapacity, ...updates }
    });
  };

  const updateGrowth = (updates: Partial<StaffOperationsData['expectedGrowth']>) => {
    updateStaffOps({
      expectedGrowth: { ...staffOps.expectedGrowth, ...updates }
    });
  };

  const getFieldError = (fieldName: string): string | undefined => {
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  };

  // Staff size options
  const staffSizeOptions: IDropdownOption[] = [
    { key: StaffSizeRange.SMALL, text: '1-10 staff members', data: { capacity: 5 } },
    { key: StaffSizeRange.MEDIUM, text: '11-50 staff members', data: { capacity: 25 } },
    { key: StaffSizeRange.LARGE, text: '51-200 staff members', data: { capacity: 100 } },
    { key: StaffSizeRange.ENTERPRISE, text: '200+ staff members', data: { capacity: 500 } }
  ];

  const spinButtonStyles: Partial<ISpinButtonStyles> = {
    root: { width: '100%', maxWidth: 200 }
  };

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <MessageBar messageBarType={MessageBarType.info}>
        Configure your staff operations and capacity. This helps us optimize the system for your
        organizational size and operational requirements.
      </MessageBar>

      {/* Current Staff Size */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Current Staff Size
        </Text>

        <Stack tokens={{ childrenGap: 20 }}>
          <Dropdown
            label="Current Staff Size *"
            selectedKey={staffOps.staffSize}
            options={staffSizeOptions}
            onChange={(_, option) => {
              updateStaffOps({ staffSize: option?.key as StaffSizeRange });
              // Auto-set capacity based on staff size
              const capacity = option?.data?.capacity || 1;
              updateCapacity({
                maxConcurrentShifts: Math.max(1, Math.floor(capacity * 0.3)),
                peakHoursCapacity: Math.max(1, Math.floor(capacity * 0.5)),
                emergencyStaffing: Math.max(1, Math.floor(capacity * 0.2)),
                specialEventCapacity: Math.max(1, Math.floor(capacity * 0.4))
              });
            }}
            errorMessage={getFieldError('staffSize')}
            disabled={isLoading}
            required
          />
        </Stack>
      </div>

      {/* Growth Projections */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Growth Projections
        </Text>

        <Text variant="medium" className="text-gray-600 mb-4">
          Help us plan capacity for your expected growth.
        </Text>

        <Stack tokens={{ childrenGap: 20 }}>
          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <div className="flex-1">
              <Text variant="medium" className="mb-2 block">
                Expected Staff in 6 Months
              </Text>
              <SpinButton
                value={staffOps.expectedGrowth?.sixMonths?.toString() || '0'}
                onValidate={(value) => {
                  const numValue = parseInt(value) || 0;
                  updateGrowth({ sixMonths: numValue });
                  return numValue.toString();
                }}
                onIncrement={(value) => {
                  const numValue = (parseInt(value) || 0) + 5;
                  updateGrowth({ sixMonths: numValue });
                  return numValue.toString();
                }}
                onDecrement={(value) => {
                  const numValue = Math.max(0, (parseInt(value) || 0) - 5);
                  updateGrowth({ sixMonths: numValue });
                  return numValue.toString();
                }}
                min={0}
                max={1000}
                step={5}
                styles={spinButtonStyles}
                disabled={isLoading}
              />
            </div>

            <div className="flex-1">
              <Text variant="medium" className="mb-2 block">
                Expected Staff in 1 Year
              </Text>
              <SpinButton
                value={staffOps.expectedGrowth?.oneYear?.toString() || '0'}
                onValidate={(value) => {
                  const numValue = parseInt(value) || 0;
                  updateGrowth({ oneYear: numValue });
                  return numValue.toString();
                }}
                onIncrement={(value) => {
                  const numValue = (parseInt(value) || 0) + 10;
                  updateGrowth({ oneYear: numValue });
                  return numValue.toString();
                }}
                onDecrement={(value) => {
                  const numValue = Math.max(0, (parseInt(value) || 0) - 10);
                  updateGrowth({ oneYear: numValue });
                  return numValue.toString();
                }}
                min={0}
                max={2000}
                step={10}
                styles={spinButtonStyles}
                disabled={isLoading}
              />
            </div>

            <div className="flex-1">
              <Text variant="medium" className="mb-2 block">
                Expected Staff in 2 Years
              </Text>
              <SpinButton
                value={staffOps.expectedGrowth?.twoYears?.toString() || '0'}
                onValidate={(value) => {
                  const numValue = parseInt(value) || 0;
                  updateGrowth({ twoYears: numValue });
                  return numValue.toString();
                }}
                onIncrement={(value) => {
                  const numValue = (parseInt(value) || 0) + 20;
                  updateGrowth({ twoYears: numValue });
                  return numValue.toString();
                }}
                onDecrement={(value) => {
                  const numValue = Math.max(0, (parseInt(value) || 0) - 20);
                  updateGrowth({ twoYears: numValue });
                  return numValue.toString();
                }}
                min={0}
                max={5000}
                step={20}
                styles={spinButtonStyles}
                disabled={isLoading}
              />
            </div>
          </Stack>
        </Stack>
      </div>

      {/* Operational Capacity */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Operational Capacity
        </Text>

        <Text variant="medium" className="text-gray-600 mb-4">
          Define your operational capacity requirements.
        </Text>

        <Stack tokens={{ childrenGap: 24 }}>
          <div>
            <Text variant="medium" className="mb-3 block">
              Maximum Concurrent Shifts: {staffOps.operationalCapacity?.maxConcurrentShifts || 1}
            </Text>
            <Slider
              min={1}
              max={100}
              value={staffOps.operationalCapacity?.maxConcurrentShifts || 1}
              onChange={(value) => updateCapacity({ maxConcurrentShifts: value })}
              showValue={false}
              disabled={isLoading}
              styles={{
                root: { maxWidth: 400 }
              }}
            />
            <Text variant="small" className="text-gray-500 mt-1">
              How many shifts can run simultaneously?
            </Text>
          </div>

          <div>
            <Text variant="medium" className="mb-3 block">
              Peak Hours Capacity: {staffOps.operationalCapacity?.peakHoursCapacity || 1}
            </Text>
            <Slider
              min={1}
              max={200}
              value={staffOps.operationalCapacity?.peakHoursCapacity || 1}
              onChange={(value) => updateCapacity({ peakHoursCapacity: value })}
              showValue={false}
              disabled={isLoading}
              styles={{
                root: { maxWidth: 400 }
              }}
            />
            <Text variant="small" className="text-gray-500 mt-1">
              Staff capacity during peak operational hours
            </Text>
          </div>

          <div>
            <Text variant="medium" className="mb-3 block">
              Emergency Staffing: {staffOps.operationalCapacity?.emergencyStaffing || 1}
            </Text>
            <Slider
              min={1}
              max={50}
              value={staffOps.operationalCapacity?.emergencyStaffing || 1}
              onChange={(value) => updateCapacity({ emergencyStaffing: value })}
              showValue={false}
              disabled={isLoading}
              styles={{
                root: { maxWidth: 400 }
              }}
            />
            <Text variant="small" className="text-gray-500 mt-1">
              Staff available for emergency call-outs
            </Text>
          </div>

          <div>
            <Text variant="medium" className="mb-3 block">
              Special Event Capacity: {staffOps.operationalCapacity?.specialEventCapacity || 1}
            </Text>
            <Slider
              min={1}
              max={500}
              value={staffOps.operationalCapacity?.specialEventCapacity || 1}
              onChange={(value) => updateCapacity({ specialEventCapacity: value })}
              showValue={false}
              disabled={isLoading}
              styles={{
                root: { maxWidth: 400 }
              }}
            />
            <Text variant="small" className="text-gray-500 mt-1">
              Maximum staff for special events and large-scale operations
            </Text>
          </div>
        </Stack>
      </div>

      {/* Operations Summary */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Operations Summary
        </Text>

        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Text variant="mediumPlus" className="font-semibold mb-2">
                Current Configuration
              </Text>
              <ul className="space-y-1 text-sm">
                <li>Staff Size: {staffOps.staffSize?.replace('_', ' ').toUpperCase()}</li>
                <li>Max Concurrent Shifts: {staffOps.operationalCapacity?.maxConcurrentShifts || 'Not set'}</li>
                <li>Peak Capacity: {staffOps.operationalCapacity?.peakHoursCapacity || 'Not set'}</li>
                <li>Emergency Staff: {staffOps.operationalCapacity?.emergencyStaffing || 'Not set'}</li>
              </ul>
            </div>
            <div>
              <Text variant="mediumPlus" className="font-semibold mb-2">
                Growth Projections
              </Text>
              <ul className="space-y-1 text-sm">
                <li>6 Months: {staffOps.expectedGrowth?.sixMonths || 0} staff</li>
                <li>1 Year: {staffOps.expectedGrowth?.oneYear || 0} staff</li>
                <li>2 Years: {staffOps.expectedGrowth?.twoYears || 0} staff</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Capacity Planning Note */}
      <MessageBar messageBarType={MessageBarType.warning}>
        <strong>Note:</strong> These settings will be used to configure system limits, scheduling
        algorithms, and resource allocation. You can adjust them later in system settings.
      </MessageBar>
    </div>
  );
};

export default StaffOperationsStep;