import type React from 'react';
import { useState, useEffect } from 'react';
import { Header, Container, SpaceBetween, StatusIndicator, CloudscapeTable, ExpandableSection, ConfirmationModal, Alert } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import { settingsService, type SystemSettings } from '../../services/settingsService';
import EmploymentTypesManagement from '../../components/EmploymentTypesManagement';
import { financeIntegrationsService } from '../../services';
import type { ProviderConnection, AccountingProvider } from '../../services/financeIntegrationsService';

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

const syncFrequencyOptions = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'realtime', label: 'Real-time' }
];

const sessionTimeoutOptions = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' }
];

// Toggle Switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-red-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

const Settings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  const [settings, setSettings] = useState<SettingsState | null>(null);

  // Finance integrations state
  const [financeConnections, setFinanceConnections] = useState<ProviderConnection[]>([]);
  const [financeProviders, setFinanceProviders] = useState<AccountingProvider[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);

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
    loadFinanceIntegrations();
  }, []);

  const loadFinanceIntegrations = async () => {
    try {
      setFinanceLoading(true);
      const [connectionsData, providersData] = await Promise.all([
        financeIntegrationsService.getConnections(),
        financeIntegrationsService.getProviders()
      ]);
      setFinanceConnections(connectionsData);
      setFinanceProviders(providersData);
    } catch (error) {
      console.warn('Finance integrations not available:', error);
    } finally {
      setFinanceLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) {
      addFlash({ type: 'error', content: 'Settings not loaded yet, cannot save.' });
      return;
    }

    setIsSaving(true);

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
      addFlash({ type: 'success', content: 'Settings saved successfully.' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      addFlash({ type: 'error', content: `Failed to save settings: ${errorMessage}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (section: keyof SettingsState, field: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [field]: value
      }
    }));
  };

  const handleTestConnection = async (connection: ProviderConnection) => {
    try {
      setFinanceLoading(true);
      const result = await financeIntegrationsService.testConnection(connection.id);

      if (result.success) {
        addFlash({ type: 'success', content: 'Connection test passed.' });
      } else {
        addFlash({ type: 'error', content: `Connection test failed: ${result.error_message}` });
      }

      await loadFinanceIntegrations();
    } catch (error) {
      console.error('Connection test failed:', error);
      addFlash({ type: 'error', content: 'Connection test failed. Please try again.' });
    } finally {
      setFinanceLoading(false);
    }
  };

  const handleDeleteConnection = async (connection: ProviderConnection) => {
    if (!window.confirm(`Are you sure you want to delete the connection to ${connection.provider_name}?`)) {
      return;
    }

    try {
      setFinanceLoading(true);
      await financeIntegrationsService.deleteConnection(connection.id);
      addFlash({ type: 'success', content: 'Connection deleted successfully.' });
      await loadFinanceIntegrations();
    } catch (error) {
      console.error('Delete connection failed:', error);
      addFlash({ type: 'error', content: 'Failed to delete connection. Please try again.' });
    } finally {
      setFinanceLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General Settings' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'integration', label: 'Integration' },
    { id: 'security', label: 'Security' },
    { id: 'employment', label: 'Employment Types' },
    { id: 'finance', label: 'Finance Integrations' },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        actions={
          <div className="flex gap-2">
            <button
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              disabled={isSaving || isLoading}
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving || isLoading}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSaving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        }
      >
        System Settings
      </Header>

      <Flashbar items={flashItems} onDismiss={removeFlash} />

      {isLoading && (
        <Container>
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-red-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500">Loading settings...</p>
            </div>
          </div>
        </Container>
      )}

      {loadError && (
        <Alert type="error">{loadError}</Alert>
      )}

      {!isLoading && !loadError && settings && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-0 -mb-px overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id
                    ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600 whitespace-nowrap'
                    : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* General Settings */}
          {activeTab === 'general' && (
            <SpaceBetween size="l">
              <Container header={<Header variant="h2">Company Information</Header>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={settings.generalSettings.companyName}
                      onChange={(e) => handleInputChange('generalSettings', 'companyName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                    <input
                      type="email"
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={settings.generalSettings.supportEmail}
                      onChange={(e) => handleInputChange('generalSettings', 'supportEmail', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
                    <input
                      type="tel"
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={settings.generalSettings.supportPhone}
                      onChange={(e) => handleInputChange('generalSettings', 'supportPhone', e.target.value)}
                    />
                  </div>
                </div>
              </Container>

              <Container header={<Header variant="h2">Payment & Invoicing</Header>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Static Pay Rate (GBP)</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={settings.generalSettings.staticPayRate}
                      onChange={(e) => handleInputChange('generalSettings', 'staticPayRate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Standard Pay Rate (GBP) (Special Events)</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={settings.generalSettings.standardPayRate}
                      onChange={(e) => handleInputChange('generalSettings', 'standardPayRate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={settings.generalSettings.defaultPaymentTerms}
                      onChange={(e) => handleInputChange('generalSettings', 'defaultPaymentTerms', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
                    <input
                      type="text"
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      value={settings.generalSettings.invoicePrefix}
                      onChange={(e) => handleInputChange('generalSettings', 'invoicePrefix', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <ToggleSwitch
                    label="Automatic Invoice Generation"
                    checked={settings.generalSettings.automaticInvoicing}
                    onChange={(checked) => handleInputChange('generalSettings', 'automaticInvoicing', checked)}
                  />
                </div>
              </Container>
            </SpaceBetween>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <SpaceBetween size="l">
              <Container header={<Header variant="h2">Notification Channels</Header>}>
                <ToggleSwitch
                  label="Email Notifications"
                  checked={settings.notificationSettings.emailNotifications}
                  onChange={(checked) => handleInputChange('notificationSettings', 'emailNotifications', checked)}
                />
                <ToggleSwitch
                  label="SMS Notifications"
                  checked={settings.notificationSettings.smsNotifications}
                  onChange={(checked) => handleInputChange('notificationSettings', 'smsNotifications', checked)}
                />
              </Container>

              <Container header={<Header variant="h2">Notification Types</Header>}>
                <ToggleSwitch
                  label="Shift Reminders"
                  checked={settings.notificationSettings.shiftReminders}
                  onChange={(checked) => handleInputChange('notificationSettings', 'shiftReminders', checked)}
                />
                <ToggleSwitch
                  label="Invoice Reminders"
                  checked={settings.notificationSettings.invoiceReminders}
                  onChange={(checked) => handleInputChange('notificationSettings', 'invoiceReminders', checked)}
                />
                <ToggleSwitch
                  label="Automatic Report Generation"
                  checked={settings.notificationSettings.reportGeneration}
                  onChange={(checked) => handleInputChange('notificationSettings', 'reportGeneration', checked)}
                />
              </Container>
            </SpaceBetween>
          )}

          {/* Integration */}
          {activeTab === 'integration' && (
            <Container header={<Header variant="h2">Deputy Integration</Header>}>
              <SpaceBetween size="m">
                <ToggleSwitch
                  label="Enable Deputy Integration"
                  checked={settings.integrationSettings.deputyEnabled}
                  onChange={(checked) => handleInputChange('integrationSettings', 'deputyEnabled', checked)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deputy API Key</label>
                  <input
                    type="password"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                    value={settings.integrationSettings.deputyApiKey}
                    onChange={(e) => handleInputChange('integrationSettings', 'deputyApiKey', e.target.value)}
                    disabled={!settings.integrationSettings.deputyEnabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deputy Domain</label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                    value={settings.integrationSettings.deputyDomain}
                    onChange={(e) => handleInputChange('integrationSettings', 'deputyDomain', e.target.value)}
                    disabled={!settings.integrationSettings.deputyEnabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sync Frequency</label>
                  <select
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                    value={settings.integrationSettings.syncFrequency}
                    onChange={(e) => handleInputChange('integrationSettings', 'syncFrequency', e.target.value)}
                    disabled={!settings.integrationSettings.deputyEnabled}
                  >
                    {syncFrequencyOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </SpaceBetween>
            </Container>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <SpaceBetween size="l">
              <Container header={<Header variant="h2">Shift Security Requirements</Header>}>
                <ToggleSwitch
                  label="Require Staff Signatures"
                  checked={settings.securitySettings.requireSignatures}
                  onChange={(checked) => handleInputChange('securitySettings', 'requireSignatures', checked)}
                />
                <ToggleSwitch
                  label="Require Manager Approval"
                  checked={settings.securitySettings.requireManagerApproval}
                  onChange={(checked) => handleInputChange('securitySettings', 'requireManagerApproval', checked)}
                />
                <ToggleSwitch
                  label="Require Shift Photos"
                  checked={settings.securitySettings.requireShiftPhotos}
                  onChange={(checked) => handleInputChange('securitySettings', 'requireShiftPhotos', checked)}
                />
              </Container>

              <Container header={<Header variant="h2">Portal Security</Header>}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout</label>
                  <select
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    value={settings.securitySettings.sessionTimeout}
                    onChange={(e) => handleInputChange('securitySettings', 'sessionTimeout', e.target.value)}
                  >
                    {sessionTimeoutOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <ToggleSwitch
                  label="Allow Staff Shift Exchange"
                  checked={settings.securitySettings.allowShiftExchange}
                  onChange={(checked) => handleInputChange('securitySettings', 'allowShiftExchange', checked)}
                />
              </Container>
            </SpaceBetween>
          )}

          {/* Employment Types */}
          {activeTab === 'employment' && (
            <EmploymentTypesManagement key="employment-types" />
          )}

          {/* Finance Integrations */}
          {activeTab === 'finance' && (
            <Container header={<Header variant="h2">Accounting Software Connections</Header>}>
              <p className="text-sm text-gray-600 mb-4">
                Manage connections to accounting software for automated invoice and payroll sync.
              </p>

              {financeLoading ? (
                <div className="flex justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-red-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : financeConnections.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.486a4.5 4.5 0 00-6.364-6.364L4.5 6.394" />
                  </svg>
                  <p className="text-base font-medium text-gray-900 mb-1">No accounting connections configured</p>
                  <p className="text-sm text-gray-500 mb-4">Set up accounting integrations in the Finance Integrations page.</p>
                  <button
                    onClick={() => window.location.href = '/admin/finance-integrations'}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Go to Finance Integrations
                  </button>
                </div>
              ) : (
                <SpaceBetween size="m">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      Connected Providers ({financeConnections.length})
                    </p>
                    <button
                      onClick={() => window.location.href = '/admin/finance-integrations'}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Manage All Connections
                    </button>
                  </div>

                  <CloudscapeTable
                    columnDefinitions={[
                      {
                        id: 'provider',
                        header: 'Provider',
                        cell: (item: ProviderConnection) => (
                          <div className="flex items-center gap-2">
                            <img
                              src={financeIntegrationsService.getProviderLogo(item.provider_key)}
                              alt={item.provider_name}
                              className="w-6 h-6"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <span className="text-sm">{item.provider_name}</span>
                          </div>
                        ),
                      },
                      {
                        id: 'company',
                        header: 'Company',
                        cell: (item: ProviderConnection) => item.company_name || '-',
                      },
                      {
                        id: 'status',
                        header: 'Status',
                        cell: (item: ProviderConnection) => (
                          <div className="flex items-center gap-2">
                            <StatusIndicator type={item.status === 'connected' ? 'success' : item.status === 'pending' ? 'warning' : 'error'}>
                              {item.status}
                            </StatusIndicator>
                            {item.is_sandbox && <span className="text-xs text-amber-600">(Sandbox)</span>}
                          </div>
                        ),
                      },
                      {
                        id: 'lastSync',
                        header: 'Last Sync',
                        cell: (item: ProviderConnection) => item.last_sync_at ? new Date(item.last_sync_at).toLocaleDateString() : 'Never',
                      },
                      {
                        id: 'actions',
                        header: 'Actions',
                        cell: (item: ProviderConnection) => (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleTestConnection(item)}
                              disabled={financeLoading}
                              className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              Test
                            </button>
                            <button
                              onClick={() => handleDeleteConnection(item)}
                              disabled={financeLoading}
                              className="text-sm text-gray-500 hover:text-red-600 font-medium disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        ),
                      },
                    ]}
                    items={financeConnections}
                    empty="No connections found."
                  />

                  <Alert type="info">
                    Finance integrations allow automatic export of invoices and payroll to your accounting software.
                    You can export data from the Invoice Management page.
                  </Alert>
                </SpaceBetween>
              )}
            </Container>
          )}
        </>
      )}
    </SpaceBetween>
  );
};

export default Settings;
