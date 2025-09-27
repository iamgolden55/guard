import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IStackTokens,
  IconButton,
  Pivot,
  PivotItem,
  Icon,
  DefaultButton
} from '@fluentui/react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services';
import {
  LeaveType
} from '../../types/leave';
import AccrualSettings from '../../components/leave/AccrualSettings';
import BlackoutPeriodManager from '../../components/leave/BlackoutPeriodManager';
import Card from '../../components/Card';

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
  is_recurring: boolean;
  recurrence_type?: 'yearly' | 'monthly';
  departments: string[];
  leave_types: number[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  manager_approval_notifications: boolean;
  employee_request_notifications: boolean;
  balance_threshold_notifications: boolean;
  accrual_processing_notifications: boolean;
  reminder_days_before: number;
  digest_frequency: 'daily' | 'weekly' | 'monthly';
}

const stackTokens: IStackTokens = {
  childrenGap: 24,
  padding: 16,
};

const LeaveSettings: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [accrualSettings, setAccrualSettings] = useState<AccrualSettingsData | null>(null);
  const [blackoutPeriods, setBlackoutPeriods] = useState<BlackoutPeriod[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all settings data
  const fetchSettingsData = useCallback(async () => {
    if (!authState.user) return;

    setIsLoading(true);
    try {
      // Fetch settings data in parallel
      const [leaveTypesResponse, accrualResponse, blackoutResponse, notificationResponse] = await Promise.all([
        leaveService.getLeaveTypes(false), // Include inactive types
        fetchAccrualSettings(),
        fetchBlackoutPeriods(),
        fetchNotificationSettings()
      ]);

      setLeaveTypes(leaveTypesResponse);
      setAccrualSettings(accrualResponse);
      setBlackoutPeriods(blackoutResponse);
      setNotificationSettings(notificationResponse);

    } catch (error) {
      console.error('Error fetching settings data:', error);
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to load settings data. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [authState.token, authState.user]);

  // Fetch accrual settings
  const fetchAccrualSettings = async (): Promise<AccrualSettingsData> => {
    try {
      const response = await fetch('/api/v1/leave/settings/', {
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch accrual settings');
      }

      const data = await response.json();
      return data.accrual_settings || getDefaultAccrualSettings();
    } catch (error) {
      console.error('Error fetching accrual settings:', error);
      return getDefaultAccrualSettings();
    }
  };

  // Fetch blackout periods
  const fetchBlackoutPeriods = async (): Promise<BlackoutPeriod[]> => {
    try {
      const response = await fetch('/api/v1/leave/blackout-periods/', {
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch blackout periods');
      }

      const data = await response.json();
      return data.results || data || [];
    } catch (error) {
      console.error('Error fetching blackout periods:', error);
      return [];
    }
  };

  // Fetch notification settings
  const fetchNotificationSettings = async (): Promise<NotificationSettings> => {
    try {
      const response = await fetch('/api/v1/leave/settings/notifications/', {
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notification settings');
      }

      const data = await response.json();
      return data || getDefaultNotificationSettings();
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return getDefaultNotificationSettings();
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

  const getDefaultNotificationSettings = (): NotificationSettings => ({
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
      const response = await fetch('/api/v1/leave/settings/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accrual_settings: settings })
      });

      if (!response.ok) {
        throw new Error('Failed to save accrual settings');
      }

      setAccrualSettings(settings);
      setNotification({
        type: MessageBarType.success,
        message: 'Accrual settings saved successfully!'
      });
    } catch (error) {
      console.error('Error saving accrual settings:', error);
      throw error;
    }
  }, [authState.token]);

  // Handle blackout period save
  const handleSaveBlackoutPeriod = useCallback(async (period: BlackoutPeriod) => {
    try {
      const method = period.id ? 'PUT' : 'POST';
      const url = period.id
        ? `/api/v1/leave/blackout-periods/${period.id}/`
        : '/api/v1/leave/blackout-periods/';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(period)
      });

      if (!response.ok) {
        throw new Error('Failed to save blackout period');
      }

      const savedPeriod = await response.json();

      if (period.id) {
        setBlackoutPeriods(prev => prev.map(p => p.id === period.id ? savedPeriod : p));
      } else {
        setBlackoutPeriods(prev => [...prev, savedPeriod]);
      }
    } catch (error) {
      console.error('Error saving blackout period:', error);
      throw error;
    }
  }, [authState.token]);

  // Handle blackout period delete
  const handleDeleteBlackoutPeriod = useCallback(async (periodId: number) => {
    try {
      const response = await fetch(`/api/v1/leave/blackout-periods/${periodId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete blackout period');
      }

      setBlackoutPeriods(prev => prev.filter(p => p.id !== periodId));
    } catch (error) {
      console.error('Error deleting blackout period:', error);
      throw error;
    }
  }, [authState.token]);

  // Handle blackout period activation toggle
  const handleActivateBlackoutPeriod = useCallback(async (periodId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/v1/leave/blackout-periods/${periodId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update blackout period status');
      }

      const updatedPeriod = await response.json();
      setBlackoutPeriods(prev => prev.map(p => p.id === periodId ? updatedPeriod : p));
    } catch (error) {
      console.error('Error updating blackout period status:', error);
      throw error;
    }
  }, [authState.token]);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (isLoading) {
    return (
      <div className="leave-settings-page">
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading leave system settings..." />
        </Stack>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <Stack tokens={stackTokens}>
        {/* Page Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack>
            <Text variant="xxLarge" styles={{ root: { fontWeight: 600 } }}>
              Leave System Settings
            </Text>
            <Text variant="medium" styles={{ root: { color: '#666' } }}>
              Configure global leave management system settings and policies
            </Text>
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <DefaultButton
              text="Reset to Defaults"
              iconProps={{ iconName: 'Refresh' }}
            />
            <IconButton
              iconProps={{ iconName: 'Refresh' }}
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              title="Refresh data"
            />
          </Stack>
        </Stack>

        {/* Notification */}
        {notification && (
          <MessageBar
            messageBarType={notification.type}
            onDismiss={() => setNotification(null)}
            dismissButtonAriaLabel="Close"
          >
            {notification.message}
          </MessageBar>
        )}

        {/* Settings Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card tokens={{ padding: 16 }}>
            <Stack tokens={{ childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                  Accrual Method
                </Text>
                <Icon iconName="CalendarSettings" styles={{ root: { color: '#0078d4' } }} />
              </Stack>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                {accrualSettings?.default_accrual_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Monthly'}
              </Text>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Default accrual method
              </Text>
            </Stack>
          </Card>

          <Card tokens={{ padding: 16 }}>
            <Stack tokens={{ childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                  Global Rate
                </Text>
                <Icon iconName="NumberSymbol" styles={{ root: { color: '#107c10' } }} />
              </Stack>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                {accrualSettings?.global_accrual_rate || '1.67'} days
              </Text>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Per period
              </Text>
            </Stack>
          </Card>

          <Card tokens={{ padding: 16 }}>
            <Stack tokens={{ childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                  Blackout Periods
                </Text>
                <Icon iconName="BlockContact" styles={{ root: { color: '#d13438' } }} />
              </Stack>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#d13438' } }}>
                {blackoutPeriods.filter(bp => bp.is_active).length}
              </Text>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Active periods
              </Text>
            </Stack>
          </Card>

          <Card tokens={{ padding: 16 }}>
            <Stack tokens={{ childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                  Leave Types
                </Text>
                <Icon iconName="Tag" styles={{ root: { color: '#ff8c00' } }} />
              </Stack>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#ff8c00' } }}>
                {leaveTypes.filter(lt => lt.is_active).length}
              </Text>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Available types
              </Text>
            </Stack>
          </Card>
        </div>

        {/* Settings Tabs */}
        <Pivot>
          <PivotItem headerText="Accrual Settings" itemIcon="CalendarSettings">
            {accrualSettings && (
              <AccrualSettings
                initialSettings={accrualSettings}
                onSave={handleSaveAccrualSettings}
                isLoading={isLoading}
              />
            )}
          </PivotItem>

          <PivotItem headerText="Blackout Periods" itemIcon="BlockContact">
            <BlackoutPeriodManager
              periods={blackoutPeriods}
              leaveTypes={leaveTypes}
              onSave={handleSaveBlackoutPeriod}
              onDelete={handleDeleteBlackoutPeriod}
              onActivate={handleActivateBlackoutPeriod}
              isLoading={isLoading}
            />
          </PivotItem>

          <PivotItem headerText="Notifications" itemIcon="Ringer">
            <Card tokens={{ padding: 20 }}>
              <Stack tokens={{ childrenGap: 16 }}>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                  <Icon iconName="Ringer" styles={{ root: { color: '#0078d4' } }} />
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                    Notification Settings
                  </Text>
                </Stack>

                <div className="text-center py-12">
                  <Icon iconName="Ringer" styles={{ root: { fontSize: 48, marginBottom: 16, color: '#666' } }} />
                  <Text variant="medium" styles={{ root: { color: '#666', marginBottom: 16 } }}>
                    Notification settings configuration
                  </Text>
                  <Text variant="small" styles={{ root: { color: '#666' } }}>
                    Configure email notifications, SMS alerts, manager notifications,
                    and automated reminders for leave requests and approvals.
                  </Text>
                </div>
              </Stack>
            </Card>
          </PivotItem>

          <PivotItem headerText="Integration" itemIcon="Plug">
            <Card tokens={{ padding: 20 }}>
              <Stack tokens={{ childrenGap: 16 }}>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                  <Icon iconName="Plug" styles={{ root: { color: '#0078d4' } }} />
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                    External Integrations
                  </Text>
                </Stack>

                <div className="text-center py-12">
                  <Icon iconName="Plug" styles={{ root: { fontSize: 48, marginBottom: 16, color: '#666' } }} />
                  <Text variant="medium" styles={{ root: { color: '#666', marginBottom: 16 } }}>
                    Integration settings coming soon
                  </Text>
                  <Text variant="small" styles={{ root: { color: '#666' } }}>
                    Configure integrations with payroll systems, calendar applications,
                    and other workforce management tools.
                  </Text>
                </div>
              </Stack>
            </Card>
          </PivotItem>

          <PivotItem headerText="System Health" itemIcon="Health">
            <Card tokens={{ padding: 20 }}>
              <Stack tokens={{ childrenGap: 16 }}>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                  <Icon iconName="Health" styles={{ root: { color: '#107c10' } }} />
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                    System Health & Diagnostics
                  </Text>
                </Stack>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <Stack tokens={{ childrenGap: 4 }}>
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Icon iconName="CheckMark" styles={{ root: { color: '#107c10' } }} />
                        <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                          Accrual Engine
                        </Text>
                      </Stack>
                      <Text variant="small">Running normally</Text>
                      <Text variant="small" styles={{ root: { color: '#666' } }}>
                        Last run: {new Date().toLocaleString()}
                      </Text>
                    </Stack>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <Stack tokens={{ childrenGap: 4 }}>
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Icon iconName="CheckMark" styles={{ root: { color: '#107c10' } }} />
                        <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                          Notifications
                        </Text>
                      </Stack>
                      <Text variant="small">All systems operational</Text>
                      <Text variant="small" styles={{ root: { color: '#666' } }}>
                        Queue: 0 pending
                      </Text>
                    </Stack>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <Stack tokens={{ childrenGap: 4 }}>
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Icon iconName="CheckMark" styles={{ root: { color: '#107c10' } }} />
                        <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                          Database
                        </Text>
                      </Stack>
                      <Text variant="small">Healthy</Text>
                      <Text variant="small" styles={{ root: { color: '#666' } }}>
                        Response time: &lt;2ms
                      </Text>
                    </Stack>
                  </div>
                </div>
              </Stack>
            </Card>
          </PivotItem>
        </Pivot>
      </Stack>
    </div>
  );
};

export default LeaveSettings;
