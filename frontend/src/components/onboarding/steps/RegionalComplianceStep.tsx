import React, { useState, useEffect } from 'react';
import {
  TextField,
  Dropdown,
  Stack,
  Text,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Checkbox,
  Spinner,
  SpinnerSize,
  IconButton,
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode
} from '@fluentui/react';
import type {
  OnboardingWizardData,
  RegionalComplianceData,
  ValidationError,
  Region,
  ComplianceProfile
} from '../../../types/onboarding';
import { DataProtectionLevel } from '../../../types/onboarding';
import onboardingService from '../../../services/onboardingService';

interface RegionalComplianceStepProps {
  data: Partial<OnboardingWizardData>;
  onChange: (data: Partial<OnboardingWizardData>) => void;
  errors: ValidationError[];
  isLoading: boolean;
}

const RegionalComplianceStep: React.FC<RegionalComplianceStepProps> = ({
  data,
  onChange,
  errors,
  isLoading
}) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [selectedRegionDetails, setSelectedRegionDetails] = useState<Region | null>(null);

  const complianceData = data.regionalCompliance || {} as RegionalComplianceData;

  // Load available regions on mount
  useEffect(() => {
    const loadRegions = async () => {
      setLoadingRegions(true);
      try {
        const availableRegions = await onboardingService.getAvailableRegions();
        setRegions(availableRegions);
      } catch (error) {
        console.error('Failed to load regions:', error);
      } finally {
        setLoadingRegions(false);
      }
    };

    loadRegions();
  }, []);

  // Update selected region details when primary region changes
  useEffect(() => {
    if (complianceData.primaryRegion) {
      const region = regions.find(r => r.id === complianceData.primaryRegion);
      setSelectedRegionDetails(region || null);

      // Auto-populate compliance profile if region has one
      if (region?.complianceProfile) {
        updateComplianceData({
          complianceProfile: { ...complianceData.complianceProfile, ...region.complianceProfile }
        });
      }
    }
  }, [complianceData.primaryRegion, regions]);

  const updateComplianceData = (updates: Partial<RegionalComplianceData>) => {
    onChange({
      regionalCompliance: { ...complianceData, ...updates }
    });
  };

  const updateComplianceProfile = (updates: Partial<ComplianceProfile>) => {
    updateComplianceData({
      complianceProfile: { ...complianceData.complianceProfile, ...updates }
    });
  };

  const getFieldError = (fieldName: string): string | undefined => {
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  };

  // Region options
  const regionOptions: IDropdownOption[] = regions.map(region => ({
    key: region.id,
    text: `${region.name} (${region.country})`
  }));

  // Data protection level options
  const dataProtectionOptions: IDropdownOption[] = [
    {
      key: DataProtectionLevel.BASIC,
      text: 'Basic',
      data: { description: 'Standard data protection measures' }
    },
    {
      key: DataProtectionLevel.GDPR_COMPLIANT,
      text: 'GDPR Compliant',
      data: { description: 'Full GDPR compliance for EU operations' }
    },
    {
      key: DataProtectionLevel.ENHANCED,
      text: 'Enhanced',
      data: { description: 'Advanced security and privacy controls' }
    },
    {
      key: DataProtectionLevel.ENTERPRISE,
      text: 'Enterprise',
      data: { description: 'Maximum security for sensitive operations' }
    }
  ];

  // Special requirements options
  const specialRequirementsOptions = [
    { key: 'high_security_clearance', text: 'High Security Clearance Required' },
    { key: 'biometric_verification', text: 'Biometric Verification' },
    { key: 'background_checks', text: 'Enhanced Background Checks' },
    { key: 'drug_testing', text: 'Regular Drug Testing' },
    { key: 'night_work_restrictions', text: 'Night Work Restrictions' },
    { key: 'youth_employment', text: 'Youth Employment Considerations' },
    { key: 'vulnerable_persons', text: 'Vulnerable Persons Protection' }
  ];

  // Health & Safety Standards columns
  const healthSafetyColumns: IColumn[] = [
    {
      key: 'standard',
      name: 'Standard',
      fieldName: 'standard',
      minWidth: 200,
      maxWidth: 300
    },
    {
      key: 'description',
      name: 'Description',
      fieldName: 'description',
      minWidth: 300,
      isMultiline: true
    },
    {
      key: 'action',
      name: 'Action',
      fieldName: 'action',
      minWidth: 80,
      maxWidth: 80,
      onRender: (item: any, index?: number) => (
        <IconButton
          iconProps={{ iconName: 'Delete' }}
          title="Remove"
          onClick={() => removeHealthSafetyStandard(index || 0)}
        />
      )
    }
  ];

  const addHealthSafetyStandard = () => {
    const newStandard = `Standard ${(complianceData.complianceProfile?.healthSafetyStandards?.length || 0) + 1}`;
    const currentStandards = complianceData.complianceProfile?.healthSafetyStandards || [];
    updateComplianceProfile({
      healthSafetyStandards: [...currentStandards, newStandard]
    });
  };

  const removeHealthSafetyStandard = (index: number) => {
    const currentStandards = complianceData.complianceProfile?.healthSafetyStandards || [];
    const updatedStandards = currentStandards.filter((_, i) => i !== index);
    updateComplianceProfile({
      healthSafetyStandards: updatedStandards
    });
  };

  const handleOperatingRegionChange = (regionId: string, checked: boolean) => {
    const currentRegions = complianceData.operatingRegions || [];
    let updatedRegions: string[];

    if (checked) {
      updatedRegions = [...currentRegions, regionId];
    } else {
      updatedRegions = currentRegions.filter(id => id !== regionId);
    }

    updateComplianceData({ operatingRegions: updatedRegions });
  };

  const handleSpecialRequirementChange = (requirementId: string, checked: boolean) => {
    const currentRequirements = complianceData.specialRequirements || [];
    let updatedRequirements: string[];

    if (checked) {
      updatedRequirements = [...currentRequirements, requirementId];
    } else {
      updatedRequirements = currentRequirements.filter(id => id !== requirementId);
    }

    updateComplianceData({ specialRequirements: updatedRequirements });
  };

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <MessageBar messageBarType={MessageBarType.info}>
        Configure compliance settings based on your operating regions. This will automatically
        set up working hours, overtime rules, and safety standards for your locations.
      </MessageBar>

      {/* Primary Region Selection */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Primary Operating Region
        </Text>

        <Stack tokens={{ childrenGap: 20 }}>
          <Dropdown
            label="Primary Region *"
            selectedKey={complianceData.primaryRegion}
            options={regionOptions}
            onChange={(_, option) => updateComplianceData({
              primaryRegion: option?.key as string
            })}
            errorMessage={getFieldError('primaryRegion')}
            disabled={isLoading || loadingRegions}
            required
            placeholder={loadingRegions ? 'Loading regions...' : 'Select primary region'}
          />

          {selectedRegionDetails && (
            <MessageBar messageBarType={MessageBarType.success}>
              <strong>Region Details:</strong> {selectedRegionDetails.name} ({selectedRegionDetails.code}) •
              Currency: {selectedRegionDetails.currency} •
              Timezone: {selectedRegionDetails.timezone}
            </MessageBar>
          )}
        </Stack>
      </div>

      {/* Additional Operating Regions */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Additional Operating Regions
        </Text>

        <Text variant="medium" className="text-gray-600 mb-4">
          Select any additional regions where you operate staff.
        </Text>

        {loadingRegions ? (
          <div className="flex items-center space-x-2">
            <Spinner size={SpinnerSize.small} />
            <Text variant="small">Loading regions...</Text>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regions
              .filter(region => region.id !== complianceData.primaryRegion)
              .map(region => (
                <Checkbox
                  key={region.id}
                  label={`${region.name} (${region.country})`}
                  checked={(complianceData.operatingRegions || []).includes(region.id)}
                  onChange={(_, checked) => handleOperatingRegionChange(region.id, checked || false)}
                  disabled={isLoading}
                />
              ))}
          </div>
        )}
      </div>

      {/* Auto-Generated Compliance Profile */}
      {selectedRegionDetails?.complianceProfile && (
        <div>
          <Text variant="xLarge" className="font-semibold mb-4 block">
            Compliance Profile (Auto-Generated)
          </Text>

          <div className="bg-gray-50 p-6 rounded-lg space-y-4">
            <Stack tokens={{ childrenGap: 16 }}>
              <TextField
                label="Working Hours Regulation"
                value={complianceData.complianceProfile?.workingHoursRegulation || ''}
                onChange={(_, value) => updateComplianceProfile({
                  workingHoursRegulation: value || ''
                })}
                disabled={isLoading}
                multiline
                rows={2}
              />

              <TextField
                label="Overtime Rules"
                value={complianceData.complianceProfile?.overtimeRules || ''}
                onChange={(_, value) => updateComplianceProfile({
                  overtimeRules: value || ''
                })}
                disabled={isLoading}
                multiline
                rows={2}
              />

              <TextField
                label="Break Requirements"
                value={complianceData.complianceProfile?.breakRequirements || ''}
                onChange={(_, value) => updateComplianceProfile({
                  breakRequirements: value || ''
                })}
                disabled={isLoading}
                multiline
                rows={2}
              />

              <TextField
                label="Holiday Entitlements"
                value={complianceData.complianceProfile?.holidayEntitlements || ''}
                onChange={(_, value) => updateComplianceProfile({
                  holidayEntitlements: value || ''
                })}
                disabled={isLoading}
                multiline
                rows={2}
              />

              <TextField
                label="Leave Requirements"
                value={complianceData.complianceProfile?.leaveRequirements || ''}
                onChange={(_, value) => updateComplianceProfile({
                  leaveRequirements: value || ''
                })}
                disabled={isLoading}
                multiline
                rows={2}
              />
            </Stack>
          </div>
        </div>
      )}

      {/* Special Requirements */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Special Requirements
        </Text>

        <Text variant="medium" className="text-gray-600 mb-4">
          Select any special compliance requirements for your operations.
        </Text>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {specialRequirementsOptions.map(option => (
            <Checkbox
              key={option.key}
              label={option.text}
              checked={(complianceData.specialRequirements || []).includes(option.key)}
              onChange={(_, checked) => handleSpecialRequirementChange(option.key, checked || false)}
              disabled={isLoading}
            />
          ))}
        </div>
      </div>

      {/* Data Protection Level */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Data Protection Level
        </Text>

        <Dropdown
          label="Data Protection Level *"
          selectedKey={complianceData.dataProtectionLevel}
          options={dataProtectionOptions}
          onChange={(_, option) => updateComplianceData({
            dataProtectionLevel: option?.key as DataProtectionLevel
          })}
          disabled={isLoading}
          required
          onRenderOption={(option) => (
            <div>
              <div className="font-medium">{option?.text}</div>
              <div className="text-sm text-gray-600">{option?.data?.description}</div>
            </div>
          )}
        />

        <MessageBar
          messageBarType={MessageBarType.info}
          styles={{ root: { marginTop: 12 } }}
        >
          {complianceData.dataProtectionLevel === DataProtectionLevel.GDPR_COMPLIANT && (
            'GDPR compliance includes data minimization, consent management, and right to erasure.'
          )}
          {complianceData.dataProtectionLevel === DataProtectionLevel.ENHANCED && (
            'Enhanced protection includes additional encryption, access controls, and audit logging.'
          )}
          {complianceData.dataProtectionLevel === DataProtectionLevel.ENTERPRISE && (
            'Enterprise-level protection includes advanced threat detection and incident response.'
          )}
          {complianceData.dataProtectionLevel === DataProtectionLevel.BASIC && (
            'Basic protection includes standard security measures and access controls.'
          )}
        </MessageBar>
      </div>

      {/* Compliance Summary */}
      {complianceData.primaryRegion && (
        <div>
          <MessageBar messageBarType={MessageBarType.success}>
            <strong>Compliance Configuration Summary:</strong>
            <br />
            Primary Region: {selectedRegionDetails?.name}
            <br />
            Additional Regions: {(complianceData.operatingRegions || []).length}
            <br />
            Data Protection: {complianceData.dataProtectionLevel?.replace('_', ' ').toUpperCase()}
            <br />
            Special Requirements: {(complianceData.specialRequirements || []).length} selected
          </MessageBar>
        </div>
      )}
    </div>
  );
};

export default RegionalComplianceStep;