import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Input,
  Textarea,
  Select,
  Switch,
  SpinButton,
  Label,
  Field,
  MessageBar,
  Spinner,
  Card,
  CardHeader,
  Badge,
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel
} from '@fluentui/react-components';
import {
  Save24Regular,
  Dismiss24Regular,
  Settings24Regular,
  Warning24Regular,
  Info24Regular,
  Globe24Regular
} from '@fluentui/react-icons';
import { ComplianceService } from '../../services/complianceService';
import { ComplianceProfile, WorkingHoursRegulation, ComplianceProfileFormData } from '../../types/compliance';

interface ComplianceProfileFormProps {
  profile?: ComplianceProfile | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const validationSchema = Yup.object({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be less than 100 characters')
    .required('Profile name is required'),
  description: Yup.string()
    .max(500, 'Description must be less than 500 characters')
    .required('Description is required'),
  working_hours_regulation: Yup.number()
    .required('Working hours regulation is required'),
  daily_hours_warning_threshold: Yup.number()
    .min(50, 'Warning threshold must be at least 50%')
    .max(99.99, 'Warning threshold cannot exceed 99.99%')
    .required('Daily warning threshold is required'),
  weekly_hours_warning_threshold: Yup.number()
    .min(50, 'Warning threshold must be at least 50%')
    .max(99.99, 'Warning threshold cannot exceed 99.99%')
    .required('Weekly warning threshold is required'),
  consecutive_days_warning_threshold: Yup.number()
    .min(1, 'Must be at least 1 day')
    .max(13, 'Cannot exceed 13 days')
    .required('Consecutive days warning threshold is required'),
  grace_period_minutes: Yup.number()
    .min(0, 'Grace period cannot be negative')
    .max(120, 'Grace period cannot exceed 120 minutes')
    .required('Grace period is required'),
});

const ComplianceProfileForm: React.FC<ComplianceProfileFormProps> = ({
  profile,
  onSuccess,
  onCancel,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic']);

  // Fetch working hours regulations
  const { data: regulations, isLoading: regulationsLoading } = useQuery({
    queryKey: ['working-hours-regulations'],
    queryFn: async () => {
      const response = await ComplianceService.getRegulations();
      return response.results;
    },
    refetchOnWindowFocus: false,
  });

  // Create/Update profile mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ComplianceProfileFormData) => {
      if (profile) {
        return await ComplianceService.updateProfile(profile.id, data);
      } else {
        return await ComplianceService.createProfile(data);
      }
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to save profile');
    },
  });

  const formik = useFormik<ComplianceProfileFormData>({
    initialValues: {
      name: profile?.name || '',
      description: profile?.description || '',
      working_hours_regulation: profile?.working_hours_regulation || 0,
      override_max_daily_hours: profile?.override_max_daily_hours ? parseFloat(profile.override_max_daily_hours.toString()) : undefined,
      override_max_weekly_hours: profile?.override_max_weekly_hours ? parseFloat(profile.override_max_weekly_hours.toString()) : undefined,
      override_max_consecutive_days: profile?.override_max_consecutive_days || undefined,
      daily_hours_warning_threshold: parseFloat(profile?.daily_hours_warning_threshold || '80'),
      weekly_hours_warning_threshold: parseFloat(profile?.weekly_hours_warning_threshold || '85'),
      consecutive_days_warning_threshold: profile?.consecutive_days_warning_threshold || 5,
      auto_approve_overtime: profile?.auto_approve_overtime || false,
      auto_approve_extended_hours: profile?.auto_approve_extended_hours || false,
      require_manager_approval: profile?.require_manager_approval || true,
      notify_on_warnings: profile?.notify_on_warnings || true,
      notify_on_violations: profile?.notify_on_violations || true,
      notification_recipients: profile?.notification_recipients || [],
      grace_period_minutes: profile?.grace_period_minutes || 15,
      allow_break_flexibility: profile?.allow_break_flexibility || true,
      custom_rules: profile?.custom_rules || {},
      exception_roles: profile?.exception_roles || [],
    },
    validationSchema,
    onSubmit: (values) => {
      setError(null);
      profileMutation.mutate(values);
    },
  });

  const selectedRegulation = regulations?.find(r => r.id === formik.values.working_hours_regulation);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const getRegulationPreview = () => {
    if (!selectedRegulation) return null;

    return (
      <Card className="mt-4">
        <CardHeader
          header={
            <div className="flex items-center gap-2">
              <Globe24Regular className="text-blue-500" />
              <span className="font-medium">Selected Regulation Preview</span>
              <Badge appearance="outline" color="brand">
                {selectedRegulation.country_code}
              </Badge>
            </div>
          }
        />
        <div className="p-4 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500">Standard Daily:</span>
              <span className="ml-2 font-medium">{selectedRegulation.standard_daily_hours}h</span>
            </div>
            <div>
              <span className="text-gray-500">Standard Weekly:</span>
              <span className="ml-2 font-medium">{selectedRegulation.standard_weekly_hours}h</span>
            </div>
            <div>
              <span className="text-gray-500">Max Daily:</span>
              <span className="ml-2 font-medium">{selectedRegulation.max_daily_hours}h</span>
            </div>
            <div>
              <span className="text-gray-500">Max Weekly:</span>
              <span className="ml-2 font-medium">{selectedRegulation.max_weekly_hours}h</span>
            </div>
            <div>
              <span className="text-gray-500">OT Threshold:</span>
              <span className="ml-2 font-medium">{selectedRegulation.overtime_threshold_hours}h</span>
            </div>
            <div>
              <span className="text-gray-500">OT Multiplier:</span>
              <span className="ml-2 font-medium">{selectedRegulation.overtime_multiplier_1}x</span>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  if (regulationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="large" label="Loading form data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full overflow-hidden">
      {error && (
        <MessageBar intent="error">
          {error}
        </MessageBar>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              <p className="text-sm text-gray-600">Set up the profile name and description</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Field
              label={
                <div className="flex items-center gap-1">
                  <span>Profile Name</span>
                  <span className="text-red-500">*</span>
                </div>
              }
              validationMessage={formik.touched.name && formik.errors.name}
              validationState={formik.touched.name && formik.errors.name ? 'error' : 'none'}
            >
              <Input
                name="name"
                value={formik.values.name}
                onChange={(_, data) => formik.setFieldValue('name', data.value)}
                onBlur={formik.handleBlur}
                placeholder="e.g., UK Security Operations"
                className={formik.touched.name && formik.errors.name ? 'border-red-500' : ''}
              />
              {formik.touched.name && formik.errors.name && (
                <div className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <Warning24Regular className="w-4 h-4" />
                  {formik.errors.name}
                </div>
              )}
            </Field>

            <Field
              label={
                <div className="flex items-center gap-1">
                  <span>Description</span>
                  <span className="text-red-500">*</span>
                </div>
              }
              validationMessage={formik.touched.description && formik.errors.description}
              validationState={formik.touched.description && formik.errors.description ? 'error' : 'none'}
            >
              <Textarea
                name="description"
                value={formik.values.description}
                onChange={(_, data) => formik.setFieldValue('description', data.value)}
                onBlur={formik.handleBlur}
                placeholder="Describe the purpose and scope of this compliance profile..."
                rows={3}
                className={formik.touched.description && formik.errors.description ? 'border-red-500' : ''}
              />
              {formik.touched.description && formik.errors.description && (
                <div className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <Warning24Regular className="w-4 h-4" />
                  {formik.errors.description}
                </div>
              )}
            </Field>
          </div>
        </div>

        {/* Step 2: Regional Regulation */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Regional Regulation</h3>
              <p className="text-sm text-gray-600">Choose the base working hours regulation for this profile</p>
            </div>
          </div>

          <div className="space-y-4">
            <Field
              label={
                <div className="flex items-center gap-1">
                  <span>Working Hours Regulation</span>
                  <span className="text-red-500">*</span>
                </div>
              }
              validationMessage={formik.touched.working_hours_regulation && formik.errors.working_hours_regulation}
              validationState={formik.touched.working_hours_regulation && formik.errors.working_hours_regulation ? 'error' : 'none'}
            >
              {regulationsLoading ? (
                <div className="flex items-center gap-2 p-3 border border-gray-300 rounded">
                  <Spinner size="tiny" />
                  <span className="text-gray-600">Loading regulations...</span>
                </div>
              ) : (
                <Select
                  value={formik.values.working_hours_regulation.toString()}
                  onSelectionChange={(_, data) => {
                    if (data.value) {
                      formik.setFieldValue('working_hours_regulation', parseInt(data.value));
                    }
                  }}
                >
                  <option value="0" disabled>
                    {regulations?.length ? 'Select a regulation...' : 'No regulations available'}
                  </option>
                  {regulations?.map((regulation) => (
                    <option key={regulation.id} value={regulation.id.toString()}>
                      {regulation.country_name} - {regulation.country_code}
                    </option>
                  ))}
                </Select>
              )}
              {formik.touched.working_hours_regulation && formik.errors.working_hours_regulation && (
                <div className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <Warning24Regular className="w-4 h-4" />
                  {formik.errors.working_hours_regulation}
                </div>
              )}
            </Field>

            {getRegulationPreview()}
          </div>
        </div>

        {/* Step 3: Advanced Configuration */}
        <Accordion
          multiple
          openItems={expandedSections}
          onToggle={(_, data) => {
            const openItems = data.openItems;
            if (Array.isArray(openItems)) {
              setExpandedSections(openItems as string[]);
            }
          }}
        >
          {/* Regulation Overrides */}
          <AccordionItem value="overrides">
            <AccordionHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <div className="font-semibold">Regulation Overrides</div>
                  <div className="text-sm text-gray-600">Optional: Override default regulation values</div>
                </div>
              </div>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-4">
                <MessageBar intent="info">
                  <Info24Regular />
                  Override regulation defaults only when necessary. Leave blank to use regulation defaults.
                </MessageBar>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Override Max Daily Hours">
                    <SpinButton
                      value={formik.values.override_max_daily_hours || undefined}
                      onChange={(_, data) => formik.setFieldValue('override_max_daily_hours', data.value || undefined)}
                      min={8}
                      max={24}
                      step={0.5}
                      placeholder="Use regulation default"
                    />
                  </Field>

                  <Field label="Override Max Weekly Hours">
                    <SpinButton
                      value={formik.values.override_max_weekly_hours || undefined}
                      onChange={(_, data) => formik.setFieldValue('override_max_weekly_hours', data.value || undefined)}
                      min={30}
                      max={80}
                      step={1}
                      placeholder="Use regulation default"
                    />
                  </Field>

                  <Field label="Override Max Consecutive Days">
                    <SpinButton
                      value={formik.values.override_max_consecutive_days || undefined}
                      onChange={(_, data) => formik.setFieldValue('override_max_consecutive_days', data.value || undefined)}
                      min={1}
                      max={14}
                      step={1}
                      placeholder="Use regulation default"
                    />
                  </Field>
                </div>
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Overrides */}
          <AccordionItem value="overrides">
            <AccordionHeader>Regulation Overrides</AccordionHeader>
            <AccordionPanel>
              <div className="space-y-4">
                <MessageBar intent="info">
                  <Info24Regular />
                  Override regulation defaults only when necessary. Leave blank to use regulation defaults.
                </MessageBar>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Override Max Daily Hours">
                    <SpinButton
                      value={formik.values.override_max_daily_hours || undefined}
                      onChange={(_, data) => formik.setFieldValue('override_max_daily_hours', data.value || undefined)}
                      min={8}
                      max={24}
                      step={0.5}
                      placeholder="Use regulation default"
                    />
                  </Field>

                  <Field label="Override Max Weekly Hours">
                    <SpinButton
                      value={formik.values.override_max_weekly_hours || undefined}
                      onChange={(_, data) => formik.setFieldValue('override_max_weekly_hours', data.value || undefined)}
                      min={35}
                      max={80}
                      step={1}
                      placeholder="Use regulation default"
                    />
                  </Field>

                  <Field label="Override Max Consecutive Days">
                    <SpinButton
                      value={formik.values.override_max_consecutive_days || undefined}
                      onChange={(_, data) => formik.setFieldValue('override_max_consecutive_days', data.value || undefined)}
                      min={1}
                      max={14}
                      step={1}
                      placeholder="Use regulation default"
                    />
                  </Field>
                </div>
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Warning Thresholds */}
          <AccordionItem value="thresholds">
            <AccordionHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <div className="font-medium">Warning Thresholds</div>
                  <div className="text-sm text-gray-600">Set early warning percentages to prevent violations</div>
                </div>
              </div>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-4 border border-orange-100 rounded-lg p-4">
                <MessageBar intent="warning">
                  <Warning24Regular />
                  These thresholds trigger warnings before actual violations occur. Set them lower than 100% to receive advance notice.
                </MessageBar>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field
                    label={
                      <div className="flex items-center gap-1">
                        Daily Hours Warning (%)
                        <span className="text-red-500">*</span>
                      </div>
                    }
                    required
                    validationMessage={
                      formik.touched.daily_hours_warning_threshold && formik.errors.daily_hours_warning_threshold ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <Warning24Regular className="w-4 h-4" />
                          {formik.errors.daily_hours_warning_threshold}
                        </div>
                      ) : undefined
                    }
                    validationState={formik.touched.daily_hours_warning_threshold && formik.errors.daily_hours_warning_threshold ? 'error' : 'none'}
                  >
                    <SpinButton
                      value={formik.values.daily_hours_warning_threshold}
                      onChange={(_, data) => formik.setFieldValue('daily_hours_warning_threshold', data.value || 80)}
                      min={50}
                      max={99}
                      step={5}
                    />
                  </Field>

                  <Field
                    label={
                      <div className="flex items-center gap-1">
                        Weekly Hours Warning (%)
                        <span className="text-red-500">*</span>
                      </div>
                    }
                    required
                    validationMessage={
                      formik.touched.weekly_hours_warning_threshold && formik.errors.weekly_hours_warning_threshold ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <Warning24Regular className="w-4 h-4" />
                          {formik.errors.weekly_hours_warning_threshold}
                        </div>
                      ) : undefined
                    }
                    validationState={formik.touched.weekly_hours_warning_threshold && formik.errors.weekly_hours_warning_threshold ? 'error' : 'none'}
                  >
                    <SpinButton
                      value={formik.values.weekly_hours_warning_threshold}
                      onChange={(_, data) => formik.setFieldValue('weekly_hours_warning_threshold', data.value || 85)}
                      min={50}
                      max={99}
                      step={5}
                    />
                  </Field>

                  <Field
                    label={
                      <div className="flex items-center gap-1">
                        Consecutive Days Warning
                        <span className="text-red-500">*</span>
                      </div>
                    }
                    required
                    validationMessage={
                      formik.touched.consecutive_days_warning_threshold && formik.errors.consecutive_days_warning_threshold ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <Warning24Regular className="w-4 h-4" />
                          {formik.errors.consecutive_days_warning_threshold}
                        </div>
                      ) : undefined
                    }
                    validationState={formik.touched.consecutive_days_warning_threshold && formik.errors.consecutive_days_warning_threshold ? 'error' : 'none'}
                  >
                    <SpinButton
                      value={formik.values.consecutive_days_warning_threshold}
                      onChange={(_, data) => formik.setFieldValue('consecutive_days_warning_threshold', data.value || 5)}
                      min={1}
                      max={13}
                      step={1}
                    />
                  </Field>
                </div>
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Automation Settings */}
          <AccordionItem value="automation">
            <AccordionHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  4
                </div>
                <div>
                  <div className="font-medium">Automation & Approvals</div>
                  <div className="text-sm text-gray-600">Configure automated workflows and notification settings</div>
                </div>
              </div>
            </AccordionHeader>
            <AccordionPanel>
              <div className="space-y-6 border border-purple-100 rounded-lg p-4">
                <MessageBar intent="info">
                  <Settings24Regular />
                  Configure automatic approvals and notifications to streamline compliance management. Use caution with auto-approvals.
                </MessageBar>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Approval Settings</h4>

                    <Field label="Auto-approve overtime shifts">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formik.values.auto_approve_overtime}
                          onChange={(_, data) => formik.setFieldValue('auto_approve_overtime', data.checked)}
                        />
                        <span className="text-sm text-gray-600">Automatically approve shifts with overtime hours</span>
                      </div>
                    </Field>

                    <Field label="Auto-approve extended hours">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formik.values.auto_approve_extended_hours}
                          onChange={(_, data) => formik.setFieldValue('auto_approve_extended_hours', data.checked)}
                        />
                        <span className="text-sm text-gray-600">Automatically approve shifts exceeding standard hours</span>
                      </div>
                    </Field>

                    <Field label="Require manager approval for violations">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formik.values.require_manager_approval}
                          onChange={(_, data) => formik.setFieldValue('require_manager_approval', data.checked)}
                        />
                        <span className="text-sm text-gray-600">All compliance violations need manager sign-off</span>
                      </div>
                    </Field>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Notification Settings</h4>

                    <Field label="Notify on warnings">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formik.values.notify_on_warnings}
                          onChange={(_, data) => formik.setFieldValue('notify_on_warnings', data.checked)}
                        />
                        <span className="text-sm text-gray-600">Send alerts when warning thresholds are reached</span>
                      </div>
                    </Field>

                    <Field label="Notify on violations">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formik.values.notify_on_violations}
                          onChange={(_, data) => formik.setFieldValue('notify_on_violations', data.checked)}
                        />
                        <span className="text-sm text-gray-600">Send alerts when compliance violations occur</span>
                      </div>
                    </Field>

                    <Field label="Allow break time flexibility">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formik.values.allow_break_flexibility}
                          onChange={(_, data) => formik.setFieldValue('allow_break_flexibility', data.checked)}
                        />
                        <span className="text-sm text-gray-600">Allow slight variations in break timing</span>
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Field
                    label={
                      <div className="flex items-center gap-1">
                        Grace Period (minutes)
                        <span className="text-red-500">*</span>
                      </div>
                    }
                    required
                    validationMessage={
                      formik.touched.grace_period_minutes && formik.errors.grace_period_minutes ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <Warning24Regular className="w-4 h-4" />
                          {formik.errors.grace_period_minutes}
                        </div>
                      ) : undefined
                    }
                    validationState={formik.touched.grace_period_minutes && formik.errors.grace_period_minutes ? 'error' : 'none'}
                  >
                    <div className="flex items-center gap-2">
                      <SpinButton
                        value={formik.values.grace_period_minutes}
                        onChange={(_, data) => formik.setFieldValue('grace_period_minutes', data.value || 15)}
                        min={0}
                        max={120}
                        step={5}
                        className="w-32"
                      />
                      <span className="text-sm text-gray-600">Buffer time before violations are triggered</span>
                    </div>
                  </Field>
                </div>
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        {/* Form Actions */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {!formik.isValid && formik.submitCount > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <Warning24Regular className="w-4 h-4" />
                  Please fix the errors above before saving
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                appearance="subtle"
                onClick={onCancel}
                disabled={profileMutation.isPending}
                size="large"
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                icon={profileMutation.isPending ? <Spinner size="tiny" /> : <Save24Regular />}
                disabled={profileMutation.isPending || (!formik.isValid && formik.submitCount > 0)}
                size="large"
              >
                {profileMutation.isPending ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ComplianceProfileForm;