import type React from 'react';
import { useState, useEffect } from 'react';
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
import { settingsService, type SystemSettings } from '../../services/settingsService';

interface SettingsState {
  generalSettings: {
    companyName: string;
    supportEmail: string;
    supportPhone: string;
    staticPayRate: string;
    standardPayRate: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [settings, setSettings] = useState<SettingsState | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await settingsService.getSettings();

        const frontendSettings: SettingsState = {
          generalSettings: {
            companyName: data.company_name,
            supportEmail: data.support_email,
            supportPhone: data.support_phone,
            staticPayRate: data.default_hourly_rate.toString(),
            standardPayRate: data.special_event_pay_rate.toString(),
            defaultPaymentTerms: data.default_payment_terms,
            invoicePrefix: data.invoice_prefix,
            automaticInvoicing: data.automatic_invoicing,
          },
          notificationSettings: {
            emailNotifications: data.email_notifications,
            smsNotifications: data.sms_notifications,
            shiftReminders: data.shift_reminders,
            invoiceReminders: data.invoice_reminders,
            reportGeneration: data.report_generation,
          },
          integrationSettings: {
            deputyEnabled: false,
            deputyApiKey: '',
            deputyDomain: '',
            syncFrequency: 'daily',
          },
          securitySettings: {
            requireSignatures: data.require_signatures,
            requireManagerApproval: data.require_manager_approval,
            requireShiftPhotos: data.require_shift_photos,
            sessionTimeout: data.session_timeout.toString(),
            allowShiftExchange: data.allow_shift_exchange,
          },
        };

        setSettings(frontendSettings);
      } catch (error) {
        console.error("Failed to load settings:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        setLoadError(`Failed to load settings: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) {
      setSaveError("Settings not loaded yet, cannot save.");
      return;
    }
    
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const backendSettings = {
      company_name: settings.generalSettings.companyName,
      support_email: settings.generalSettings.supportEmail,
      support_phone: settings.generalSettings.supportPhone,
      default_hourly_rate: parseFloat(settings.generalSettings.staticPayRate) || 0,
      special_event_pay_rate: parseFloat(settings.generalSettings.standardPayRate) || 0,
      default_payment_terms: settings.generalSettings.defaultPaymentTerms,
      invoice_prefix: settings.generalSettings.invoicePrefix,
      automatic_invoicing: settings.generalSettings.automaticInvoicing,
      email_notifications: settings.notificationSettings.emailNotifications,
      sms_notifications: settings.notificationSettings.smsNotifications,
      shift_reminders: settings.notificationSettings.shiftReminders,
      invoice_reminders: settings.notificationSettings.invoiceReminders,
      report_generation: settings.notificationSettings.reportGeneration,
      require_signatures: settings.securitySettings.requireSignatures,
      require_manager_approval: settings.securitySettings.requireManagerApproval,
      require_shift_photos: settings.securitySettings.requireShiftPhotos,
      session_timeout: parseInt(settings.securitySettings.sessionTimeout, 10) || 30,
      allow_shift_exchange: settings.securitySettings.allowShiftExchange,
    };

    try {
      await settingsService.updateSettings(backendSettings);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      setSaveError(`Failed to save settings: ${errorMessage}`);
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

        {isLoading && <Spinner label="Loading settings..." size={SpinnerSize.large} />}

        {loadError && (
          <MessageBar messageBarType={MessageBarType.error} isMultiline={false}>
            {loadError}
          </MessageBar>
        )}

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

        {!isLoading && !loadError && settings && (
          <>
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
                    label="Static Pay Rate (£)"
                    value={settings.generalSettings.staticPayRate}
                    onChange={(_, newValue) =>
                      handleInputChange('generalSettings', 'staticPayRate', newValue || '')}
                  />
                  <TextField
                    label="Standard Pay Rate (£) (Special Events)"
                    value={settings.generalSettings.standardPayRate}
                    onChange={(_, newValue) =>
                      handleInputChange('generalSettings', 'standardPayRate', newValue || '')}
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
                disabled={isSaving || isLoading}
              />
              <PrimaryButton
                text={isSaving ? "Saving..." : "Save Settings"}
                onClick={handleSaveSettings}
                disabled={isSaving || isLoading}
                iconProps={isSaving ? { iconName: 'Hourglass' } : { iconName: 'Save' }}
              />
              {isSaving && <Spinner size={SpinnerSize.small} />}
            </Stack>
          </>
        )}
      </Stack>
    </MainLayout>
  );
};

export default Settings;
