import type React from 'react';
import { useState } from 'react';
import {
  Stack,
  Text,
  TextField,
  PrimaryButton,
  Toggle,
  Label,
  Pivot,
  PivotItem,
  MessageBar,
  MessageBarType,
  Separator,
  Dropdown,
  IDropdownOption,
  Spinner,
  SpinnerSize,
  DefaultButton
} from '@fluentui/react';
import { MainLayout } from '../../layouts';

interface SettingsState {
  generalSettings: {
    companyName: string;
    supportEmail: string;
    supportPhone: string;
    shiftHourlyRate: string;
    defaultPaymentTerms: string;
    invoicePrefix: string;
    automaticInvoicing: boolean;
  };
  notificationSettings: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    shiftReminders: boolean;
    invoiceReminders: boolean;
    reportGeneration: boolean;
  };
  integrationSettings: {
    deputyEnabled: boolean;
    deputyApiKey: string;
    deputyDomain: string;
    syncFrequency: string;
  };
  securitySettings: {
    requireSignatures: boolean;
    requireManagerApproval: boolean;
    requireShiftPhotos: boolean;
    sessionTimeout: string;
    allowShiftExchange: boolean;
  };
}

const syncFrequencyOptions: IDropdownOption[] = [
  { key: 'hourly', text: 'Hourly' },
  { key: 'daily', text: 'Daily' },
  { key: 'realtime', text: 'Real-time' }
];

const sessionTimeoutOptions: IDropdownOption[] = [
  { key: '15', text: '15 minutes' },
  { key: '30', text: '30 minutes' },
  { key: '60', text: '1 hour' },
  { key: '120', text: '2 hours' }
];

const Settings: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mock initial state - in real app, would be loaded from API
  const [settings, setSettings] = useState<SettingsState>({
    generalSettings: {
      companyName: 'Mead Security',
      supportEmail: 'support@meadsecurity.co.uk',
      supportPhone: '+44 1234 567890',
      shiftHourlyRate: '15.50',
      defaultPaymentTerms: 'Net 30',
      invoicePrefix: 'MSD-',
      automaticInvoicing: true
    },
    notificationSettings: {
      emailNotifications: true,
      smsNotifications: true,
      shiftReminders: true,
      invoiceReminders: true,
      reportGeneration: false
    },
    integrationSettings: {
      deputyEnabled: true,
      deputyApiKey: 'XXXXXXXXXXXXXXXXXXXX',
      deputyDomain: 'meadsecurity.deputy.com',
      syncFrequency: 'daily'
    },
    securitySettings: {
      requireSignatures: true,
      requireManagerApproval: true,
      requireShiftPhotos: false,
      sessionTimeout: '30',
      allowShiftExchange: true
    }
  });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Simulate API call with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real app, you would call your API here
      // await settingsService.updateSettings(settings);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (section: keyof SettingsState, field: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">System Settings</Text>
        </Stack>

        {saveSuccess && (
          <MessageBar
            messageBarType={MessageBarType.success}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setSaveSuccess(false)}
          >
            Settings saved successfully.
          </MessageBar>
        )}

        {saveError && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setSaveError(null)}
          >
            {saveError}
          </MessageBar>
        )}

        <Pivot aria-label="Settings Sections">
          <PivotItem headerText="General Settings">
            <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
              <Label>Company Information</Label>
              <TextField
                label="Company Name"
                value={settings.generalSettings.companyName}
                onChange={(_, newValue) =>
                  handleInputChange('generalSettings', 'companyName', newValue || '')}
              />
              <TextField
                label="Support Email"
                value={settings.generalSettings.supportEmail}
                onChange={(_, newValue) =>
                  handleInputChange('generalSettings', 'supportEmail', newValue || '')}
              />
              <TextField
                label="Support Phone"
                value={settings.generalSettings.supportPhone}
                onChange={(_, newValue) =>
                  handleInputChange('generalSettings', 'supportPhone', newValue || '')}
              />

              <Separator />
              <Label>Payment & Invoicing</Label>
              <TextField
                label="Default Hourly Rate (£)"
                value={settings.generalSettings.shiftHourlyRate}
                onChange={(_, newValue) =>
                  handleInputChange('generalSettings', 'shiftHourlyRate', newValue || '')}
              />
              <TextField
                label="Default Payment Terms"
                value={settings.generalSettings.defaultPaymentTerms}
                onChange={(_, newValue) =>
                  handleInputChange('generalSettings', 'defaultPaymentTerms', newValue || '')}
              />
              <TextField
                label="Invoice Prefix"
                value={settings.generalSettings.invoicePrefix}
                onChange={(_, newValue) =>
                  handleInputChange('generalSettings', 'invoicePrefix', newValue || '')}
              />
              <Toggle
                label="Automatic Invoice Generation"
                checked={settings.generalSettings.automaticInvoicing}
                onChange={(_, checked) =>
                  handleInputChange('generalSettings', 'automaticInvoicing', checked || false)}
                onText="Enabled"
                offText="Disabled"
              />
            </Stack>
          </PivotItem>

          <PivotItem headerText="Notifications">
            <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
              <Label>Notification Channels</Label>
              <Toggle
                label="Email Notifications"
                checked={settings.notificationSettings.emailNotifications}
                onChange={(_, checked) =>
                  handleInputChange('notificationSettings', 'emailNotifications', checked || false)}
                onText="Enabled"
                offText="Disabled"
              />
              <Toggle
                label="SMS Notifications"
                checked={settings.notificationSettings.smsNotifications}
                onChange={(_, checked) =>
                  handleInputChange('notificationSettings', 'smsNotifications', checked || false)}
                onText="Enabled"
                offText="Disabled"
              />

              <Separator />
              <Label>Notification Types</Label>
              <Toggle
                label="Shift Reminders"
                checked={settings.notificationSettings.shiftReminders}
                onChange={(_, checked) =>
                  handleInputChange('notificationSettings', 'shiftReminders', checked || false)}
                onText="Enabled"
                offText="Disabled"
              />
              <Toggle
                label="Invoice Reminders"
                checked={settings.notificationSettings.invoiceReminders}
                onChange={(_, checked) =>
                  handleInputChange('notificationSettings', 'invoiceReminders', checked || false)}
                onText="Enabled"
                offText="Disabled"
              />
              <Toggle
                label="Automatic Report Generation"
                checked={settings.notificationSettings.reportGeneration}
                onChange={(_, checked) =>
                  handleInputChange('notificationSettings', 'reportGeneration', checked || false)}
                onText="Enabled"
                offText="Disabled"
              />
            </Stack>
          </PivotItem>

          <PivotItem headerText="Integration">
            <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
              <Label>Deputy Integration</Label>
              <Toggle
                label="Enable Deputy Integration"
                checked={settings.integrationSettings.deputyEnabled}
                onChange={(_, checked) =>
                  handleInputChange('integrationSettings', 'deputyEnabled', checked || false)}
                onText="Enabled"
                offText="Disabled"
              />
              <TextField
                label="Deputy API Key"
                type="password"
                value={settings.integrationSettings.deputyApiKey}
                onChange={(_, newValue) =>
                  handleInputChange('integrationSettings', 'deputyApiKey', newValue || '')}
                disabled={!settings.integrationSettings.deputyEnabled}
              />
              <TextField
                label="Deputy Domain"
                value={settings.integrationSettings.deputyDomain}
                onChange={(_, newValue) =>
                  handleInputChange('integrationSettings', 'deputyDomain', newValue || '')}
                disabled={!settings.integrationSettings.deputyEnabled}
              />
              <Dropdown
                label="Sync Frequency"
                selectedKey={settings.integrationSettings.syncFrequency}
                options={syncFrequencyOptions}
                onChange={(_, option) =>
                  option && handleInputChange('integrationSettings', 'syncFrequency', option.key as string)}
                disabled={!settings.integrationSettings.deputyEnabled}
              />
            </Stack>
          </PivotItem>

          <PivotItem headerText="Security">
            <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
              <Label>Shift Security Requirements</Label>
              <Toggle
                label="Require Staff Signatures"
                checked={settings.securitySettings.requireSignatures}
                onChange={(_, checked) =>
                  handleInputChange('securitySettings', 'requireSignatures', checked || false)}
                onText="Required"
                offText="Optional"
              />
              <Toggle
                label="Require Manager Approval"
                checked={settings.securitySettings.requireManagerApproval}
                onChange={(_, checked) =>
                  handleInputChange('securitySettings', 'requireManagerApproval', checked || false)}
                onText="Required"
                offText="Optional"
              />
              <Toggle
                label="Require Shift Photos"
                checked={settings.securitySettings.requireShiftPhotos}
                onChange={(_, checked) =>
                  handleInputChange('securitySettings', 'requireShiftPhotos', checked || false)}
                onText="Required"
                offText="Optional"
              />

              <Separator />
              <Label>Portal Security</Label>
              <Dropdown
                label="Session Timeout"
                selectedKey={settings.securitySettings.sessionTimeout}
                options={sessionTimeoutOptions}
                onChange={(_, option) =>
                  option && handleInputChange('securitySettings', 'sessionTimeout', option.key as string)}
              />
              <Toggle
                label="Allow Staff Shift Exchange"
                checked={settings.securitySettings.allowShiftExchange}
                onChange={(_, checked) =>
                  handleInputChange('securitySettings', 'allowShiftExchange', checked || false)}
                onText="Allowed"
                offText="Disallowed"
              />
            </Stack>
          </PivotItem>
        </Pivot>

        <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end" style={{ marginTop: 20 }}>
          <DefaultButton
            text="Reset to Defaults"
            disabled={isSaving}
          />
          <PrimaryButton
            text={isSaving ? "Saving..." : "Save Settings"}
            onClick={handleSaveSettings}
            disabled={isSaving}
            iconProps={isSaving ? { iconName: 'Hourglass' } : { iconName: 'Save' }}
          />
          {isSaving && <Spinner size={SpinnerSize.small} />}
        </Stack>
      </Stack>
    </MainLayout>
  );
};

export default Settings;
