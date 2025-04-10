import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  TextField,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  ProgressIndicator,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  Label,
  Toggle,
  CommandBar,
  type ICommandBarItemProps,
  Dialog,
  DialogType,
  DialogFooter,
  ChoiceGroup,
  type IChoiceGroupOption
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { deputyService } from '../../services';

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
  autoSyncFrequency: number; // in hours
  lastSyncTime: string | null;
  syncInProgress: boolean;
}

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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [syncType, setSyncType] = useState<'employees' | 'timesheets' | 'all'>('all');

  // Load settings and logs
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real app, this would call the API
      // const settingsResponse = await deputyService.getSettings();
      // const logsResponse = await deputyService.getSyncLogs();

      // For demo purposes, use mock data
      const mockSettings: DeputySettings = {
        apiUrl: 'https://mycompany.deputy.com/api/v1',
        apiKey: '••••••••••••••••••••••••••••••',
        enabled: true,
        autoSyncEnabled: true,
        autoSyncFrequency: 12,
        lastSyncTime: '2025-04-08T22:15:00Z',
        syncInProgress: false
      };

      const mockLogs: SyncLog[] = [
        {
          id: 1,
          syncType: 'all',
          startTime: '2025-04-08T22:15:00Z',
          endTime: '2025-04-08T22:18:43Z',
          status: 'completed',
          recordsProcessed: 52,
          recordsCreated: 3,
          recordsUpdated: 49,
          recordsFailed: 0,
          errors: null
        },
        {
          id: 2,
          syncType: 'timesheets',
          startTime: '2025-04-07T10:00:00Z',
          endTime: '2025-04-07T10:02:15Z',
          status: 'completed',
          recordsProcessed: 25,
          recordsCreated: 25,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: null
        },
        {
          id: 3,
          syncType: 'employees',
          startTime: '2025-04-05T15:30:00Z',
          endTime: '2025-04-05T15:30:45Z',
          status: 'completed',
          recordsProcessed: 30,
          recordsCreated: 0,
          recordsUpdated: 28,
          recordsFailed: 2,
          errors: ['Invalid employee data for ID 123', 'Missing required fields for employee ID 456']
        },
        {
          id: 4,
          syncType: 'all',
          startTime: '2025-04-01T09:00:00Z',
          endTime: '2025-04-01T09:05:23Z',
          status: 'failed',
          recordsProcessed: 10,
          recordsCreated: 5,
          recordsUpdated: 3,
          recordsFailed: 2,
          errors: ['API connection timeout after processing 10 records']
        }
      ];

      setSettings(mockSettings);
      setLogs(mockLogs);
    } catch (error) {
      console.error('Failed to load Deputy integration data:', error);
      setError('Failed to load Deputy integration settings. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings
  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // In a real app, this would call the API
      // await deputyService.updateSettings(settings);

      // For demo purposes, just wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSuccessMessage('Settings saved successfully');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Failed to save Deputy integration settings:', error);
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Start sync process
  const startSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // In a real app, this would call the API
      // await deputyService.startSync(syncType);

      // For demo purposes, just simulate a sync
      // First update our local state to show sync in progress
      setSettings(prev => ({ ...prev, syncInProgress: true }));

      // Add a new log entry for the sync
      const newLog: SyncLog = {
        id: Math.max(...logs.map(log => log.id), 0) + 1,
        syncType,
        startTime: new Date().toISOString(),
        endTime: null,
        status: 'in_progress',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: null
      };

      setLogs([newLog, ...logs]);

      // Simulate progress and completion after a delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update the log with completion status
      const updatedLogs = [...logs];
      updatedLogs.unshift({
        ...newLog,
        endTime: new Date().toISOString(),
        status: 'completed',
        recordsProcessed: 45,
        recordsCreated: 5,
        recordsUpdated: 40,
        recordsFailed: 0
      });

      setLogs(updatedLogs);
      setSettings(prev => ({
        ...prev,
        syncInProgress: false,
        lastSyncTime: new Date().toISOString()
      }));

      setSuccessMessage(`${syncType === 'all' ? 'Full' : syncType} sync completed successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Failed to start Deputy sync:', error);
      setError('Failed to start sync process. Please try again.');

      // Update to show sync failed
      setSettings(prev => ({ ...prev, syncInProgress: false }));
    } finally {
      setIsSyncing(false);
      setShowConfirmDialog(false);
    }
  }, [syncType, logs]);

  // Handle form input changes
  const handleSettingsChange = useCallback((field: keyof DeputySettings, value: string | boolean | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle sync frequency choice
  const handleFrequencyChange = useCallback((ev?: React.FormEvent<HTMLElement | HTMLInputElement>, option?: IChoiceGroupOption) => {
    if (option) {
      handleSettingsChange('autoSyncFrequency', Number(option.key));
    }
  }, [handleSettingsChange]);

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'sync',
      text: 'Start Sync',
      iconProps: { iconName: 'Sync' },
      disabled: settings.syncInProgress || !settings.enabled,
      onClick: () => {
        setSyncType('all');
        setShowConfirmDialog(true);
        return false;
      },
    },
    {
      key: 'syncEmployees',
      text: 'Sync Employees Only',
      iconProps: { iconName: 'People' },
      disabled: settings.syncInProgress || !settings.enabled,
      onClick: () => {
        setSyncType('employees');
        setShowConfirmDialog(true);
        return false;
      },
    },
    {
      key: 'syncTimesheets',
      text: 'Sync Timesheets Only',
      iconProps: { iconName: 'Calendar' },
      disabled: settings.syncInProgress || !settings.enabled,
      onClick: () => {
        setSyncType('timesheets');
        setShowConfirmDialog(true);
        return false;
      },
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: () => {
        loadData();
        return false;
      },
    },
  ];

  // Set up columns for the logs DetailsList
  const logColumns: IColumn[] = [
    {
      key: 'syncType',
      name: 'Sync Type',
      fieldName: 'syncType',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: SyncLog) => {
        const syncNames = {
          all: 'Full Sync',
          employees: 'Employees',
          timesheets: 'Timesheets'
        };
        return <Text>{syncNames[item.syncType]}</Text>;
      }
    },
    {
      key: 'startTime',
      name: 'Start Time',
      fieldName: 'startTime',
      minWidth: 150,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: SyncLog) => <Text>{new Date(item.startTime).toLocaleString()}</Text>,
    },
    {
      key: 'endTime',
      name: 'End Time',
      fieldName: 'endTime',
      minWidth: 150,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: SyncLog) =>
        item.endTime ? <Text>{new Date(item.endTime).toLocaleString()}</Text> : <Text>-</Text>,
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: SyncLog) => {
        const statusColors = {
          in_progress: '#0078D4', // Blue
          completed: '#107C10',   // Green
          failed: '#D13438',      // Red
        };

        return (
          <div
            style={{
              backgroundColor: statusColors[item.status],
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              display: 'inline-block',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}
          >
            {item.status.replace('_', ' ')}
          </div>
        );
      }
    },
    {
      key: 'records',
      name: 'Records',
      minWidth: 120,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: SyncLog) => <Text>{item.recordsProcessed} processed</Text>,
    },
    {
      key: 'created',
      name: 'Created',
      fieldName: 'recordsCreated',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
    },
    {
      key: 'updated',
      name: 'Updated',
      fieldName: 'recordsUpdated',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
    },
    {
      key: 'failed',
      name: 'Failed',
      fieldName: 'recordsFailed',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
    },
  ];

  // Frequency options for auto-sync
  const frequencyOptions: IChoiceGroupOption[] = [
    { key: '4', text: 'Every 4 hours' },
    { key: '8', text: 'Every 8 hours' },
    { key: '12', text: 'Every 12 hours' },
    { key: '24', text: 'Once a day' },
  ];

  // Load data when component mounts
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Deputy Integration</Text>
        </Stack>

        {settings.syncInProgress && (
          <MessageBar messageBarType={MessageBarType.info}>
            <Stack tokens={{ childrenGap: 10 }}>
              <Text>Sync in progress...</Text>
              <ProgressIndicator label="Processing records" />
            </Stack>
          </MessageBar>
        )}

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageBar>
        )}

        {successMessage && (
          <MessageBar
            messageBarType={MessageBarType.success}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setSuccessMessage(null)}
          >
            {successMessage}
          </MessageBar>
        )}

        <Pivot>
          <PivotItem headerText="Settings">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size={SpinnerSize.large} label="Loading settings..." />
              </div>
            ) : (
              <Stack tokens={{ childrenGap: 15 }} className="mt-4">
                <Toggle
                  label="Enable Deputy Integration"
                  checked={settings.enabled}
                  onChange={(_, checked) => handleSettingsChange('enabled', checked || false)}
                  onText="Enabled"
                  offText="Disabled"
                />

                <TextField
                  label="Deputy API URL"
                  required
                  value={settings.apiUrl}
                  onChange={(_, newValue) => handleSettingsChange('apiUrl', newValue || '')}
                  placeholder="https://your-company.deputy.com/api/v1"
                  disabled={!settings.enabled}
                />

                <TextField
                  label="API Key"
                  required
                  type="password"
                  value={settings.apiKey}
                  onChange={(_, newValue) => handleSettingsChange('apiKey', newValue || '')}
                  placeholder="Enter your Deputy API key"
                  canRevealPassword
                  disabled={!settings.enabled}
                />

                <div className="mt-4">
                  <Toggle
                    label="Enable Automatic Sync"
                    checked={settings.autoSyncEnabled}
                    onChange={(_, checked) => handleSettingsChange('autoSyncEnabled', checked || false)}
                    onText="Enabled"
                    offText="Disabled"
                    disabled={!settings.enabled}
                  />
                </div>

                {settings.autoSyncEnabled && (
                  <div className="ml-8 mt-2">
                    <Label>Automatic Sync Frequency</Label>
                    <ChoiceGroup
                      options={frequencyOptions}
                      selectedKey={settings.autoSyncFrequency.toString()}
                      onChange={handleFrequencyChange}
                      disabled={!settings.enabled}
                    />
                  </div>
                )}

                <div className="mt-4">
                  <Label>Last Sync</Label>
                  <Text>
                    {settings.lastSyncTime
                      ? new Date(settings.lastSyncTime).toLocaleString()
                      : 'Never synced'}
                  </Text>
                </div>

                <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end" className="mt-4">
                  <PrimaryButton
                    text="Save Settings"
                    onClick={saveSettings}
                    disabled={isSaving || !settings.enabled}
                  />
                </Stack>
              </Stack>
            )}
          </PivotItem>

          <PivotItem headerText="Sync History">
            <CommandBar items={commandBarItems} className="mt-4" />

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size={SpinnerSize.large} label="Loading sync history..." />
              </div>
            ) : logs.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center mt-4">
                <Text variant="large">No sync logs found</Text>
                <Text>Start a sync to see the history.</Text>
              </div>
            ) : (
              <DetailsList
                items={logs}
                columns={logColumns}
                layoutMode={DetailsListLayoutMode.justified}
                selectionMode={SelectionMode.none}
                className="mt-4"
              />
            )}
          </PivotItem>
        </Pivot>
      </Stack>

      {/* Confirm Sync Dialog */}
      <Dialog
        hidden={!showConfirmDialog}
        onDismiss={() => setShowConfirmDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Confirm Sync',
          subText: `Are you sure you want to start a${syncType === 'all' ? ' full' : ''} sync of ${
            syncType === 'all' ? 'employees and timesheets' : syncType
          }?`
        }}
      >
        <DialogFooter>
          <PrimaryButton
            text="Start Sync"
            onClick={startSync}
            disabled={isSyncing}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setShowConfirmDialog(false)}
            disabled={isSyncing}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default DeputyIntegration;
