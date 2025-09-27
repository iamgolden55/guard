import React, { useState } from 'react';
import {
  TextField,
  Dropdown,
  Stack,
  Text,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Checkbox,
  Toggle,
  PrimaryButton,
  DefaultButton,
  Icon,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import type {
  OnboardingWizardData,
  IntegrationsSetupData,
  ValidationError
} from '../../../types/onboarding';
import { AccountingProvider, PayFrequency, SyncFrequency } from '../../../types/onboarding';
import onboardingService from '../../../services/onboardingService';

interface IntegrationsSetupStepProps {
  data: Partial<OnboardingWizardData>;
  onChange: (data: Partial<OnboardingWizardData>) => void;
  errors: ValidationError[];
  isLoading: boolean;
}

const IntegrationsSetupStep: React.FC<IntegrationsSetupStepProps> = ({
  data,
  onChange,
  errors,
  isLoading
}) => {
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const integrations = data.integrationsSetup || {} as IntegrationsSetupData;

  const updateIntegrations = (updates: Partial<IntegrationsSetupData>) => {
    onChange({
      integrationsSetup: { ...integrations, ...updates }
    });
  };

  const updateDeputy = (updates: Partial<IntegrationsSetupData['deputy']>) => {
    updateIntegrations({
      deputy: { ...integrations.deputy, ...updates }
    });
  };

  const updateAccounting = (updates: Partial<IntegrationsSetupData['accounting']>) => {
    updateIntegrations({
      accounting: { ...integrations.accounting, ...updates }
    });
  };

  const updatePayroll = (updates: Partial<IntegrationsSetupData['payroll']>) => {
    updateIntegrations({
      payroll: { ...integrations.payroll, ...updates }
    });
  };

  const getFieldError = (fieldName: string): string | undefined => {
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  };

  // Accounting provider options
  const accountingProviderOptions: IDropdownOption[] = [
    { key: AccountingProvider.NONE, text: 'No Integration' },
    { key: AccountingProvider.XERO, text: 'Xero' },
    { key: AccountingProvider.QUICKBOOKS, text: 'QuickBooks' },
    { key: AccountingProvider.SAGE, text: 'Sage' },
    { key: AccountingProvider.ZOHO, text: 'Zoho Books' }
  ];

  // Pay frequency options
  const payFrequencyOptions: IDropdownOption[] = [
    { key: PayFrequency.WEEKLY, text: 'Weekly' },
    { key: PayFrequency.BIWEEKLY, text: 'Bi-weekly' },
    { key: PayFrequency.MONTHLY, text: 'Monthly' },
    { key: PayFrequency.QUARTERLY, text: 'Quarterly' }
  ];

  // Sync frequency options
  const syncFrequencyOptions: IDropdownOption[] = [
    { key: SyncFrequency.REALTIME, text: 'Real-time' },
    { key: SyncFrequency.EVERY_HOUR, text: 'Every Hour' },
    { key: SyncFrequency.EVERY_4_HOURS, text: 'Every 4 Hours' },
    { key: SyncFrequency.DAILY, text: 'Daily' },
    { key: SyncFrequency.WEEKLY, text: 'Weekly' },
    { key: SyncFrequency.MANUAL, text: 'Manual Only' }
  ];

  // Test integration connection
  const testIntegration = async (integrationType: string) => {
    setTestingIntegration(integrationType);
    try {
      let credentials: any = {};

      switch (integrationType) {
        case 'deputy':
          credentials = {
            apiKey: integrations.deputy?.apiKey,
            subdomain: integrations.deputy?.subdomain
          };
          break;
        case 'accounting':
          credentials = integrations.accounting?.credentials || {};
          break;
      }

      const result = await onboardingService.testIntegration(integrationType, credentials);
      setTestResults(prev => ({ ...prev, [integrationType]: result }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [integrationType]: { success: false, message: 'Test failed' }
      }));
    } finally {
      setTestingIntegration(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <MessageBar messageBarType={MessageBarType.info}>
        Connect your external systems to streamline operations. All integrations are optional
        and can be configured later if needed.
      </MessageBar>

      {/* Deputy Integration */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Icon iconName="PlugConnected" styles={{ root: { fontSize: 24, color: '#0078d4' } }} />
          <Text variant="xLarge" className="font-semibold">
            Deputy Workforce Management
          </Text>
        </div>

        <Toggle
          label="Enable Deputy Integration"
          checked={integrations.deputy?.enabled || false}
          onChange={(_, checked) => updateDeputy({ enabled: checked || false })}
          disabled={isLoading}
          onText="Enabled"
          offText="Disabled"
        />

        {integrations.deputy?.enabled && (
          <Stack tokens={{ childrenGap: 16 }} styles={{ root: { marginTop: 16 } }}>
            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <TextField
                label="API Key *"
                type="password"
                value={integrations.deputy?.apiKey || ''}
                onChange={(_, value) => updateDeputy({ apiKey: value || '' })}
                errorMessage={getFieldError('deputy.apiKey')}
                disabled={isLoading}
                required
                placeholder="Enter your Deputy API key"
                styles={{ root: { flex: 2 } }}
              />

              <TextField
                label="Subdomain *"
                value={integrations.deputy?.subdomain || ''}
                onChange={(_, value) => updateDeputy({ subdomain: value || '' })}
                errorMessage={getFieldError('deputy.subdomain')}
                disabled={isLoading}
                required
                placeholder="your-company"
                prefix="https://"
                suffix=".au.deputy.com"
                styles={{ root: { flex: 1 } }}
              />
            </Stack>

            <Dropdown
              label="Sync Frequency"
              selectedKey={integrations.deputy?.syncFrequency}
              options={syncFrequencyOptions}
              onChange={(_, option) => updateDeputy({
                syncFrequency: option?.key as SyncFrequency
              })}
              disabled={isLoading}
            />

            <div>
              <Text variant="medium" className="font-semibold mb-2">
                Sync Options
              </Text>
              <div className="grid grid-cols-2 gap-2">
                <Checkbox
                  label="Employees"
                  checked={integrations.deputy?.syncOptions?.employees || false}
                  onChange={(_, checked) => updateDeputy({
                    syncOptions: {
                      ...integrations.deputy?.syncOptions,
                      employees: checked || false
                    }
                  })}
                  disabled={isLoading}
                />
                <Checkbox
                  label="Timesheets"
                  checked={integrations.deputy?.syncOptions?.timesheets || false}
                  onChange={(_, checked) => updateDeputy({
                    syncOptions: {
                      ...integrations.deputy?.syncOptions,
                      timesheets: checked || false
                    }
                  })}
                  disabled={isLoading}
                />
                <Checkbox
                  label="Rosters"
                  checked={integrations.deputy?.syncOptions?.rosters || false}
                  onChange={(_, checked) => updateDeputy({
                    syncOptions: {
                      ...integrations.deputy?.syncOptions,
                      rosters: checked || false
                    }
                  })}
                  disabled={isLoading}
                />
                <Checkbox
                  label="Locations"
                  checked={integrations.deputy?.syncOptions?.locations || false}
                  onChange={(_, checked) => updateDeputy({
                    syncOptions: {
                      ...integrations.deputy?.syncOptions,
                      locations: checked || false
                    }
                  })}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Test Deputy Connection */}
            <div className="flex items-center space-x-3">
              <PrimaryButton
                text={testingIntegration === 'deputy' ? undefined : 'Test Connection'}
                onClick={() => testIntegration('deputy')}
                disabled={isLoading || testingIntegration === 'deputy' || !integrations.deputy?.apiKey}
                iconProps={testingIntegration === 'deputy' ? undefined : { iconName: 'PlugConnected' }}
              >
                {testingIntegration === 'deputy' && (
                  <div className="flex items-center space-x-2">
                    <Spinner size={SpinnerSize.small} />
                    <span>Testing...</span>
                  </div>
                )}
              </PrimaryButton>

              {testResults.deputy && (
                <MessageBar
                  messageBarType={testResults.deputy.success ? MessageBarType.success : MessageBarType.error}
                  isMultiline={false}
                >
                  {testResults.deputy.message}
                </MessageBar>
              )}
            </div>
          </Stack>
        )}
      </div>

      {/* Accounting Integration */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Icon iconName="Money" styles={{ root: { fontSize: 24, color: '#107c10' } }} />
          <Text variant="xLarge" className="font-semibold">
            Accounting Integration
          </Text>
        </div>

        <Stack tokens={{ childrenGap: 16 }}>
          <Dropdown
            label="Accounting Provider"
            selectedKey={integrations.accounting?.provider}
            options={accountingProviderOptions}
            onChange={(_, option) => {
              updateAccounting({
                provider: option?.key as AccountingProvider,
                enabled: option?.key !== AccountingProvider.NONE
              });
            }}
            disabled={isLoading}
          />

          {integrations.accounting?.enabled && integrations.accounting?.provider !== AccountingProvider.NONE && (
            <Stack tokens={{ childrenGap: 16 }}>
              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <TextField
                  label="Client ID *"
                  value={integrations.accounting?.credentials?.clientId || ''}
                  onChange={(_, value) => updateAccounting({
                    credentials: {
                      ...integrations.accounting?.credentials,
                      clientId: value || ''
                    }
                  })}
                  errorMessage={getFieldError('accounting.credentials.clientId')}
                  disabled={isLoading}
                  required
                  styles={{ root: { flex: 1 } }}
                />

                <TextField
                  label="Client Secret *"
                  type="password"
                  value={integrations.accounting?.credentials?.clientSecret || ''}
                  onChange={(_, value) => updateAccounting({
                    credentials: {
                      ...integrations.accounting?.credentials,
                      clientSecret: value || ''
                    }
                  })}
                  disabled={isLoading}
                  required
                  styles={{ root: { flex: 1 } }}
                />
              </Stack>

              <div>
                <Text variant="medium" className="font-semibold mb-2">
                  Sync Options
                </Text>
                <div className="grid grid-cols-2 gap-2">
                  <Checkbox
                    label="Invoices"
                    checked={integrations.accounting?.syncOptions?.invoices || false}
                    onChange={(_, checked) => updateAccounting({
                      syncOptions: {
                        ...integrations.accounting?.syncOptions,
                        invoices: checked || false
                      }
                    })}
                    disabled={isLoading}
                  />
                  <Checkbox
                    label="Expenses"
                    checked={integrations.accounting?.syncOptions?.expenses || false}
                    onChange={(_, checked) => updateAccounting({
                      syncOptions: {
                        ...integrations.accounting?.syncOptions,
                        expenses: checked || false
                      }
                    })}
                    disabled={isLoading}
                  />
                  <Checkbox
                    label="Payroll"
                    checked={integrations.accounting?.syncOptions?.payroll || false}
                    onChange={(_, checked) => updateAccounting({
                      syncOptions: {
                        ...integrations.accounting?.syncOptions,
                        payroll: checked || false
                      }
                    })}
                    disabled={isLoading}
                  />
                  <Checkbox
                    label="Taxes"
                    checked={integrations.accounting?.syncOptions?.taxes || false}
                    onChange={(_, checked) => updateAccounting({
                      syncOptions: {
                        ...integrations.accounting?.syncOptions,
                        taxes: checked || false
                      }
                    })}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </Stack>
          )}
        </Stack>
      </div>

      {/* Payroll Integration */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Icon iconName="PaymentCard" styles={{ root: { fontSize: 24, color: '#8764b8' } }} />
          <Text variant="xLarge" className="font-semibold">
            Payroll Integration
          </Text>
        </div>

        <Toggle
          label="Enable Payroll Integration"
          checked={integrations.payroll?.enabled || false}
          onChange={(_, checked) => updatePayroll({ enabled: checked || false })}
          disabled={isLoading}
          onText="Enabled"
          offText="Disabled"
        />

        {integrations.payroll?.enabled && (
          <Stack tokens={{ childrenGap: 16 }} styles={{ root: { marginTop: 16 } }}>
            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <TextField
                label="Payroll Provider"
                value={integrations.payroll?.provider || ''}
                onChange={(_, value) => updatePayroll({ provider: value || '' })}
                disabled={isLoading}
                placeholder="e.g., SAGE Payroll, BrightPay"
                styles={{ root: { flex: 1 } }}
              />

              <Dropdown
                label="Pay Frequency"
                selectedKey={integrations.payroll?.payFrequency}
                options={payFrequencyOptions}
                onChange={(_, option) => updatePayroll({
                  payFrequency: option?.key as PayFrequency
                })}
                disabled={isLoading}
                styles={{ root: { flex: 1 } }}
              />
            </Stack>
          </Stack>
        )}
      </div>

      {/* Integration Summary */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Integration Summary
        </Text>

        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Text variant="mediumPlus" className="font-semibold mb-2">
                Deputy
              </Text>
              <div className="flex items-center space-x-2">
                <Icon
                  iconName={integrations.deputy?.enabled ? 'Completed' : 'Cancel'}
                  styles={{
                    root: {
                      color: integrations.deputy?.enabled ? '#107c10' : '#a19f9d'
                    }
                  }}
                />
                <Text variant="small">
                  {integrations.deputy?.enabled ? 'Configured' : 'Not configured'}
                </Text>
              </div>
            </div>

            <div>
              <Text variant="mediumPlus" className="font-semibold mb-2">
                Accounting
              </Text>
              <div className="flex items-center space-x-2">
                <Icon
                  iconName={integrations.accounting?.enabled ? 'Completed' : 'Cancel'}
                  styles={{
                    root: {
                      color: integrations.accounting?.enabled ? '#107c10' : '#a19f9d'
                    }
                  }}
                />
                <Text variant="small">
                  {integrations.accounting?.enabled
                    ? `${integrations.accounting.provider} configured`
                    : 'Not configured'}
                </Text>
              </div>
            </div>

            <div>
              <Text variant="mediumPlus" className="font-semibold mb-2">
                Payroll
              </Text>
              <div className="flex items-center space-x-2">
                <Icon
                  iconName={integrations.payroll?.enabled ? 'Completed' : 'Cancel'}
                  styles={{
                    root: {
                      color: integrations.payroll?.enabled ? '#107c10' : '#a19f9d'
                    }
                  }}
                />
                <Text variant="small">
                  {integrations.payroll?.enabled ? 'Configured' : 'Not configured'}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skip Notice */}
      <MessageBar messageBarType={MessageBarType.severeWarning}>
        <strong>Optional Step:</strong> You can skip this step and configure integrations later
        from the system settings. All integrations can be set up after onboarding is complete.
      </MessageBar>
    </div>
  );
};

export default IntegrationsSetupStep;