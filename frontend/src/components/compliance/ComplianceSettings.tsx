// Compliance Settings Component
// Settings management interface for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  Button,
  Spinner,
  Text,
  Title2,
  Title3,
  Badge,
  Select,
  Input,
  Textarea,
  Switch,
  Field,
  Label,
  RadioGroup,
  Radio,
  Checkbox,
  MessageBar,
  MessageBarBody,
  TabList,
  Tab,
  TabValue,
  Body1,
  Caption1,
  Divider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  SearchBox
} from '@fluentui/react-components';
import {
  Settings24Regular,
  Save24Regular,
  ArrowReset24Regular,
  Upload24Regular,
  ArrowDownload24Regular,
  Copy24Regular,
  Warning24Regular,
  CheckmarkCircle24Regular,
  Dismiss24Regular,
  Search24Regular,
  Filter24Regular
} from '@fluentui/react-icons';

import {
  useComplianceSettings,
  useComplianceSettingsUpdate,
  useComplianceVenues,
  useComplianceStaffProfiles
} from '../../hooks/useComplianceData';
import type {
  ComplianceSettings as ComplianceSettingsType,
  ComplianceSettingsProps,
  ComplianceVenue,
  ComplianceStaffProfile,
  SettingsInheritance
} from '../../types/compliance';

interface SettingsFormData {
  // Overtime settings
  dailyOvertimeThreshold: number;
  weeklyOvertimeThreshold: number;
  overtimeCalculationMethod: 'daily' | 'weekly' | 'both';

  // Break requirements
  breakRequiredAfterHours: number;
  minimumBreakDuration: number;
  unpaidBreakThreshold: number;

  // Compliance monitoring
  enableRealTimeMonitoring: boolean;
  violationNotifications: boolean;
  autoResolutionEnabled: boolean;
  escalationThresholdMinutes: number;

  // Working hours
  maxConsecutiveHours: number;
  maxWeeklyHours: number;
  minimumRestBetweenShifts: number;

  // Notifications
  notifyManagers: boolean;
  notifyStaff: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;

  // Grace periods
  clockInGracePeriod: number;
  clockOutGracePeriod: number;
  lateArrivalThreshold: number;
}

export const ComplianceSettings: React.FC<ComplianceSettingsProps> = ({
  level = 'global',
  venueId,
  staffId,
  canEdit = true
}) => {
  const [selectedTab, setSelectedTab] = useState<TabValue>('overtime');
  const [selectedVenues, setSelectedVenues] = useState<number[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<number[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // API Hooks
  const {
    data: settingsData,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings
  } = useComplianceSettings(level, venueId, staffId);

  const {
    mutate: updateSettings,
    isPending: updatePending
  } = useComplianceSettingsUpdate();

  const {
    data: venuesData,
    isLoading: venuesLoading
  } = useComplianceVenues();

  const {
    data: staffData,
    isLoading: staffLoading
  } = useComplianceStaffProfiles();

  // Form state
  const [formData, setFormData] = useState<SettingsFormData>({
    dailyOvertimeThreshold: 8,
    weeklyOvertimeThreshold: 40,
    overtimeCalculationMethod: 'both',
    breakRequiredAfterHours: 6,
    minimumBreakDuration: 30,
    unpaidBreakThreshold: 20,
    enableRealTimeMonitoring: true,
    violationNotifications: true,
    autoResolutionEnabled: false,
    escalationThresholdMinutes: 30,
    maxConsecutiveHours: 12,
    maxWeeklyHours: 48,
    minimumRestBetweenShifts: 11,
    notifyManagers: true,
    notifyStaff: false,
    emailNotifications: true,
    smsNotifications: false,
    clockInGracePeriod: 5,
    clockOutGracePeriod: 5,
    lateArrivalThreshold: 15
  });

  // Initialize form data when settings load
  React.useEffect(() => {
    if (settingsData?.data) {
      setFormData({
        dailyOvertimeThreshold: settingsData.data.daily_overtime_threshold,
        weeklyOvertimeThreshold: settingsData.data.weekly_overtime_threshold,
        overtimeCalculationMethod: settingsData.data.overtime_calculation_method,
        breakRequiredAfterHours: settingsData.data.break_required_after_hours,
        minimumBreakDuration: settingsData.data.minimum_break_duration,
        unpaidBreakThreshold: settingsData.data.unpaid_break_threshold,
        enableRealTimeMonitoring: settingsData.data.enable_real_time_monitoring,
        violationNotifications: settingsData.data.violation_notifications,
        autoResolutionEnabled: settingsData.data.auto_resolution_enabled,
        escalationThresholdMinutes: settingsData.data.escalation_threshold_minutes,
        maxConsecutiveHours: settingsData.data.max_consecutive_hours,
        maxWeeklyHours: settingsData.data.max_weekly_hours,
        minimumRestBetweenShifts: settingsData.data.minimum_rest_between_shifts,
        notifyManagers: settingsData.data.notify_managers,
        notifyStaff: settingsData.data.notify_staff,
        emailNotifications: settingsData.data.email_notifications,
        smsNotifications: settingsData.data.sms_notifications,
        clockInGracePeriod: settingsData.data.clock_in_grace_period,
        clockOutGracePeriod: settingsData.data.clock_out_grace_period,
        lateArrivalThreshold: settingsData.data.late_arrival_threshold
      });
    }
  }, [settingsData]);

  // Handle form field changes
  const handleFieldChange = useCallback((field: keyof SettingsFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    try {
      await updateSettings({
        level,
        venueId,
        staffId,
        settings: {
          daily_overtime_threshold: formData.dailyOvertimeThreshold,
          weekly_overtime_threshold: formData.weeklyOvertimeThreshold,
          overtime_calculation_method: formData.overtimeCalculationMethod,
          break_required_after_hours: formData.breakRequiredAfterHours,
          minimum_break_duration: formData.minimumBreakDuration,
          unpaid_break_threshold: formData.unpaidBreakThreshold,
          enable_real_time_monitoring: formData.enableRealTimeMonitoring,
          violation_notifications: formData.violationNotifications,
          auto_resolution_enabled: formData.autoResolutionEnabled,
          escalation_threshold_minutes: formData.escalationThresholdMinutes,
          max_consecutive_hours: formData.maxConsecutiveHours,
          max_weekly_hours: formData.maxWeeklyHours,
          minimum_rest_between_shifts: formData.minimumRestBetweenShifts,
          notify_managers: formData.notifyManagers,
          notify_staff: formData.notifyStaff,
          email_notifications: formData.emailNotifications,
          sms_notifications: formData.smsNotifications,
          clock_in_grace_period: formData.clockInGracePeriod,
          clock_out_grace_period: formData.clockOutGracePeriod,
          late_arrival_threshold: formData.lateArrivalThreshold
        }
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [formData, updateSettings, level, venueId, staffId]);

  // Reset settings
  const handleReset = useCallback(() => {
    if (settingsData?.data) {
      setFormData({
        dailyOvertimeThreshold: settingsData.data.daily_overtime_threshold,
        weeklyOvertimeThreshold: settingsData.data.weekly_overtime_threshold,
        overtimeCalculationMethod: settingsData.data.overtime_calculation_method,
        breakRequiredAfterHours: settingsData.data.break_required_after_hours,
        minimumBreakDuration: settingsData.data.minimum_break_duration,
        unpaidBreakThreshold: settingsData.data.unpaid_break_threshold,
        enableRealTimeMonitoring: settingsData.data.enable_real_time_monitoring,
        violationNotifications: settingsData.data.violation_notifications,
        autoResolutionEnabled: settingsData.data.auto_resolution_enabled,
        escalationThresholdMinutes: settingsData.data.escalation_threshold_minutes,
        maxConsecutiveHours: settingsData.data.max_consecutive_hours,
        maxWeeklyHours: settingsData.data.max_weekly_hours,
        minimumRestBetweenShifts: settingsData.data.minimum_rest_between_shifts,
        notifyManagers: settingsData.data.notify_managers,
        notifyStaff: settingsData.data.notify_staff,
        emailNotifications: settingsData.data.email_notifications,
        smsNotifications: settingsData.data.sms_notifications,
        clockInGracePeriod: settingsData.data.clock_in_grace_period,
        clockOutGracePeriod: settingsData.data.clock_out_grace_period,
        lateArrivalThreshold: settingsData.data.late_arrival_threshold
      });
      setHasChanges(false);
    }
  }, [settingsData]);

  // Export settings
  const handleExport = useCallback(() => {
    const exportData = {
      level,
      venueId,
      staffId,
      settings: formData,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `compliance-settings-${level}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [formData, level, venueId, staffId]);

  // Bulk apply settings
  const handleBulkApply = useCallback(async () => {
    const targets = [];

    if (selectedVenues.length > 0) {
      targets.push(...selectedVenues.map(id => ({ type: 'venue', id })));
    }

    if (selectedStaff.length > 0) {
      targets.push(...selectedStaff.map(id => ({ type: 'staff', id })));
    }

    try {
      for (const target of targets) {
        await updateSettings({
          level: target.type,
          venueId: target.type === 'venue' ? target.id : undefined,
          staffId: target.type === 'staff' ? target.id : undefined,
          settings: {
            daily_overtime_threshold: formData.dailyOvertimeThreshold,
            weekly_overtime_threshold: formData.weeklyOvertimeThreshold,
            overtime_calculation_method: formData.overtimeCalculationMethod,
            break_required_after_hours: formData.breakRequiredAfterHours,
            minimum_break_duration: formData.minimumBreakDuration,
            unpaid_break_threshold: formData.unpaidBreakThreshold,
            enable_real_time_monitoring: formData.enableRealTimeMonitoring,
            violation_notifications: formData.violationNotifications,
            auto_resolution_enabled: formData.autoResolutionEnabled,
            escalation_threshold_minutes: formData.escalationThresholdMinutes,
            max_consecutive_hours: formData.maxConsecutiveHours,
            max_weekly_hours: formData.maxWeeklyHours,
            minimum_rest_between_shifts: formData.minimumRestBetweenShifts,
            notify_managers: formData.notifyManagers,
            notify_staff: formData.notifyStaff,
            email_notifications: formData.emailNotifications,
            sms_notifications: formData.smsNotifications,
            clock_in_grace_period: formData.clockInGracePeriod,
            clock_out_grace_period: formData.clockOutGracePeriod,
            late_arrival_threshold: formData.lateArrivalThreshold
          }
        });
      }

      setShowBulkDialog(false);
      setSelectedVenues([]);
      setSelectedStaff([]);
    } catch (error) {
      console.error('Failed to apply bulk settings:', error);
    }
  }, [selectedVenues, selectedStaff, formData, updateSettings]);

  // Settings inheritance display
  const inheritanceInfo = useMemo((): SettingsInheritance | null => {
    if (level === 'global') return null;

    return {
      global: settingsData?.inheritance?.global || null,
      venue: level === 'staff' ? settingsData?.inheritance?.venue || null : null,
      current: settingsData?.data || null
    };
  }, [settingsData, level]);

  // Filtered venues and staff for bulk operations
  const filteredVenues = useMemo(() => {
    if (!venuesData?.results) return [];
    return venuesData.results.filter(venue =>
      venue.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [venuesData, searchTerm]);

  const filteredStaff = useMemo(() => {
    if (!staffData?.results) return [];
    return staffData.results.filter(staff =>
      staff.user_data.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staffData, searchTerm]);

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Spinner size="large" />
          <Text className="mt-4 block">Loading compliance settings...</Text>
        </div>
      </div>
    );
  }

  if (settingsError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>
          Failed to load compliance settings. Please refresh and try again.
        </MessageBarBody>
      </MessageBar>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings24Regular className="text-gray-600" />
          <Title2>Compliance Settings</Title2>
          <Badge appearance="outline">
            {level.charAt(0).toUpperCase() + level.slice(1)} Level
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {hasChanges && (
            <MessageBar intent="warning" className="mb-0">
              <MessageBarBody>Unsaved changes</MessageBarBody>
            </MessageBar>
          )}

          <div className="flex gap-2">
            <Button
              appearance="outline"
              icon={<ArrowDownload24Regular />}
              onClick={handleExport}
            >
              Export
            </Button>

            {level === 'global' && (
              <Dialog open={showBulkDialog} onOpenChange={(_, data) => setShowBulkDialog(data.open)}>
                <DialogTrigger disableButtonEnhancement>
                  <Button
                    appearance="outline"
                    icon={<Copy24Regular />}
                  >
                    Bulk Apply
                  </Button>
                </DialogTrigger>

                <DialogSurface className="max-w-2xl">
                  <DialogBody>
                    <DialogTitle>Apply Settings to Multiple Targets</DialogTitle>
                    <DialogContent className="space-y-4">
                      <SearchBox
                        placeholder="Search venues or staff..."
                        value={searchTerm}
                        onChange={(_, data) => setSearchTerm(data.value)}
                        className="w-full"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Venues */}
                        <div>
                          <Title3 className="mb-2">Venues</Title3>
                          <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
                            {filteredVenues.map(venue => (
                              <Checkbox
                                key={venue.id}
                                checked={selectedVenues.includes(venue.id)}
                                onChange={(_, data) => {
                                  if (data.checked) {
                                    setSelectedVenues(prev => [...prev, venue.id]);
                                  } else {
                                    setSelectedVenues(prev => prev.filter(id => id !== venue.id));
                                  }
                                }}
                                label={venue.name}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Staff */}
                        <div>
                          <Title3 className="mb-2">Staff</Title3>
                          <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
                            {filteredStaff.map(staff => (
                              <Checkbox
                                key={staff.id}
                                checked={selectedStaff.includes(staff.id)}
                                onChange={(_, data) => {
                                  if (data.checked) {
                                    setSelectedStaff(prev => [...prev, staff.id]);
                                  } else {
                                    setSelectedStaff(prev => prev.filter(id => id !== staff.id));
                                  }
                                }}
                                label={staff.user_data.full_name}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <Text>
                        Selected: {selectedVenues.length} venues, {selectedStaff.length} staff
                      </Text>
                    </DialogContent>

                    <DialogActions>
                      <Button
                        appearance="secondary"
                        onClick={() => setShowBulkDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        appearance="primary"
                        onClick={handleBulkApply}
                        disabled={selectedVenues.length === 0 && selectedStaff.length === 0}
                      >
                        Apply Settings
                      </Button>
                    </DialogActions>
                  </DialogBody>
                </DialogSurface>
              </Dialog>
            )}

            <Button
              appearance="outline"
              icon={<ArrowReset24Regular />}
              onClick={handleReset}
              disabled={!hasChanges}
            >
              Reset
            </Button>

            <Button
              appearance="primary"
              icon={<Save24Regular />}
              onClick={handleSave}
              disabled={!canEdit || updatePending}
            >
              {updatePending ? <Spinner size="tiny" /> : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Inheritance Display */}
      {inheritanceInfo && (
        <Card className="bg-blue-50 border border-blue-200">
          <CardHeader>
            <Title3>Settings Inheritance</Title3>
            <Caption1 className="text-blue-600">
              Settings are inherited from higher levels when not explicitly set
            </Caption1>
          </CardHeader>

          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge color="informative">Global</Badge>
              <Text>Base compliance settings for all venues and staff</Text>
            </div>

            {level === 'staff' && (
              <div className="flex items-center gap-2">
                <Badge color="important">Venue</Badge>
                <Text>Venue-specific overrides (if set)</Text>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Badge color="success">Current</Badge>
              <Text>
                {level === 'venue' ? 'Venue-specific' : 'Staff-specific'} settings
              </Text>
            </div>
          </div>
        </Card>
      )}

      {/* Settings Tabs */}
      <Card>
        <TabList
          selectedValue={selectedTab}
          onTabSelect={(_, data) => setSelectedTab(data.value)}
          className="p-4 border-b"
        >
          <Tab value="overtime">Overtime Rules</Tab>
          <Tab value="breaks">Breaks & Rest</Tab>
          <Tab value="monitoring">Monitoring</Tab>
          <Tab value="notifications">Notifications</Tab>
          <Tab value="grace">Grace Periods</Tab>
        </TabList>

        <div className="p-6">
          {/* Overtime Settings */}
          {selectedTab === 'overtime' && (
            <div className="space-y-6">
              <Title3>Overtime Calculation Rules</Title3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field>
                  <Label>Daily Overtime Threshold (hours)</Label>
                  <Input
                    type="number"
                    value={formData.dailyOvertimeThreshold.toString()}
                    onChange={(_, data) => handleFieldChange('dailyOvertimeThreshold', Number(data.value))}
                    disabled={!canEdit}
                    min={1}
                    max={24}
                  />
                  <Caption1>Hours worked in a day before overtime applies</Caption1>
                </Field>

                <Field>
                  <Label>Weekly Overtime Threshold (hours)</Label>
                  <Input
                    type="number"
                    value={formData.weeklyOvertimeThreshold.toString()}
                    onChange={(_, data) => handleFieldChange('weeklyOvertimeThreshold', Number(data.value))}
                    disabled={!canEdit}
                    min={1}
                    max={168}
                  />
                  <Caption1>Hours worked in a week before overtime applies</Caption1>
                </Field>

                <Field>
                  <Label>Calculation Method</Label>
                  <RadioGroup
                    value={formData.overtimeCalculationMethod}
                    onChange={(_, data) => handleFieldChange('overtimeCalculationMethod', data.value)}
                    disabled={!canEdit}
                  >
                    <Radio value="daily" label="Daily only" />
                    <Radio value="weekly" label="Weekly only" />
                    <Radio value="both" label="Both daily and weekly" />
                  </RadioGroup>
                </Field>

                <Field>
                  <Label>Maximum Weekly Hours</Label>
                  <Input
                    type="number"
                    value={formData.maxWeeklyHours.toString()}
                    onChange={(_, data) => handleFieldChange('maxWeeklyHours', Number(data.value))}
                    disabled={!canEdit}
                    min={1}
                    max={168}
                  />
                  <Caption1>Maximum hours a staff member can work per week</Caption1>
                </Field>

                <Field>
                  <Label>Maximum Consecutive Hours</Label>
                  <Input
                    type="number"
                    value={formData.maxConsecutiveHours.toString()}
                    onChange={(_, data) => handleFieldChange('maxConsecutiveHours', Number(data.value))}
                    disabled={!canEdit}
                    min={1}
                    max={24}
                  />
                  <Caption1>Maximum hours in a single shift</Caption1>
                </Field>

                <Field>
                  <Label>Minimum Rest Between Shifts (hours)</Label>
                  <Input
                    type="number"
                    value={formData.minimumRestBetweenShifts.toString()}
                    onChange={(_, data) => handleFieldChange('minimumRestBetweenShifts', Number(data.value))}
                    disabled={!canEdit}
                    min={0}
                    max={24}
                  />
                  <Caption1>Required rest time between consecutive shifts</Caption1>
                </Field>
              </div>
            </div>
          )}

          {/* Break Settings */}
          {selectedTab === 'breaks' && (
            <div className="space-y-6">
              <Title3>Break and Rest Requirements</Title3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field>
                  <Label>Break Required After (hours)</Label>
                  <Input
                    type="number"
                    value={formData.breakRequiredAfterHours.toString()}
                    onChange={(_, data) => handleFieldChange('breakRequiredAfterHours', Number(data.value))}
                    disabled={!canEdit}
                    min={1}
                    max={12}
                  />
                  <Caption1>Hours worked before a break is required</Caption1>
                </Field>

                <Field>
                  <Label>Minimum Break Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.minimumBreakDuration.toString()}
                    onChange={(_, data) => handleFieldChange('minimumBreakDuration', Number(data.value))}
                    disabled={!canEdit}
                    min={5}
                    max={120}
                  />
                  <Caption1>Minimum length of required breaks</Caption1>
                </Field>

                <Field>
                  <Label>Unpaid Break Threshold (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.unpaidBreakThreshold.toString()}
                    onChange={(_, data) => handleFieldChange('unpaidBreakThreshold', Number(data.value))}
                    disabled={!canEdit}
                    min={0}
                    max={60}
                  />
                  <Caption1>Break length above which breaks become unpaid</Caption1>
                </Field>
              </div>
            </div>
          )}

          {/* Monitoring Settings */}
          {selectedTab === 'monitoring' && (
            <div className="space-y-6">
              <Title3>Compliance Monitoring</Title3>

              <div className="space-y-4">
                <Field>
                  <Switch
                    checked={formData.enableRealTimeMonitoring}
                    onChange={(_, data) => handleFieldChange('enableRealTimeMonitoring', data.checked)}
                    disabled={!canEdit}
                    label="Enable Real-Time Monitoring"
                  />
                  <Caption1>Monitor compliance violations in real-time</Caption1>
                </Field>

                <Field>
                  <Switch
                    checked={formData.violationNotifications}
                    onChange={(_, data) => handleFieldChange('violationNotifications', data.checked)}
                    disabled={!canEdit}
                    label="Violation Notifications"
                  />
                  <Caption1>Send notifications when violations are detected</Caption1>
                </Field>

                <Field>
                  <Switch
                    checked={formData.autoResolutionEnabled}
                    onChange={(_, data) => handleFieldChange('autoResolutionEnabled', data.checked)}
                    disabled={!canEdit}
                    label="Auto-Resolution"
                  />
                  <Caption1>Automatically resolve minor violations when possible</Caption1>
                </Field>

                <Field>
                  <Label>Escalation Threshold (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.escalationThresholdMinutes.toString()}
                    onChange={(_, data) => handleFieldChange('escalationThresholdMinutes', Number(data.value))}
                    disabled={!canEdit}
                    min={5}
                    max={120}
                  />
                  <Caption1>Time before unresolved violations are escalated</Caption1>
                </Field>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {selectedTab === 'notifications' && (
            <div className="space-y-6">
              <Title3>Notification Preferences</Title3>

              <div className="space-y-4">
                <Field>
                  <Switch
                    checked={formData.notifyManagers}
                    onChange={(_, data) => handleFieldChange('notifyManagers', data.checked)}
                    disabled={!canEdit}
                    label="Notify Managers"
                  />
                  <Caption1>Send notifications to venue managers</Caption1>
                </Field>

                <Field>
                  <Switch
                    checked={formData.notifyStaff}
                    onChange={(_, data) => handleFieldChange('notifyStaff', data.checked)}
                    disabled={!canEdit}
                    label="Notify Staff"
                  />
                  <Caption1>Send notifications to affected staff members</Caption1>
                </Field>

                <Divider />

                <Field>
                  <Switch
                    checked={formData.emailNotifications}
                    onChange={(_, data) => handleFieldChange('emailNotifications', data.checked)}
                    disabled={!canEdit}
                    label="Email Notifications"
                  />
                  <Caption1>Send notifications via email</Caption1>
                </Field>

                <Field>
                  <Switch
                    checked={formData.smsNotifications}
                    onChange={(_, data) => handleFieldChange('smsNotifications', data.checked)}
                    disabled={!canEdit}
                    label="SMS Notifications"
                  />
                  <Caption1>Send notifications via SMS (additional charges may apply)</Caption1>
                </Field>
              </div>
            </div>
          )}

          {/* Grace Periods Settings */}
          {selectedTab === 'grace' && (
            <div className="space-y-6">
              <Title3>Grace Periods & Tolerances</Title3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field>
                  <Label>Clock-In Grace Period (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.clockInGracePeriod.toString()}
                    onChange={(_, data) => handleFieldChange('clockInGracePeriod', Number(data.value))}
                    disabled={!canEdit}
                    min={0}
                    max={30}
                  />
                  <Caption1>Grace period for early clock-ins</Caption1>
                </Field>

                <Field>
                  <Label>Clock-Out Grace Period (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.clockOutGracePeriod.toString()}
                    onChange={(_, data) => handleFieldChange('clockOutGracePeriod', Number(data.value))}
                    disabled={!canEdit}
                    min={0}
                    max={30}
                  />
                  <Caption1>Grace period for late clock-outs</Caption1>
                </Field>

                <Field>
                  <Label>Late Arrival Threshold (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.lateArrivalThreshold.toString()}
                    onChange={(_, data) => handleFieldChange('lateArrivalThreshold', Number(data.value))}
                    disabled={!canEdit}
                    min={1}
                    max={60}
                  />
                  <Caption1>Minutes late before marking as late arrival</Caption1>
                </Field>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ComplianceSettings;