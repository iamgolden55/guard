import React from 'react';
import {
  TextField,
  Dropdown,
  Stack,
  Text,
  IDropdownOption,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import type {
  OnboardingWizardData,
  CompanyInfoData,
  ValidationError
} from '../../../types/onboarding';
import { BusinessType } from '../../../types/onboarding';

interface CompanyInfoStepProps {
  data: Partial<OnboardingWizardData>;
  onChange: (data: Partial<OnboardingWizardData>) => void;
  errors: ValidationError[];
  isLoading: boolean;
}

const CompanyInfoStep: React.FC<CompanyInfoStepProps> = ({
  data,
  onChange,
  errors,
  isLoading
}) => {
  const companyInfo = React.useMemo(() => data.companyInfo || {} as CompanyInfoData, [data.companyInfo]);

  const updateCompanyInfo = React.useCallback((updates: Partial<CompanyInfoData>) => {
    onChange({
      companyInfo: { ...companyInfo, ...updates }
    });
  }, [onChange, companyInfo]);

  const updateAddress = React.useCallback((updates: Partial<CompanyInfoData['address']>) => {
    updateCompanyInfo({
      address: { ...companyInfo.address, ...updates }
    });
  }, [updateCompanyInfo, companyInfo.address]);

  const updatePrimaryContact = React.useCallback((updates: Partial<CompanyInfoData['primaryContact']>) => {
    updateCompanyInfo({
      primaryContact: { ...companyInfo.primaryContact, ...updates }
    });
  }, [updateCompanyInfo, companyInfo.primaryContact]);

  const getFieldError = React.useCallback((fieldName: string): string | undefined => {
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  }, [errors]);

  // Memoized dropdown options to prevent re-creation on every render
  const businessTypeOptions: IDropdownOption[] = React.useMemo(() => [
    { key: BusinessType.PRIVATE_LIMITED, text: 'Private Limited Company' },
    { key: BusinessType.PUBLIC_LIMITED, text: 'Public Limited Company' },
    { key: BusinessType.PARTNERSHIP, text: 'Partnership' },
    { key: BusinessType.SOLE_PROPRIETORSHIP, text: 'Sole Proprietorship' },
    { key: BusinessType.NON_PROFIT, text: 'Non-Profit Organization' },
    { key: BusinessType.OTHER, text: 'Other' }
  ], []);

  const industryOptions: IDropdownOption[] = React.useMemo(() => [
    { key: 'security_services', text: 'Security Services' },
    { key: 'event_security', text: 'Event Security' },
    { key: 'corporate_security', text: 'Corporate Security' },
    { key: 'retail_security', text: 'Retail Security' },
    { key: 'hospitality_security', text: 'Hospitality Security' },
    { key: 'construction_security', text: 'Construction Security' },
    { key: 'transport_security', text: 'Transport Security' },
    { key: 'healthcare_security', text: 'Healthcare Security' },
    { key: 'education_security', text: 'Education Security' },
    { key: 'other', text: 'Other' }
  ], []);

  const countryOptions: IDropdownOption[] = React.useMemo(() => [
    { key: 'United Kingdom', text: 'United Kingdom' },
    { key: 'Ireland', text: 'Ireland' },
    { key: 'United States', text: 'United States' },
    { key: 'Canada', text: 'Canada' },
    { key: 'Australia', text: 'Australia' },
    { key: 'New Zealand', text: 'New Zealand' }
  ], []);

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <MessageBar messageBarType={MessageBarType.info}>
        Please provide accurate company information. This will be used for legal documents,
        invoicing, and compliance reporting.
      </MessageBar>

      {/* Company Details */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Company Details
        </Text>

        <Stack tokens={{ childrenGap: 20 }}>
          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <TextField
              label="Company Name *"
              value={companyInfo.companyName || ''}
              onChange={(_, value) => updateCompanyInfo({ companyName: value || '' })}
              errorMessage={getFieldError('companyName')}
              disabled={isLoading}
              required
              styles={{ root: { flex: 2 } }}
            />

            <TextField
              label="Registration Number *"
              value={companyInfo.registrationNumber || ''}
              onChange={(_, value) => updateCompanyInfo({ registrationNumber: value || '' })}
              errorMessage={getFieldError('registrationNumber')}
              disabled={isLoading}
              required
              placeholder="e.g., 12345678"
              styles={{ root: { flex: 1 } }}
            />
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <Dropdown
              label="Business Type *"
              selectedKey={companyInfo.businessType}
              options={businessTypeOptions}
              onChange={(_, option) => updateCompanyInfo({
                businessType: option?.key as BusinessType
              })}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
            />

            <Dropdown
              label="Industry *"
              selectedKey={companyInfo.industry}
              options={industryOptions}
              onChange={(_, option) => updateCompanyInfo({ industry: option?.key as string })}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
            />
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <TextField
              label="Founded Year *"
              type="number"
              value={companyInfo.foundedYear?.toString() || ''}
              onChange={(_, value) => updateCompanyInfo({
                foundedYear: value ? parseInt(value) : new Date().getFullYear()
              })}
              disabled={isLoading}
              required
              min={1900}
              max={new Date().getFullYear()}
              styles={{ root: { flex: 1 } }}
            />

            <TextField
              label="Website URL"
              value={companyInfo.websiteUrl || ''}
              onChange={(_, value) => updateCompanyInfo({ websiteUrl: value || '' })}
              disabled={isLoading}
              placeholder="https://www.example.com"
              styles={{ root: { flex: 2 } }}
            />
          </Stack>

          <TextField
            label="Company Description"
            multiline
            rows={3}
            value={companyInfo.description || ''}
            onChange={(_, value) => updateCompanyInfo({ description: value || '' })}
            disabled={isLoading}
            placeholder="Brief description of your company's services and expertise"
          />
        </Stack>
      </div>

      {/* Company Address */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Company Address
        </Text>

        <Stack tokens={{ childrenGap: 20 }}>
          <TextField
            label="Street Address *"
            value={companyInfo.address?.street || ''}
            onChange={(_, value) => updateAddress({ street: value || '' })}
            errorMessage={getFieldError('address.street')}
            disabled={isLoading}
            required
            placeholder="Building number and street name"
          />

          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <TextField
              label="City *"
              value={companyInfo.address?.city || ''}
              onChange={(_, value) => updateAddress({ city: value || '' })}
              errorMessage={getFieldError('address.city')}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
            />

            <TextField
              label="State/County *"
              value={companyInfo.address?.state || ''}
              onChange={(_, value) => updateAddress({ state: value || '' })}
              errorMessage={getFieldError('address.state')}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
            />

            <TextField
              label="Postal Code *"
              value={companyInfo.address?.postalCode || ''}
              onChange={(_, value) => updateAddress({ postalCode: value || '' })}
              errorMessage={getFieldError('address.postalCode')}
              disabled={isLoading}
              required
              placeholder="SW1A 1AA"
              styles={{ root: { flex: 1 } }}
            />
          </Stack>

          <Dropdown
            label="Country *"
            selectedKey={companyInfo.address?.country}
            options={countryOptions}
            onChange={(_, option) => updateAddress({ country: option?.key as string })}
            disabled={isLoading}
            required
          />
        </Stack>
      </div>

      {/* Primary Contact */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Primary Contact
        </Text>

        <Stack tokens={{ childrenGap: 20 }}>
          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <TextField
              label="First Name *"
              value={companyInfo.primaryContact?.firstName || ''}
              onChange={(_, value) => updatePrimaryContact({ firstName: value || '' })}
              errorMessage={getFieldError('primaryContact.firstName')}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
            />

            <TextField
              label="Last Name *"
              value={companyInfo.primaryContact?.lastName || ''}
              onChange={(_, value) => updatePrimaryContact({ lastName: value || '' })}
              errorMessage={getFieldError('primaryContact.lastName')}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
            />
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <TextField
              label="Email Address *"
              type="email"
              value={companyInfo.primaryContact?.email || ''}
              onChange={(_, value) => updatePrimaryContact({ email: value || '' })}
              errorMessage={getFieldError('primaryContact.email')}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
            />

            <TextField
              label="Phone Number *"
              value={companyInfo.primaryContact?.phone || ''}
              onChange={(_, value) => updatePrimaryContact({ phone: value || '' })}
              errorMessage={getFieldError('primaryContact.phone')}
              disabled={isLoading}
              required
              placeholder="+44 20 1234 5678"
              styles={{ root: { flex: 1 } }}
            />
          </Stack>

          <TextField
            label="Position/Title *"
            value={companyInfo.primaryContact?.position || ''}
            onChange={(_, value) => updatePrimaryContact({ position: value || '' })}
            errorMessage={getFieldError('primaryContact.position')}
            disabled={isLoading}
            required
            placeholder="e.g., Managing Director, Operations Manager"
          />
        </Stack>
      </div>

      {/* Data accuracy notice */}
      <MessageBar messageBarType={MessageBarType.warning}>
        <strong>Important:</strong> Please ensure all information is accurate as it will be used for
        legal documents, contracts, and regulatory compliance. Changes to company registration
        details may require additional verification.
      </MessageBar>
    </div>
  );
};

export default CompanyInfoStep;