import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import {
  Button,
  Input,
  SpinButton,
  Label,
  Field,
  MessageBar,
  Spinner,
  Switch,
  Card,
  CardHeader,
  Text,
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Textarea
} from '@fluentui/react-components';
import {
  Save24Regular,
  Dismiss24Regular,
  Warning24Regular,
  Info24Regular,
  Globe24Regular
} from '@fluentui/react-icons';
import { ComplianceService } from '../../services/complianceService';
import { WorkingHoursRegulation } from '../../types/compliance';

interface RegulationEditorProps {
  regulation: WorkingHoursRegulation;
  onSave: () => void;
  onCancel: () => void;
}

const validationSchema = Yup.object({
  standard_weekly_hours: Yup.number()
    .min(20, 'Must be at least 20 hours')
    .max(50, 'Cannot exceed 50 hours')
    .required('Standard weekly hours required'),
  standard_daily_hours: Yup.number()
    .min(4, 'Must be at least 4 hours')
    .max(12, 'Cannot exceed 12 hours')
    .required('Standard daily hours required'),
  max_daily_hours: Yup.number()
    .min(8, 'Must be at least 8 hours')
    .max(24, 'Cannot exceed 24 hours')
    .required('Max daily hours required'),
  max_weekly_hours: Yup.number()
    .min(35, 'Must be at least 35 hours')
    .max(80, 'Cannot exceed 80 hours')
    .required('Max weekly hours required'),
  overtime_threshold_hours: Yup.number()
    .min(20, 'Must be at least 20 hours')
    .max(60, 'Cannot exceed 60 hours')
    .required('Overtime threshold required'),
  overtime_multiplier_1: Yup.number()
    .min(1.0, 'Must be at least 1.0')
    .max(3.0, 'Cannot exceed 3.0')
    .required('Overtime multiplier required'),
  max_consecutive_days: Yup.number()
    .min(1, 'Must be at least 1 day')
    .max(14, 'Cannot exceed 14 days')
    .required('Max consecutive days required'),
  min_rest_between_shifts_hours: Yup.number()
    .min(4, 'Must be at least 4 hours')
    .max(24, 'Cannot exceed 24 hours')
    .required('Min rest between shifts required'),
  min_weekly_rest_hours: Yup.number()
    .min(12, 'Must be at least 12 hours')
    .max(48, 'Cannot exceed 48 hours')
    .required('Min weekly rest required'),
  break_duration_minutes: Yup.number()
    .min(0, 'Cannot be negative')
    .max(120, 'Cannot exceed 120 minutes')
    .required('Break duration required'),
  break_trigger_hours: Yup.number()
    .min(3, 'Must be at least 3 hours')
    .max(12, 'Cannot exceed 12 hours')
    .required('Break trigger hours required'),
});

const RegulationEditor: React.FC<RegulationEditorProps> = ({
  regulation,
  onSave,
  onCancel,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic']);

  // Update regulation mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<WorkingHoursRegulation>) => {
      // Auth handled via httpOnly cookies (withCredentials: true on api instance)
      const response = await api.put(`/api/v1/compliance/regulations/${regulation.id}/`, data);
      return response.data;
    },
    onSuccess: () => {
      onSave();
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update regulation');
    },
  });

  const formik = useFormik({
    initialValues: {
      standard_weekly_hours: parseFloat(regulation.standard_weekly_hours),
      standard_daily_hours: parseFloat(regulation.standard_daily_hours),
      max_daily_hours: parseFloat(regulation.max_daily_hours),
      max_weekly_hours: parseFloat(regulation.max_weekly_hours),
      overtime_threshold_hours: parseFloat(regulation.overtime_threshold_hours),
      overtime_multiplier_1: parseFloat(regulation.overtime_multiplier_1),
      overtime_threshold_2: regulation.overtime_threshold_2 ? parseFloat(regulation.overtime_threshold_2) : undefined,
      overtime_multiplier_2: regulation.overtime_multiplier_2 ? parseFloat(regulation.overtime_multiplier_2) : undefined,
      max_consecutive_days: regulation.max_consecutive_days,
      min_rest_between_shifts_hours: parseFloat(regulation.min_rest_between_shifts_hours),
      min_weekly_rest_hours: parseFloat(regulation.min_weekly_rest_hours),
      break_duration_minutes: regulation.break_duration_minutes,
      break_trigger_hours: parseFloat(regulation.break_trigger_hours),
      is_active: regulation.is_active,
      special_rules: JSON.stringify(regulation.special_rules || {}, null, 2),
    },
    validationSchema,
    onSubmit: (values) => {
      setError(null);

      let specialRules = {};
      try {
        specialRules = JSON.parse(values.special_rules);
      } catch (e) {
        setError('Invalid JSON in special rules');
        return;
      }

      const updateData = {
        ...values,
        special_rules: specialRules,
        standard_weekly_hours: values.standard_weekly_hours.toString(),
        standard_daily_hours: values.standard_daily_hours.toString(),
        max_daily_hours: values.max_daily_hours.toString(),
        max_weekly_hours: values.max_weekly_hours.toString(),
        overtime_threshold_hours: values.overtime_threshold_hours.toString(),
        overtime_multiplier_1: values.overtime_multiplier_1.toString(),
        overtime_threshold_2: values.overtime_threshold_2?.toString() || null,
        overtime_multiplier_2: values.overtime_multiplier_2?.toString() || null,
        min_rest_between_shifts_hours: values.min_rest_between_shifts_hours.toString(),
        min_weekly_rest_hours: values.min_weekly_rest_hours.toString(),
        break_trigger_hours: values.break_trigger_hours.toString(),
      };

      updateMutation.mutate(updateData);
    },
  });

  const getValidationWarnings = () => {
    const warnings = [];

    if (formik.values.max_daily_hours <= formik.values.standard_daily_hours) {
      warnings.push('Max daily hours should be greater than standard daily hours');
    }

    if (formik.values.max_weekly_hours <= formik.values.standard_weekly_hours) {
      warnings.push('Max weekly hours should be greater than standard weekly hours');
    }

    if (formik.values.overtime_threshold_hours < formik.values.standard_weekly_hours) {
      warnings.push('Overtime threshold should be at least equal to standard weekly hours');
    }

    if (formik.values.break_trigger_hours > formik.values.standard_daily_hours) {
      warnings.push('Break trigger hours should not exceed standard daily hours');
    }

    return warnings;
  };

  const warnings = getValidationWarnings();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe24Regular className="text-blue-600" />
        <div>
          <Text size={600} weight="semibold">
            Edit {regulation.country_name} Regulations
          </Text>
          <Text size={400} className="text-gray-600">
            {regulation.country_name_display}
          </Text>
        </div>
      </div>

      {error && (
        <MessageBar intent="error" onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}

      {warnings.length > 0 && (
        <MessageBar intent="warning">
          <Warning24Regular />
          <div>
            <Text weight="semibold">Configuration Warnings:</Text>
            <ul className="mt-1 ml-4 list-disc">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning}</li>
              ))}
            </ul>
          </div>
        </MessageBar>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-6">
        <Accordion
          multiple
          openItems={expandedSections}
          onToggle={(_, data) => setExpandedSections(data.openItems)}
        >
          {/* Basic Hours */}
          <AccordionItem value="basic">
            <AccordionHeader>Basic Working Hours</AccordionHeader>
            <AccordionPanel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Standard Daily Hours"
                  required
                  validationMessage={formik.touched.standard_daily_hours && formik.errors.standard_daily_hours}
                  validationState={formik.touched.standard_daily_hours && formik.errors.standard_daily_hours ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.standard_daily_hours}
                    onChange={(_, data) => formik.setFieldValue('standard_daily_hours', data.value || 8)}
                    min={4}
                    max={12}
                    step={0.5}
                  />
                </Field>

                <Field
                  label="Standard Weekly Hours"
                  required
                  validationMessage={formik.touched.standard_weekly_hours && formik.errors.standard_weekly_hours}
                  validationState={formik.touched.standard_weekly_hours && formik.errors.standard_weekly_hours ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.standard_weekly_hours}
                    onChange={(_, data) => formik.setFieldValue('standard_weekly_hours', data.value || 40)}
                    min={20}
                    max={50}
                    step={1}
                  />
                </Field>

                <Field
                  label="Max Daily Hours"
                  required
                  validationMessage={formik.touched.max_daily_hours && formik.errors.max_daily_hours}
                  validationState={formik.touched.max_daily_hours && formik.errors.max_daily_hours ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.max_daily_hours}
                    onChange={(_, data) => formik.setFieldValue('max_daily_hours', data.value || 12)}
                    min={8}
                    max={24}
                    step={0.5}
                  />
                </Field>

                <Field
                  label="Max Weekly Hours"
                  required
                  validationMessage={formik.touched.max_weekly_hours && formik.errors.max_weekly_hours}
                  validationState={formik.touched.max_weekly_hours && formik.errors.max_weekly_hours ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.max_weekly_hours}
                    onChange={(_, data) => formik.setFieldValue('max_weekly_hours', data.value || 48)}
                    min={35}
                    max={80}
                    step={1}
                  />
                </Field>
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Overtime Rules */}
          <AccordionItem value="overtime">
            <AccordionHeader>Overtime Rules</AccordionHeader>
            <AccordionPanel>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Primary OT Threshold (hours)"
                    required
                    validationMessage={formik.touched.overtime_threshold_hours && formik.errors.overtime_threshold_hours}
                    validationState={formik.touched.overtime_threshold_hours && formik.errors.overtime_threshold_hours ? 'error' : 'none'}
                  >
                    <SpinButton
                      value={formik.values.overtime_threshold_hours}
                      onChange={(_, data) => formik.setFieldValue('overtime_threshold_hours', data.value || 40)}
                      min={20}
                      max={60}
                      step={1}
                    />
                  </Field>

                  <Field
                    label="Primary OT Multiplier"
                    required
                    validationMessage={formik.touched.overtime_multiplier_1 && formik.errors.overtime_multiplier_1}
                    validationState={formik.touched.overtime_multiplier_1 && formik.errors.overtime_multiplier_1 ? 'error' : 'none'}
                  >
                    <SpinButton
                      value={formik.values.overtime_multiplier_1}
                      onChange={(_, data) => formik.setFieldValue('overtime_multiplier_1', data.value || 1.5)}
                      min={1.0}
                      max={3.0}
                      step={0.1}
                    />
                  </Field>

                  <Field label="Secondary OT Threshold (optional)">
                    <SpinButton
                      value={formik.values.overtime_threshold_2 || undefined}
                      onChange={(_, data) => formik.setFieldValue('overtime_threshold_2', data.value)}
                      min={40}
                      max={80}
                      step={1}
                      placeholder="Not used"
                    />
                  </Field>

                  <Field label="Secondary OT Multiplier (optional)">
                    <SpinButton
                      value={formik.values.overtime_multiplier_2 || undefined}
                      onChange={(_, data) => formik.setFieldValue('overtime_multiplier_2', data.value)}
                      min={1.5}
                      max={4.0}
                      step={0.1}
                      placeholder="Not used"
                    />
                  </Field>
                </div>

                <MessageBar intent="info">
                  <Info24Regular />
                  Secondary overtime rules are used for double overtime (e.g., after 12 hours/day or 60 hours/week)
                </MessageBar>
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Rest & Breaks */}
          <AccordionItem value="rest">
            <AccordionHeader>Rest & Break Requirements</AccordionHeader>
            <AccordionPanel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Max Consecutive Days"
                  required
                  validationMessage={formik.touched.max_consecutive_days && formik.errors.max_consecutive_days}
                  validationState={formik.touched.max_consecutive_days && formik.errors.max_consecutive_days ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.max_consecutive_days}
                    onChange={(_, data) => formik.setFieldValue('max_consecutive_days', data.value || 6)}
                    min={1}
                    max={14}
                    step={1}
                  />
                </Field>

                <Field
                  label="Min Rest Between Shifts (hours)"
                  required
                  validationMessage={formik.touched.min_rest_between_shifts_hours && formik.errors.min_rest_between_shifts_hours}
                  validationState={formik.touched.min_rest_between_shifts_hours && formik.errors.min_rest_between_shifts_hours ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.min_rest_between_shifts_hours}
                    onChange={(_, data) => formik.setFieldValue('min_rest_between_shifts_hours', data.value || 11)}
                    min={4}
                    max={24}
                    step={0.5}
                  />
                </Field>

                <Field
                  label="Min Weekly Rest (hours)"
                  required
                  validationMessage={formik.touched.min_weekly_rest_hours && formik.errors.min_weekly_rest_hours}
                  validationState={formik.touched.min_weekly_rest_hours && formik.errors.min_weekly_rest_hours ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.min_weekly_rest_hours}
                    onChange={(_, data) => formik.setFieldValue('min_weekly_rest_hours', data.value || 24)}
                    min={12}
                    max={48}
                    step={1}
                  />
                </Field>

                <Field
                  label="Break Duration (minutes)"
                  required
                  validationMessage={formik.touched.break_duration_minutes && formik.errors.break_duration_minutes}
                  validationState={formik.touched.break_duration_minutes && formik.errors.break_duration_minutes ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.break_duration_minutes}
                    onChange={(_, data) => formik.setFieldValue('break_duration_minutes', data.value || 30)}
                    min={0}
                    max={120}
                    step={5}
                  />
                </Field>

                <Field
                  label="Break Trigger (hours)"
                  required
                  validationMessage={formik.touched.break_trigger_hours && formik.errors.break_trigger_hours}
                  validationState={formik.touched.break_trigger_hours && formik.errors.break_trigger_hours ? 'error' : 'none'}
                >
                  <SpinButton
                    value={formik.values.break_trigger_hours}
                    onChange={(_, data) => formik.setFieldValue('break_trigger_hours', data.value || 6)}
                    min={3}
                    max={12}
                    step={0.5}
                  />
                </Field>
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Special Rules */}
          <AccordionItem value="special">
            <AccordionHeader>Special Rules & Status</AccordionHeader>
            <AccordionPanel>
              <div className="space-y-4">
                <Field label="Regulation Status">
                  <Switch
                    checked={formik.values.is_active}
                    onChange={(_, data) => formik.setFieldValue('is_active', data.checked)}
                    label={formik.values.is_active ? 'Active' : 'Inactive'}
                  />
                </Field>

                <Field
                  label="Special Rules (JSON)"
                  hint="Advanced configuration in JSON format"
                >
                  <Textarea
                    value={formik.values.special_rules}
                    onChange={(_, data) => formik.setFieldValue('special_rules', data.value)}
                    rows={8}
                    placeholder='{"example": "value"}'
                    style={{ fontFamily: 'monospace' }}
                  />
                </Field>

                <MessageBar intent="warning">
                  <Warning24Regular />
                  Special rules should only be modified by administrators familiar with JSON format.
                  Invalid JSON will prevent saving.
                </MessageBar>
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button
            appearance="subtle"
            onClick={onCancel}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            appearance="primary"
            type="submit"
            icon={updateMutation.isPending ? <Spinner size="tiny" /> : <Save24Regular />}
            disabled={updateMutation.isPending || !formik.isValid || warnings.length > 0}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Regulation'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RegulationEditor;