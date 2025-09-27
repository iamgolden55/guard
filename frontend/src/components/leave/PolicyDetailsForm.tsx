import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  TextField,
  Dropdown,
  IDropdownOption,
  Toggle,
  DatePicker,
  SpinButton,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Separator,
  Panel,
  PanelType,
  IconButton,
  IStackTokens,
  Pivot,
  PivotItem,
  Callout,
  TooltipHost
} from '@fluentui/react';
import { Formik, Form, Field, FieldArray, FormikProps } from 'formik';
import * as Yup from 'yup';
import { LeavePolicy, LeaveType, EmploymentType } from '../../types/leave';

interface PolicyDetailsFormProps {
  policy?: LeavePolicy | null;
  leaveTypes: LeaveType[];
  employmentTypes: EmploymentType[];
  isOpen: boolean;
  isLoading?: boolean;
  onSave: (policyData: Partial<LeavePolicy>) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

interface PolicyFormData {
  name: string;
  leave_type_id: number | null;
  employment_type_ids: number[];

  // Accrual Settings
  accrual_method: 'monthly' | 'annual' | 'per_shift' | 'length_of_service' | 'none';
  accrual_rate: string;
  max_accrual_per_year: string;
  max_balance: string;
  service_brackets: Array<{
    months: number;
    rate: number;
  }>;

  // Carryover Settings
  carryover_method: 'none' | 'full' | 'partial' | 'use_or_lose';
  carryover_limit: string;
  carryover_expiry_months: number;

  // Eligibility
  probation_months: number;
  min_employment_days: number;

  // Advanced Settings
  allow_negative_balance: boolean;
  negative_balance_limit: string;

  // Status
  is_active: boolean;
  effective_date: Date | null;
  expiry_date: Date | null;
}

const stackTokens: IStackTokens = {
  childrenGap: 16,
};

// Validation schema
const validationSchema = Yup.object().shape({
  name: Yup.string()
    .required('Policy name is required')
    .min(2, 'Name must be at least 2 characters'),
  leave_type_id: Yup.number()
    .nullable()
    .required('Leave type is required'),
  employment_type_ids: Yup.array()
    .of(Yup.number())
    .min(1, 'At least one employment type must be selected'),
  accrual_method: Yup.string()
    .required('Accrual method is required'),
  accrual_rate: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number')
    .required('Accrual rate is required'),
  max_balance: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number'),
  carryover_method: Yup.string()
    .required('Carryover method is required'),
  probation_months: Yup.number()
    .min(0, 'Cannot be negative')
    .required('Probation months is required'),
  min_employment_days: Yup.number()
    .min(0, 'Cannot be negative')
    .required('Minimum employment days is required'),
  effective_date: Yup.date()
    .nullable()
    .required('Effective date is required'),
});

const PolicyDetailsForm: React.FC<PolicyDetailsFormProps> = ({
  policy,
  leaveTypes,
  employmentTypes,
  isOpen,
  isLoading = false,
  onSave,
  onCancel,
  className = ''
}) => {
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);

  const isEditing = Boolean(policy);

  // Initialize form data
  const getInitialValues = useCallback((): PolicyFormData => {
    if (policy) {
      return {
        name: policy.name,
        leave_type_id: policy.leave_type.id,
        employment_type_ids: policy.employment_types.map(et => et.id),
        accrual_method: policy.accrual_method,
        accrual_rate: policy.accrual_rate,
        max_accrual_per_year: policy.max_accrual_per_year || '',
        max_balance: policy.max_balance || '',
        service_brackets: policy.service_brackets,
        carryover_method: policy.carryover_method,
        carryover_limit: policy.carryover_limit || '',
        carryover_expiry_months: policy.carryover_expiry_months,
        probation_months: policy.probation_months,
        min_employment_days: policy.min_employment_days,
        allow_negative_balance: policy.allow_negative_balance,
        negative_balance_limit: policy.negative_balance_limit,
        is_active: policy.is_active,
        effective_date: new Date(policy.effective_date),
        expiry_date: policy.expiry_date ? new Date(policy.expiry_date) : null,
      };
    }

    return {
      name: '',
      leave_type_id: null,
      employment_type_ids: [],
      accrual_method: 'monthly',
      accrual_rate: '0',
      max_accrual_per_year: '',
      max_balance: '',
      service_brackets: [],
      carryover_method: 'none',
      carryover_limit: '',
      carryover_expiry_months: 12,
      probation_months: 0,
      min_employment_days: 0,
      allow_negative_balance: false,
      negative_balance_limit: '0',
      is_active: true,
      effective_date: new Date(),
      expiry_date: null,
    };
  }, [policy]);

  // Dropdown options
  const leaveTypeOptions: IDropdownOption[] = leaveTypes.map(type => ({
    key: type.id,
    text: type.name
  }));

  const employmentTypeOptions: IDropdownOption[] = employmentTypes.map(type => ({
    key: type.id,
    text: type.name
  }));

  const accrualMethodOptions: IDropdownOption[] = [
    { key: 'monthly', text: 'Monthly Accrual' },
    { key: 'annual', text: 'Annual Allocation' },
    { key: 'per_shift', text: 'Per Shift Worked' },
    { key: 'length_of_service', text: 'Length of Service' },
    { key: 'none', text: 'No Accrual' }
  ];

  const carryoverMethodOptions: IDropdownOption[] = [
    { key: 'none', text: 'No Carryover' },
    { key: 'full', text: 'Full Carryover' },
    { key: 'partial', text: 'Partial Carryover' },
    { key: 'use_or_lose', text: 'Use or Lose' }
  ];

  // Handle form submission
  const handleSubmit = useCallback(async (values: PolicyFormData) => {
    try {
      const policyData: Partial<LeavePolicy> = {
        name: values.name,
        leave_type: leaveTypes.find(lt => lt.id === values.leave_type_id)!,
        employment_types: employmentTypes.filter(et => values.employment_type_ids.includes(et.id)),
        accrual_method: values.accrual_method,
        accrual_rate: values.accrual_rate,
        max_accrual_per_year: values.max_accrual_per_year || undefined,
        max_balance: values.max_balance || undefined,
        service_brackets: values.service_brackets,
        carryover_method: values.carryover_method,
        carryover_limit: values.carryover_limit || undefined,
        carryover_expiry_months: values.carryover_expiry_months,
        probation_months: values.probation_months,
        min_employment_days: values.min_employment_days,
        allow_negative_balance: values.allow_negative_balance,
        negative_balance_limit: values.negative_balance_limit,
        is_active: values.is_active,
        effective_date: values.effective_date!.toISOString().split('T')[0],
        expiry_date: values.expiry_date ? values.expiry_date.toISOString().split('T')[0] : undefined,
      };

      if (isEditing) {
        policyData.id = policy!.id;
      }

      await onSave(policyData);
      setNotification({
        type: MessageBarType.success,
        message: `Policy ${isEditing ? 'updated' : 'created'} successfully!`
      });
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: `Failed to ${isEditing ? 'update' : 'create'} policy. Please try again.`
      });
    }
  }, [policy, isEditing, leaveTypes, employmentTypes, onSave]);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <Panel
      isOpen={isOpen}
      onDismiss={onCancel}
      type={PanelType.medium}
      headerText={isEditing ? 'Edit Leave Policy' : 'Create Leave Policy'}
      closeButtonAriaLabel="Close"
      className={className}
    >
      <Formik
        initialValues={getInitialValues()}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {(formik: FormikProps<PolicyFormData>) => (
          <Form>
            <Stack tokens={stackTokens}>
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

              <Pivot>
                <PivotItem headerText="Basic Settings">
                  <Stack tokens={stackTokens}>
                    {/* Basic Information */}
                    <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                      Basic Information
                    </Text>

                    <Field name="name">
                      {({ field, meta }: any) => (
                        <TextField
                          label="Policy Name"
                          placeholder="Enter policy name..."
                          required
                          {...field}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                        />
                      )}
                    </Field>

                    <Field name="leave_type_id">
                      {({ field, meta, form }: any) => (
                        <Dropdown
                          label="Leave Type"
                          placeholder="Select leave type"
                          options={leaveTypeOptions}
                          selectedKey={field.value}
                          onChange={(_, option) => form.setFieldValue('leave_type_id', option?.key)}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          required
                        />
                      )}
                    </Field>

                    <Field name="employment_type_ids">
                      {({ field, meta, form }: any) => (
                        <Dropdown
                          label="Employment Types"
                          placeholder="Select employment types"
                          multiSelect
                          options={employmentTypeOptions}
                          selectedKeys={field.value}
                          onChange={(_, option) => {
                            const currentKeys = field.value || [];
                            if (option?.selected) {
                              form.setFieldValue('employment_type_ids', [...currentKeys, option.key]);
                            } else {
                              form.setFieldValue('employment_type_ids', currentKeys.filter((key: number) => key !== option?.key));
                            }
                          }}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          required
                        />
                      )}
                    </Field>

                    <Stack horizontal tokens={{ childrenGap: 16 }}>
                      <Field name="effective_date">
                        {({ field, meta, form }: any) => (
                          <DatePicker
                            label="Effective Date"
                            placeholder="Select date"
                            value={field.value}
                            onSelectDate={(date) => form.setFieldValue('effective_date', date)}
                            isRequired
                          />
                        )}
                      </Field>

                      <Field name="expiry_date">
                        {({ field, meta, form }: any) => (
                          <DatePicker
                            label="Expiry Date (Optional)"
                            placeholder="Select date"
                            value={field.value}
                            onSelectDate={(date) => form.setFieldValue('expiry_date', date)}
                          />
                        )}
                      </Field>
                    </Stack>

                    <Field name="is_active">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Policy Active"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('is_active', checked)}
                        />
                      )}
                    </Field>
                  </Stack>
                </PivotItem>

                <PivotItem headerText="Accrual Settings">
                  <Stack tokens={stackTokens}>
                    <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                      Leave Accrual Configuration
                    </Text>

                    <Field name="accrual_method">
                      {({ field, meta, form }: any) => (
                        <Dropdown
                          label="Accrual Method"
                          placeholder="Select accrual method"
                          options={accrualMethodOptions}
                          selectedKey={field.value}
                          onChange={(_, option) => form.setFieldValue('accrual_method', option?.key)}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          required
                        />
                      )}
                    </Field>

                    <Stack horizontal tokens={{ childrenGap: 16 }}>
                      <Field name="accrual_rate">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Accrual Rate (days)"
                            placeholder="0.0"
                            {...field}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                            required
                          />
                        )}
                      </Field>

                      <Field name="max_accrual_per_year">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Max Accrual Per Year (Optional)"
                            placeholder="0.0"
                            {...field}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                          />
                        )}
                      </Field>
                    </Stack>

                    <Field name="max_balance">
                      {({ field, meta }: any) => (
                        <TextField
                          label="Maximum Balance (Optional)"
                          placeholder="0.0"
                          description="Maximum leave balance an employee can accumulate"
                          {...field}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                        />
                      )}
                    </Field>

                    {/* Service Brackets for length_of_service accrual */}
                    {formik.values.accrual_method === 'length_of_service' && (
                      <FieldArray name="service_brackets">
                        {({ push, remove }) => (
                          <Stack>
                            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                              <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                                Service Brackets
                              </Text>
                              <DefaultButton
                                text="Add Bracket"
                                iconProps={{ iconName: 'Add' }}
                                onClick={() => push({ months: 0, rate: 0 })}
                              />
                            </Stack>

                            {formik.values.service_brackets.map((bracket, index) => (
                              <Stack key={index} horizontal tokens={{ childrenGap: 16 }} verticalAlign="end">
                                <TextField
                                  label="Months of Service"
                                  value={bracket.months.toString()}
                                  onChange={(_, value) => {
                                    const newBrackets = [...formik.values.service_brackets];
                                    newBrackets[index].months = parseInt(value || '0');
                                    formik.setFieldValue('service_brackets', newBrackets);
                                  }}
                                />
                                <TextField
                                  label="Accrual Rate (days)"
                                  value={bracket.rate.toString()}
                                  onChange={(_, value) => {
                                    const newBrackets = [...formik.values.service_brackets];
                                    newBrackets[index].rate = parseFloat(value || '0');
                                    formik.setFieldValue('service_brackets', newBrackets);
                                  }}
                                />
                                <IconButton
                                  iconProps={{ iconName: 'Delete' }}
                                  onClick={() => remove(index)}
                                  styles={{ root: { color: '#d13438' } }}
                                />
                              </Stack>
                            ))}
                          </Stack>
                        )}
                      </FieldArray>
                    )}
                  </Stack>
                </PivotItem>

                <PivotItem headerText="Carryover & Eligibility">
                  <Stack tokens={stackTokens}>
                    <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                      Carryover Settings
                    </Text>

                    <Field name="carryover_method">
                      {({ field, meta, form }: any) => (
                        <Dropdown
                          label="Carryover Method"
                          placeholder="Select carryover method"
                          options={carryoverMethodOptions}
                          selectedKey={field.value}
                          onChange={(_, option) => form.setFieldValue('carryover_method', option?.key)}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          required
                        />
                      )}
                    </Field>

                    {formik.values.carryover_method === 'partial' && (
                      <Field name="carryover_limit">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Carryover Limit (days)"
                            placeholder="0.0"
                            description="Maximum days that can be carried over"
                            {...field}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                          />
                        )}
                      </Field>
                    )}

                    <Field name="carryover_expiry_months">
                      {({ field, form }: any) => (
                        <SpinButton
                          label="Carryover Expiry (months)"
                          min={1}
                          max={24}
                          value={field.value.toString()}
                          onIncrement={(value) => form.setFieldValue('carryover_expiry_months', parseInt(value) + 1)}
                          onDecrement={(value) => form.setFieldValue('carryover_expiry_months', Math.max(1, parseInt(value) - 1))}
                          onValidate={(value) => form.setFieldValue('carryover_expiry_months', parseInt(value) || 12)}
                        />
                      )}
                    </Field>

                    <Separator />

                    <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                      Eligibility Requirements
                    </Text>

                    <Stack horizontal tokens={{ childrenGap: 16 }}>
                      <Field name="probation_months">
                        {({ field, form }: any) => (
                          <SpinButton
                            label="Probation Period (months)"
                            min={0}
                            max={12}
                            value={field.value.toString()}
                            onIncrement={(value) => form.setFieldValue('probation_months', parseInt(value) + 1)}
                            onDecrement={(value) => form.setFieldValue('probation_months', Math.max(0, parseInt(value) - 1))}
                            onValidate={(value) => form.setFieldValue('probation_months', parseInt(value) || 0)}
                          />
                        )}
                      </Field>

                      <Field name="min_employment_days">
                        {({ field, form }: any) => (
                          <SpinButton
                            label="Min Employment Days"
                            min={0}
                            max={365}
                            value={field.value.toString()}
                            onIncrement={(value) => form.setFieldValue('min_employment_days', parseInt(value) + 1)}
                            onDecrement={(value) => form.setFieldValue('min_employment_days', Math.max(0, parseInt(value) - 1))}
                            onValidate={(value) => form.setFieldValue('min_employment_days', parseInt(value) || 0)}
                          />
                        )}
                      </Field>
                    </Stack>
                  </Stack>
                </PivotItem>

                <PivotItem headerText="Advanced Settings">
                  <Stack tokens={stackTokens}>
                    <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                      Advanced Options
                    </Text>

                    <Field name="allow_negative_balance">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Allow Negative Balance"
                          description="Employees can take leave before accruing sufficient balance"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('allow_negative_balance', checked)}
                        />
                      )}
                    </Field>

                    {formik.values.allow_negative_balance && (
                      <Field name="negative_balance_limit">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Negative Balance Limit (days)"
                            placeholder="0.0"
                            description="Maximum negative balance allowed"
                            {...field}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                          />
                        )}
                      </Field>
                    )}
                  </Stack>
                </PivotItem>
              </Pivot>

              {/* Form Actions */}
              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                <DefaultButton
                  text="Cancel"
                  onClick={onCancel}
                  disabled={isLoading}
                />
                <PrimaryButton
                  text={isEditing ? 'Update Policy' : 'Create Policy'}
                  type="submit"
                  disabled={isLoading || !formik.isValid}
                />
              </Stack>
            </Stack>
          </Form>
        )}
      </Formik>
    </Panel>
  );
};

export default PolicyDetailsForm;