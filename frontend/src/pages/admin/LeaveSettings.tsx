import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services';
import api from '../../services/api';
import {
  LeaveType
} from '../../types/leave';
import AccrualSettings from '../../components/leave/AccrualSettings';
import BlackoutPeriodManager from '../../components/leave/BlackoutPeriodManager';
import NotificationSettings from '../../components/leave/NotificationSettings';
import { Header, Container, SpaceBetween, StatusIndicator, EmptyState } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';

interface AccrualSettingsData {
  default_accrual_method: 'monthly' | 'annual' | 'per_shift' | 'length_of_service';
  global_accrual_rate: string;
  max_accrual_per_year: string;
  max_balance_limit: string;
  accrual_frequency: 'monthly' | 'bi_weekly' | 'weekly' | 'daily';
  accrual_start_day: number;
  enable_pro_rating: boolean;
  pro_rating_method: 'daily' | 'monthly' | 'anniversary';
  default_carryover_method: 'none' | 'full' | 'partial' | 'use_or_lose';
  carryover_limit: string;
  carryover_expiry_months: number;
  leave_year_start_month: number;
  leave_year_start_day: number;
  enable_negative_balance: boolean;
  negative_balance_limit: string;
  auto_approve_negative: boolean;
  rounding_method: 'none' | 'up' | 'down' | 'nearest';
  rounding_precision: number;
  exclude_weekends_from_accrual: boolean;
  exclude_holidays_from_accrual: boolean;
  notify_balance_low: boolean;
  balance_low_threshold: string;
  notify_accrual_processed: boolean;
}

interface BlackoutPeriod {
  id?: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  venue?: number | null;
  leave_types: number[];
  restriction_level: 'no_requests' | 'emergency_only' | 'manager_approval' | 'limit_percentage';
  max_staff_percentage?: number | null;
  allow_manager_override: boolean;
  override_reason_required: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface NotificationSettingsData {
  email_notifications: boolean;
  sms_notifications: boolean;
  manager_approval_notifications: boolean;
  employee_request_notifications: boolean;
  balance_threshold_notifications: boolean;
  accrual_processing_notifications: boolean;
  reminder_days_before: number;
  digest_frequency: 'daily' | 'weekly' | 'monthly';
}

interface SystemHealthData {
  accrual_engine: {
    status: string;
    last_run: string | null;
    next_run: string;
  };
  notifications: {
    status: string;
    pending_count: number;
    queue_status: string;
  };
  database: {
    status: string;
    response_time: string;
    connection_pool: string;
  };
  statistics: {
    total_leave_requests: number;
    pending_approvals: number;
  };
  last_updated: string;
}

const LeaveSettings: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [accrualSettings, setAccrualSettings] = useState<AccrualSettingsData | null>(null);
  const [blackoutPeriods, setBlackoutPeriods] = useState<BlackoutPeriod[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsData | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'accrual' | 'blackout' | 'notifications' | 'integration' | 'health'>('accrual');

  // Fetch all settings data
  const fetchSettingsData = useCallback(async () => {
    if (!authState.user) return;

    setIsLoading(true);
    try {
      // Fetch settings data in parallel
      const [leaveTypesResponse, accrualResponse, blackoutResponse, notificationResponse, healthResponse] = await Promise.all([
        leaveService.getLeaveTypes(false), // Include inactive types
        fetchAccrualSettings(),
        fetchBlackoutPeriods(),
        fetchNotificationSettings(),
        fetchSystemHealth()
      ]);

      setLeaveTypes(leaveTypesResponse);
      setAccrualSettings(accrualResponse);
      setBlackoutPeriods(blackoutResponse);
      setNotificationSettings(notificationResponse);
      setSystemHealth(healthResponse);

    } catch (error) {
      console.error('Error fetching settings data:', error);
      addFlash({ type: 'error', content: 'Failed to load settings data. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [authState.user]);

  // Fetch accrual settings
  const fetchAccrualSettings = async (): Promise<AccrualSettingsData> => {
    try {
      const { data } = await api.get('/api/v1/leave/settings/system_config/');
      return data.accrual_settings || getDefaultAccrualSettings();
    } catch (error) {
      console.error('Error fetching accrual settings:', error);
      return getDefaultAccrualSettings();
    }
  };

  // Fetch blackout periods
  const fetchBlackoutPeriods = async (): Promise<BlackoutPeriod[]> => {
    try {
      const { data } = await api.get('/api/v1/leave/blackout-periods/');
      return data.results || data || [];
    } catch (error) {
      console.error('Error fetching blackout periods:', error);
      return [];
    }
  };

  // Fetch notification settings
  const fetchNotificationSettings = async (): Promise<NotificationSettingsData> => {
    try {
      const { data } = await api.get('/api/v1/leave/settings/notifications/');
      return data || getDefaultNotificationSettings();
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return getDefaultNotificationSettings();
    }
  };

  // Fetch system health
  const fetchSystemHealth = async (): Promise<SystemHealthData | null> => {
    try {
      const { data } = await api.get('/api/v1/leave/settings/system_health/');
      return data;
    } catch (error) {
      console.error('Error fetching system health:', error);
      return null;
    }
  };

  // Default settings
  const getDefaultAccrualSettings = (): AccrualSettingsData => ({
    default_accrual_method: 'monthly',
    global_accrual_rate: '1.67',
    max_accrual_per_year: '25',
    max_balance_limit: '40',
    accrual_frequency: 'monthly',
    accrual_start_day: 1,
    enable_pro_rating: true,
    pro_rating_method: 'daily',
    default_carryover_method: 'partial',
    carryover_limit: '5',
    carryover_expiry_months: 12,
    leave_year_start_month: 1,
    leave_year_start_day: 1,
    enable_negative_balance: false,
    negative_balance_limit: '5',
    auto_approve_negative: false,
    rounding_method: 'nearest',
    rounding_precision: 2,
    exclude_weekends_from_accrual: false,
    exclude_holidays_from_accrual: false,
    notify_balance_low: true,
    balance_low_threshold: '3',
    notify_accrual_processed: false,
  });

  const getDefaultNotificationSettings = (): NotificationSettingsData => ({
    email_notifications: true,
    sms_notifications: false,
    manager_approval_notifications: true,
    employee_request_notifications: true,
    balance_threshold_notifications: true,
    accrual_processing_notifications: false,
    reminder_days_before: 7,
    digest_frequency: 'weekly',
  });

  // Initial load
  useEffect(() => {
    fetchSettingsData();
  }, [fetchSettingsData, refreshTrigger]);

  // Handle accrual settings save
  const handleSaveAccrualSettings = useCallback(async (settings: AccrualSettingsData) => {
    try {
      await api.put('/api/v1/leave/settings/system_config/', { accrual_settings: settings });
      setAccrualSettings(settings);
      addFlash({ type: 'success', content: 'Accrual settings saved successfully!' });
    } catch (error) {
      console.error('Error saving accrual settings:', error);
      throw error;
    }
  }, []);

  // Handle notification settings save
  const handleSaveNotificationSettings = useCallback(async (settings: NotificationSettingsData) => {
    try {
      await api.put('/api/v1/leave/settings/notifications/', settings);
      setNotificationSettings(settings);
      addFlash({ type: 'success', content: 'Notification settings saved successfully!' });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      throw error;
    }
  }, []);

  // Handle blackout period save
  const handleSaveBlackoutPeriod = useCallback(async (period: BlackoutPeriod) => {
    try {
      const url = period.id
        ? `/api/v1/leave/blackout-periods/${period.id}/`
        : '/api/v1/leave/blackout-periods/';

      // Transform leave_types to leave_type_ids for the API
      const { leave_types, ...periodData } = period;
      const requestData = {
        ...periodData,
        leave_type_ids: leave_types
      };

      const { data: savedPeriod } = period.id
        ? await api.put(url, requestData)
        : await api.post(url, requestData);

      if (period.id) {
        setBlackoutPeriods(prev => prev.map(p => p.id === period.id ? savedPeriod : p));
      } else {
        setBlackoutPeriods(prev => [...prev, savedPeriod]);
      }
    } catch (error) {
      console.error('Error saving blackout period:', error);
      throw error;
    }
  }, []);

  // Handle blackout period delete
  const handleDeleteBlackoutPeriod = useCallback(async (periodId: number) => {
    try {
      await api.delete(`/api/v1/leave/blackout-periods/${periodId}/`);
      setBlackoutPeriods(prev => prev.filter(p => p.id !== periodId));
    } catch (error) {
      console.error('Error deleting blackout period:', error);
      throw error;
    }
  }, []);

  // Handle blackout period activation toggle
  const handleActivateBlackoutPeriod = useCallback(async (periodId: number, isActive: boolean) => {
    try {
      const { data: updatedPeriod } = await api.patch(`/api/v1/leave/blackout-periods/${periodId}/`, { is_active: isActive });
      setBlackoutPeriods(prev => prev.map(p => p.id === periodId ? updatedPeriod : p));
    } catch (error) {
      console.error('Error updating blackout period status:', error);
      throw error;
    }
  }, []);

  // Handle reset to defaults
  const handleResetToDefaults = useCallback(async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all settings to their default values?\n\n' +
      'This will reset:\n' +
      '- Accrual settings\n' +
      '- Notification settings\n\n' +
      'Blackout periods and leave types will not be affected.\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setIsLoading(true);

      // Reset accrual settings
      const defaultAccrualSettings = getDefaultAccrualSettings();
      await handleSaveAccrualSettings(defaultAccrualSettings);

      // Reset notification settings
      const defaultNotificationSettings = getDefaultNotificationSettings();
      await handleSaveNotificationSettings(defaultNotificationSettings);

      addFlash({ type: 'success', content: 'All settings have been reset to default values!' });
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error resetting to defaults:', error);
      addFlash({ type: 'error', content: 'Failed to reset settings. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [handleSaveAccrualSettings, handleSaveNotificationSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading leave system settings...</span>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'accrual', label: 'Accrual Settings' },
    { key: 'blackout', label: 'Blackout Periods' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'integration', label: 'Integration' },
    { key: 'health', label: 'System Health' },
  ] as const;

  return (
    <div className="max-w-7xl">
      <SpaceBetween size="l">
        {/* Page Header */}
        <Header
          variant="h1"
          description="Configure global leave management system settings and policies"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetToDefaults}
                disabled={isLoading}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Reset to Defaults
              </button>
              <button
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          }
        >
          Leave System Settings
        </Header>

        <Flashbar items={flashItems} onDismiss={removeFlash} />

        {/* Settings Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Container>
            <SpaceBetween size="xs">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Accrual Method</p>
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-red-600">
                {accrualSettings?.default_accrual_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Monthly'}
              </p>
              <p className="text-xs text-gray-500">Default accrual method</p>
            </SpaceBetween>
          </Container>

          <Container>
            <SpaceBetween size="xs">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Global Rate</p>
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
              <p className="text-lg font-bold text-green-600">{accrualSettings?.global_accrual_rate || '1.67'} days</p>
              <p className="text-xs text-gray-500">Per period</p>
            </SpaceBetween>
          </Container>

          <Container>
            <SpaceBetween size="xs">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Blackout Periods</p>
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <p className="text-lg font-bold text-red-600">{blackoutPeriods.filter(bp => bp.is_active).length}</p>
              <p className="text-xs text-gray-500">Active periods</p>
            </SpaceBetween>
          </Container>

          <Container>
            <SpaceBetween size="xs">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Leave Types</p>
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-orange-600">{leaveTypes.filter(lt => lt.is_active).length}</p>
              <p className="text-xs text-gray-500">Available types</p>
            </SpaceBetween>
          </Container>
        </div>

        {/* Settings Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={
                  activeTab === tab.key
                    ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600'
                    : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                }
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'accrual' && accrualSettings && (
          <AccrualSettings
            initialSettings={accrualSettings}
            onSave={handleSaveAccrualSettings}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'blackout' && (
          <BlackoutPeriodManager
            periods={blackoutPeriods}
            leaveTypes={leaveTypes}
            onSave={handleSaveBlackoutPeriod}
            onDelete={handleDeleteBlackoutPeriod}
            onActivate={handleActivateBlackoutPeriod}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'notifications' && notificationSettings && (
          <NotificationSettings
            initialSettings={notificationSettings}
            onSave={handleSaveNotificationSettings}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'integration' && (
          <Container>
            <SpaceBetween size="m">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">External Integrations</h3>
              </div>
              <EmptyState
                title="Integration settings coming soon"
                description="Configure integrations with payroll systems, calendar applications, and other workforce management tools."
                icon={
                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                }
              />
            </SpaceBetween>
          </Container>
        )}

        {activeTab === 'health' && (
          <Container>
            <SpaceBetween size="m">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">System Health & Diagnostics</h3>
                </div>
                {systemHealth && (
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date(systemHealth.last_updated).toLocaleString()}
                  </p>
                )}
              </div>

              {!systemHealth ? (
                <div className="flex justify-center py-8">
                  <div className="flex items-center gap-3 text-gray-500">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">Loading system health data...</span>
                  </div>
                </div>
              ) : (
                <SpaceBetween size="m">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Accrual Engine */}
                    <div className={`p-4 rounded-lg border ${
                      systemHealth.accrual_engine.status === 'healthy'
                        ? 'bg-green-50 border-green-200'
                        : systemHealth.accrual_engine.status === 'not_configured'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <StatusIndicator type={systemHealth.accrual_engine.status === 'healthy' ? 'success' : 'error'}>
                            Accrual Engine
                          </StatusIndicator>
                        </div>
                        <p className="text-xs text-gray-600 capitalize">
                          {systemHealth.accrual_engine.status.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {systemHealth.accrual_engine.last_run
                            ? `Last run: ${new Date(systemHealth.accrual_engine.last_run).toLocaleString()}`
                            : 'Not yet run'
                          }
                        </p>
                        <p className="text-xs text-gray-500">
                          Next: {systemHealth.accrual_engine.next_run}
                        </p>
                      </div>
                    </div>

                    {/* Notifications */}
                    <div className={`p-4 rounded-lg border ${
                      systemHealth.notifications.status === 'operational'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="space-y-2">
                        <StatusIndicator type={systemHealth.notifications.status === 'operational' ? 'success' : 'error'}>
                          Notifications
                        </StatusIndicator>
                        <p className="text-xs text-gray-600 capitalize">
                          {systemHealth.notifications.status}
                        </p>
                        <p className="text-xs text-gray-500">
                          Queue: {systemHealth.notifications.pending_count} pending
                        </p>
                        <p className="text-xs text-gray-500">
                          Status: {systemHealth.notifications.queue_status}
                        </p>
                      </div>
                    </div>

                    {/* Database */}
                    <div className={`p-4 rounded-lg border ${
                      systemHealth.database.status === 'healthy'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="space-y-2">
                        <StatusIndicator type={systemHealth.database.status === 'healthy' ? 'success' : 'error'}>
                          Database
                        </StatusIndicator>
                        <p className="text-xs text-gray-600 capitalize">
                          {systemHealth.database.status}
                        </p>
                        <p className="text-xs text-gray-500">
                          Response time: {systemHealth.database.response_time}
                        </p>
                        <p className="text-xs text-gray-500">
                          Pool: {systemHealth.database.connection_pool}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-900 mb-3">System Statistics</p>
                    <div className="flex gap-12">
                      <div>
                        <p className="text-xs text-gray-500">Total Leave Requests</p>
                        <p className="text-xl font-bold text-red-600">{systemHealth.statistics.total_leave_requests}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pending Approvals</p>
                        <p className="text-xl font-bold text-orange-600">{systemHealth.statistics.pending_approvals}</p>
                      </div>
                    </div>
                  </div>
                </SpaceBetween>
              )}
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </div>
  );
};

export default LeaveSettings;
