import React, { useState, useCallback } from 'react';
import {
  Stack,
  Text,

  TextField,
  Dropdown,
  IDropdownOption,
  SpinButton,
  Toggle,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Separator,
  Icon,
  TooltipHost,
  IStackTokens
} from '@fluentui/react';
import { Formik, Form, Field, FormikProps } from 'formik';
import * as Yup from 'yup';

interface AccrualSettingsProps {
  initialSettings?: AccrualSettingsData;
  onSave: (settings: AccrualSettingsData) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

interface AccrualSettingsData {
  // Global Accrual Settings
  default_accrual_method: 'monthly' | 'annual' | 'per_shift' | 'length_of_service';
  global_accrual_rate: string;
  max_accrual_per_year: string;
  max_balance_limit: string;

  // Accrual Frequency
  accrual_frequency: 'monthly' | 'bi_weekly' | 'weekly' | 'daily';
  accrual_start_day: number; // Day of month for monthly accrual

  // Pro-rating Settings
  enable_pro_rating: boolean;
  pro_rating_method: 'daily' | 'monthly' | 'anniversary';

  // Carryover Settings
  default_carryover_method: 'none' | 'full' | 'partial' | 'use_or_lose';
  carryover_limit: string;
  carryover_expiry_months: number;

  // Leave Year Settings
  leave_year_start_month: number; // 1 = January, 2 = February, etc.
  leave_year_start_day: number;

  // Advanced Settings
  enable_negative_balance: boolean;
  negative_balance_limit: string;
  auto_approve_negative: boolean;

  // Rounding Settings
  rounding_method: 'none' | 'up' | 'down' | 'nearest';
  rounding_precision: number; // Decimal places

  // Weekend and Holiday Handling
  exclude_weekends_from_accrual: boolean;
  exclude_holidays_from_accrual: boolean;

  // Notification Settings
  notify_balance_low: boolean;
  balance_low_threshold: string;
  notify_accrual_processed: boolean;
}

const stackTokens: IStackTokens = {
  childrenGap: 20,
};

const validationSchema = Yup.object().shape({
  global_accrual_rate: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number')
    .required('Global accrual rate is required'),
  max_accrual_per_year: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number'),
  max_balance_limit: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number'),
  carryover_limit: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number'),
  carryover_expiry_months: Yup.number()
    .min(1, 'Must be at least 1 month')
    .max(24, 'Cannot exceed 24 months'),
  negative_balance_limit: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number'),
  balance_low_threshold: Yup.string()
    .matches(/^\d+(\.\d+)?$/, 'Must be a valid number'),
});

const AccrualSettings: React.FC<AccrualSettingsProps> = ({
  initialSettings,
  onSave,
  isLoading = false,
  className = ''
}) => {
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);

  const getInitialValues = useCallback((): AccrualSettingsData => {
    return initialSettings || {
      default_accrual_method: 'monthly',
      global_accrual_rate: '1.67', // ~20 days per year
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
    };
  }, [initialSettings]);

  // Dropdown options
  const accrualMethodOptions: IDropdownOption[] = [
    { key: 'monthly', text: 'Monthly Accrual' },
    { key: 'annual', text: 'Annual Allocation' },
    { key: 'per_shift', text: 'Per Shift Worked' },
    { key: 'length_of_service', text: 'Length of Service Based' }
  ];

  const frequencyOptions: IDropdownOption[] = [
    { key: 'monthly', text: 'Monthly' },
    { key: 'bi_weekly', text: 'Bi-weekly' },
    { key: 'weekly', text: 'Weekly' },
    { key: 'daily', text: 'Daily' }
  ];

  const proRatingMethodOptions: IDropdownOption[] = [
    { key: 'daily', text: 'Daily Pro-rating' },
    { key: 'monthly', text: 'Monthly Pro-rating' },
    { key: 'anniversary', text: 'Anniversary Based' }
  ];

  const carryoverMethodOptions: IDropdownOption[] = [
    { key: 'none', text: 'No Carryover' },
    { key: 'full', text: 'Full Carryover' },
    { key: 'partial', text: 'Partial Carryover' },
    { key: 'use_or_lose', text: 'Use or Lose' }
  ];

  const roundingMethodOptions: IDropdownOption[] = [
    { key: 'none', text: 'No Rounding' },
    { key: 'up', text: 'Round Up' },
    { key: 'down', text: 'Round Down' },
    { key: 'nearest', text: 'Round to Nearest' }
  ];

  const monthOptions: IDropdownOption[] = [
    { key: 1, text: 'January' }, { key: 2, text: 'February' }, { key: 3, text: 'March' },
    { key: 4, text: 'April' }, { key: 5, text: 'May' }, { key: 6, text: 'June' },
    { key: 7, text: 'July' }, { key: 8, text: 'August' }, { key: 9, text: 'September' },
    { key: 10, text: 'October' }, { key: 11, text: 'November' }, { key: 12, text: 'December' }
  ];

  const handleSubmit = useCallback(async (values: AccrualSettingsData) => {
    try {
      await onSave(values);
      setNotification({
        type: MessageBarType.success,
        message: 'Accrual settings saved successfully!'
      });
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to save accrual settings. Please try again.'
      });
    }
  }, [onSave]);

  // Clear notification after 5 seconds
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className={`accrual-settings ${className}`}>
      <Formik
        initialValues={getInitialValues()}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {(formik: FormikProps<AccrualSettingsData>) => (
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

              {/* Global Accrual Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ childrenGap: 16, padding: 20 }}>
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Icon iconName="CalendarSettings" styles={{ root: { color: '#0078d4' } }} />
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Global Accrual Settings
                    </Text>
                  </Stack>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field name="default_accrual_method">
                      {({ field, form }: any) => (
                        <Dropdown
                          label="Default Accrual Method"
                          selectedKey={field.value}
                          options={accrualMethodOptions}
                          onChange={(_, option) => form.setFieldValue('default_accrual_method', option?.key)}
                        />
                      )}
                    </Field>

                    <Field name="global_accrual_rate">
                      {({ field, meta }: any) => (
                        <TextField
                          label="Global Accrual Rate (days per period)"
                          {...field}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          description="Default rate when policies don't specify their own"
                        />
                      )}
                    </Field>

                    <Field name="max_accrual_per_year">
                      {({ field, meta }: any) => (
                        <TextField
                          label="Max Accrual Per Year"
                          {...field}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          description="Maximum days that can accrue in a year"
                        />
                      )}
                    </Field>

                    <Field name="max_balance_limit">
                      {({ field, meta }: any) => (
                        <TextField
                          label="Max Balance Limit"
                          {...field}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          description="Maximum balance an employee can accumulate"
                        />
                      )}
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field name="accrual_frequency">
                      {({ field, form }: any) => (
                        <Dropdown
                          label="Accrual Frequency"
                          selectedKey={field.value}
                          options={frequencyOptions}
                          onChange={(_, option) => form.setFieldValue('accrual_frequency', option?.key)}
                        />
                      )}
                    </Field>

                    <Field name="accrual_start_day">
                      {({ field, form }: any) => (
                        <SpinButton
                          label="Accrual Start Day (for monthly)"
                          min={1}
                          max={28}
                          value={field.value.toString()}
                          onIncrement={(value) => form.setFieldValue('accrual_start_day', parseInt(value) + 1)}
                          onDecrement={(value) => form.setFieldValue('accrual_start_day', Math.max(1, parseInt(value) - 1))}
                          onValidate={(value) => form.setFieldValue('accrual_start_day', parseInt(value) || 1)}
                        />
                      )}
                    </Field>
                  </div>
                </Stack>
              </div>

              {/* Pro-rating Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ childrenGap: 16, padding: 20 }}>
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Icon iconName="Calculator" styles={{ root: { color: '#107c10' } }} />
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Pro-rating Settings
                    </Text>
                  </Stack>

                  <Field name="enable_pro_rating">
                    {({ field, form }: any) => (
                      <Toggle
                        label="Enable Pro-rating"
                        checked={field.value}
                        onChange={(_, checked) => form.setFieldValue('enable_pro_rating', checked)}
                        onText="Enabled"
                        offText="Disabled"
                      />
                    )}
                  </Field>

                  {formik.values.enable_pro_rating && (
                    <Field name="pro_rating_method">
                      {({ field, form }: any) => (
                        <Dropdown
                          label="Pro-rating Method"
                          selectedKey={field.value}
                          options={proRatingMethodOptions}
                          onChange={(_, option) => form.setFieldValue('pro_rating_method', option?.key)}
                          styles={{ dropdown: { width: 200 } }}
                        />
                      )}
                    </Field>
                  )}
                </Stack>
              </div>

              {/* Carryover Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ childrenGap: 16, padding: 20 }}>
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Icon iconName="Forward" styles={{ root: { color: '#ff8c00' } }} />
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Carryover Settings
                    </Text>
                  </Stack>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field name="default_carryover_method">
                      {({ field, form }: any) => (
                        <Dropdown
                          label="Default Carryover Method"
                          selectedKey={field.value}
                          options={carryoverMethodOptions}
                          onChange={(_, option) => form.setFieldValue('default_carryover_method', option?.key)}
                        />
                      )}
                    </Field>

                    {formik.values.default_carryover_method === 'partial' && (
                      <Field name="carryover_limit">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Carryover Limit (days)"
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
                  </div>
                </Stack>
              </div>

              {/* Leave Year Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ childrenGap: 16, padding: 20 }}>
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Icon iconName="YearFilter" styles={{ root: { color: '#8a8886' } }} />
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Leave Year Settings
                    </Text>
                  </Stack>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field name="leave_year_start_month">
                      {({ field, form }: any) => (
                        <Dropdown
                          label="Leave Year Start Month"
                          selectedKey={field.value}
                          options={monthOptions}
                          onChange={(_, option) => form.setFieldValue('leave_year_start_month', option?.key)}
                        />
                      )}
                    </Field>

                    <Field name="leave_year_start_day">
                      {({ field, form }: any) => (
                        <SpinButton
                          label="Leave Year Start Day"
                          min={1}
                          max={28}
                          value={field.value.toString()}
                          onIncrement={(value) => form.setFieldValue('leave_year_start_day', parseInt(value) + 1)}
                          onDecrement={(value) => form.setFieldValue('leave_year_start_day', Math.max(1, parseInt(value) - 1))}
                          onValidate={(value) => form.setFieldValue('leave_year_start_day', parseInt(value) || 1)}
                        />
                      )}
                    </Field>
                  </div>
                </Stack>
              </div>

              {/* Advanced Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ childrenGap: 16, padding: 20 }}>
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Icon iconName="Settings" styles={{ root: { color: '#d13438' } }} />
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Advanced Settings
                    </Text>
                  </Stack>

                  {/* Negative Balance */}
                  <Stack tokens={{ childrenGap: 12 }}>
                    <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                      Negative Balance Settings
                    </Text>

                    <Field name="enable_negative_balance">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Allow Negative Balance"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('enable_negative_balance', checked)}
                        />
                      )}
                    </Field>

                    {formik.values.enable_negative_balance && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field name="negative_balance_limit">
                          {({ field, meta }: any) => (
                            <TextField
                              label="Negative Balance Limit"
                              {...field}
                              errorMessage={meta.touched && meta.error ? meta.error : ''}
                            />
                          )}
                        </Field>

                        <Field name="auto_approve_negative">
                          {({ field, form }: any) => (
                            <Toggle
                              label="Auto-approve Negative Balance"
                              checked={field.value}
                              onChange={(_, checked) => form.setFieldValue('auto_approve_negative', checked)}
                            />
                          )}
                        </Field>
                      </div>
                    )}
                  </Stack>

                  <Separator />

                  {/* Rounding Settings */}
                  <Stack tokens={{ childrenGap: 12 }}>
                    <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                      Rounding Settings
                    </Text>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field name="rounding_method">
                        {({ field, form }: any) => (
                          <Dropdown
                            label="Rounding Method"
                            selectedKey={field.value}
                            options={roundingMethodOptions}
                            onChange={(_, option) => form.setFieldValue('rounding_method', option?.key)}
                          />
                        )}
                      </Field>

                      {formik.values.rounding_method !== 'none' && (
                        <Field name="rounding_precision">
                          {({ field, form }: any) => (
                            <SpinButton
                              label="Decimal Places"
                              min={0}
                              max={4}
                              value={field.value.toString()}
                              onIncrement={(value) => form.setFieldValue('rounding_precision', parseInt(value) + 1)}
                              onDecrement={(value) => form.setFieldValue('rounding_precision', Math.max(0, parseInt(value) - 1))}
                              onValidate={(value) => form.setFieldValue('rounding_precision', parseInt(value) || 2)}
                            />
                          )}
                        </Field>
                      )}
                    </div>
                  </Stack>

                  <Separator />

                  {/* Weekend/Holiday Settings */}
                  <Stack tokens={{ childrenGap: 12 }}>
                    <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                      Weekend & Holiday Settings
                    </Text>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field name="exclude_weekends_from_accrual">
                        {({ field, form }: any) => (
                          <Toggle
                            label="Exclude Weekends from Accrual"
                            checked={field.value}
                            onChange={(_, checked) => form.setFieldValue('exclude_weekends_from_accrual', checked)}
                          />
                        )}
                      </Field>

                      <Field name="exclude_holidays_from_accrual">
                        {({ field, form }: any) => (
                          <Toggle
                            label="Exclude Holidays from Accrual"
                            checked={field.value}
                            onChange={(_, checked) => form.setFieldValue('exclude_holidays_from_accrual', checked)}
                          />
                        )}
                      </Field>
                    </div>
                  </Stack>

                  <Separator />

                  {/* Notification Settings */}
                  <Stack tokens={{ childrenGap: 12 }}>
                    <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                      Notification Settings
                    </Text>

                    <Field name="notify_balance_low">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Notify when balance is low"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('notify_balance_low', checked)}
                        />
                      )}
                    </Field>

                    {formik.values.notify_balance_low && (
                      <Field name="balance_low_threshold">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Low Balance Threshold (days)"
                            {...field}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                            styles={{ fieldGroup: { width: 200 } }}
                          />
                        )}
                      </Field>
                    )}

                    <Field name="notify_accrual_processed">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Notify when accrual is processed"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('notify_accrual_processed', checked)}
                        />
                      )}
                    </Field>
                  </Stack>
                </Stack>
              </div>

              {/* Form Actions */}
              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 12 }}>
                <DefaultButton
                  text="Reset to Defaults"
                  onClick={() => formik.resetForm()}
                  disabled={isLoading}
                />
                <PrimaryButton
                  text="Save Settings"
                  type="submit"
                  disabled={isLoading || !formik.isValid}
                  iconProps={{ iconName: 'Save' }}
                />
              </Stack>
            </Stack>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default AccrualSettings;