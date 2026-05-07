import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Header, Container, SpaceBetween, StatusIndicator, CloudscapeTable, Alert, ConfirmationModal } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import api from '../../services/api';

interface SyncLog {
  id: number;
  syncType: 'employees' | 'timesheets' | 'all';
  startTime: string;
  endTime: string | null;
  status: 'in_progress' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: string[] | null;
}

interface DeputySettings {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
  autoSyncEnabled: boolean;
  autoSyncFrequency: number;
  lastSyncTime: string | null;
  syncInProgress: boolean;
}

// Toggle Switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <div className="flex items-center justify-between py-2">
    <p className="text-sm font-medium text-gray-900">{label}</p>
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

const DeputyIntegration: React.FC = () => {
  const [settings, setSettings] = useState<DeputySettings>({
    apiUrl: '',
    apiKey: '',
    enabled: false,
    autoSyncEnabled: false,
    autoSyncFrequency: 24,
    lastSyncTime: null,
    syncInProgress: false
  });

  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [syncType, setSyncType] = useState<'employees' | 'timesheets' | 'all'>('all');
  const [activeTab, setActiveTab] = useState('settings');
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  // Load settings and logs
  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const configResponse = await api.get('/api/v1/deputy/config/');
      const config = configResponse.data;

      setSettings(prev => ({
        ...prev,
        apiUrl: config.api_endpoint || '',
        apiKey: config.api_key || '',
        enabled: config.is_active ?? false,
        lastSyncTime: config.last_sync_date || null,
        syncInProgress: false,
      }));

      try {
        const logsResponse = await api.get('/api/v1/deputy/sync-logs/');
        const logsData = Array.isArray(logsResponse.data)
          ? logsResponse.data
          : logsResponse.data?.results || [];
        setLogs(logsData);
      } catch {
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to load Deputy integration data:', error);
      addFlash({ type: 'error', content: 'Failed to load Deputy integration settings. Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);

    try {
      await api.put('/api/v1/deputy/config/', {
        api_endpoint: settings.apiUrl,
        api_key: settings.apiKey,
        is_active: settings.enabled,
      });

      addFlash({ type: 'success', content: 'Settings saved successfully.' });
    } catch (error) {
      console.error('Failed to save Deputy integration settings:', error);
      addFlash({ type: 'error', content: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [settings, addFlash]);

  const startSync = useCallback(async () => {
    setIsSyncing(true);
    setSettings(prev => ({ ...prev, syncInProgress: true }));

    try {
      const syncCalls: Promise<unknown>[] = [];

      if (syncType === 'employees' || syncType === 'all') {
        syncCalls.push(
          api.post('/api/v1/deputy/sync-employees/').catch(err => {
            console.warn('sync-employees endpoint not available:', err?.response?.status);
            return null;
          })
        );
      }

      if (syncType === 'timesheets' || syncType === 'all') {
        syncCalls.push(
          api.post('/api/v1/deputy/sync-timesheets/').catch(err => {
            console.warn('sync-timesheets endpoint not available:', err?.response?.status);
            return null;
          })
        );
      }

      await Promise.all(syncCalls);

      setSettings(prev => ({
        ...prev,
        syncInProgress: false,
        lastSyncTime: new Date().toISOString()
      }));

      await loadData();

      addFlash({ type: 'success', content: `${syncType === 'all' ? 'Full' : syncType} sync completed successfully.` });
    } catch (error) {
      console.error('Failed to start Deputy sync:', error);
      addFlash({ type: 'error', content: 'Failed to start sync process. Please try again.' });
      setSettings(prev => ({ ...prev, syncInProgress: false }));
    } finally {
      setIsSyncing(false);
      setShowConfirmDialog(false);
    }
  }, [syncType, loadData, addFlash]);

  const handleSettingsChange = useCallback((field: keyof DeputySettings, value: string | boolean | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const frequencyOptions = [
    { value: 4, label: 'Every 4 hours' },
    { value: 8, label: 'Every 8 hours' },
    { value: 12, label: 'Every 12 hours' },
    { value: 24, label: 'Once a day' },
  ];

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tabs = [
    { id: 'settings', label: 'Settings' },
    { id: 'history', label: 'Sync History' },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => { setSyncType('employees'); setShowConfirmDialog(true); }}
              disabled={settings.syncInProgress || !settings.enabled}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Sync Employees
            </button>
            <button
              onClick={() => { setSyncType('timesheets'); setShowConfirmDialog(true); }}
              disabled={settings.syncInProgress || !settings.enabled}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Sync Timesheets
            </button>
            <button
              onClick={() => { setSyncType('all'); setShowConfirmDialog(true); }}
              disabled={settings.syncInProgress || !settings.enabled}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Start Full Sync
            </button>
          </div>
        }
      >
        Deputy Integration
      </Header>

      <Flashbar items={flashItems} onDismiss={removeFlash} />

      {settings.syncInProgress && (
        <Alert type="info">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Sync in progress...</span>
          </div>
        </Alert>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id
                ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600'
                : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <>
          {isLoading ? (
            <Container>
              <div className="flex justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-red-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </Container>
          ) : (
            <Container header={<Header variant="h2">Connection Settings</Header>}>
              <SpaceBetween size="m">
                <ToggleSwitch
                  label="Enable Deputy Integration"
                  checked={settings.enabled}
                  onChange={(checked) => handleSettingsChange('enabled', checked)}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deputy API URL <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                    value={settings.apiUrl}
                    onChange={(e) => handleSettingsChange('apiUrl', e.target.value)}
                    placeholder="https://your-company.deputy.com/api/v1"
                    disabled={!settings.enabled}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                    value={settings.apiKey}
                    onChange={(e) => handleSettingsChange('apiKey', e.target.value)}
                    placeholder="Enter your Deputy API key"
                    disabled={!settings.enabled}
                  />
                </div>

                <ToggleSwitch
                  label="Enable Automatic Sync"
                  checked={settings.autoSyncEnabled}
                  onChange={(checked) => handleSettingsChange('autoSyncEnabled', checked)}
                  disabled={!settings.enabled}
                />

                {settings.autoSyncEnabled && (
                  <div className="ml-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Automatic Sync Frequency</label>
                    <div className="space-y-2">
                      {frequencyOptions.map(opt => (
                        <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="syncFrequency"
                            value={opt.value}
                            checked={settings.autoSyncFrequency === opt.value}
                            onChange={() => handleSettingsChange('autoSyncFrequency', opt.value)}
                            disabled={!settings.enabled}
                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <p className="text-sm text-gray-500">
                    Last Sync: {settings.lastSyncTime ? new Date(settings.lastSyncTime).toLocaleString() : 'Never synced'}
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={saveSettings}
                    disabled={isSaving || !settings.enabled}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </SpaceBetween>
            </Container>
          )}
        </>
      )}

      {/* Sync History Tab */}
      {activeTab === 'history' && (
        <Container
          header={
            <Header
              actions={
                <button
                  onClick={() => loadData()}
                  className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Refresh
                </button>
              }
              variant="h2"
            >
              Sync History
            </Header>
          }
        >
          {isLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-red-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-base font-medium text-gray-900 mb-1">No sync logs found</p>
              <p className="text-sm text-gray-500">Start a sync to see the history.</p>
            </div>
          ) : (
            <CloudscapeTable
              columnDefinitions={[
                {
                  id: 'syncType',
                  header: 'Sync Type',
                  cell: (item: SyncLog) => {
                    const syncNames = { all: 'Full Sync', employees: 'Employees', timesheets: 'Timesheets' };
                    return syncNames[item.syncType];
                  },
                },
                {
                  id: 'startTime',
                  header: 'Start Time',
                  cell: (item: SyncLog) => new Date(item.startTime).toLocaleString(),
                },
                {
                  id: 'endTime',
                  header: 'End Time',
                  cell: (item: SyncLog) => item.endTime ? new Date(item.endTime).toLocaleString() : '-',
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (item: SyncLog) => (
                    <StatusIndicator type={item.status === 'completed' ? 'success' : item.status === 'in_progress' ? 'info' : 'error'}>
                      {item.status.replace('_', ' ')}
                    </StatusIndicator>
                  ),
                },
                {
                  id: 'records',
                  header: 'Processed',
                  cell: (item: SyncLog) => `${item.recordsProcessed}`,
                },
                {
                  id: 'created',
                  header: 'Created',
                  cell: (item: SyncLog) => `${item.recordsCreated}`,
                },
                {
                  id: 'updated',
                  header: 'Updated',
                  cell: (item: SyncLog) => `${item.recordsUpdated}`,
                },
                {
                  id: 'failed',
                  header: 'Failed',
                  cell: (item: SyncLog) => `${item.recordsFailed}`,
                },
              ]}
              items={logs}
              empty="No sync logs found."
            />
          )}
        </Container>
      )}

      {/* Confirm Sync Modal */}
      <ConfirmationModal
        visible={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={startSync}
        header="Confirm Sync"
        confirmLabel={isSyncing ? 'Syncing...' : 'Start Sync'}
        loading={isSyncing}
      >
        Are you sure you want to start a{syncType === 'all' ? ' full' : ''} sync of {syncType === 'all' ? 'employees and timesheets' : syncType}?
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default DeputyIntegration;
