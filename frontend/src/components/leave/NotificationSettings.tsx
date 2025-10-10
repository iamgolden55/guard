import React, { useState, useCallback } from 'react';
import {
  Stack,
  Toggle,
  TextField,
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Text,
  IStackTokens
} from '@fluentui/react';
import { Formik, Form, Field, FormikProps } from 'formik';
import * as Yup from 'yup';

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

interface NotificationSettingsProps {
  initialSettings: NotificationSettingsData;
  onSave: (settings: NotificationSettingsData) => Promise<void>;
  isLoading?: boolean;
}

const stackTokens: IStackTokens = {
  childrenGap: 20,
};

const validationSchema = Yup.object().shape({
  reminder_days_before: Yup.number()
    .required('Reminder days is required')
    .min(1, 'Must be at least 1 day')
    .max(90, 'Cannot exceed 90 days'),
  digest_frequency: Yup.string()
    .required('Digest frequency is required')
    .oneOf(['daily', 'weekly', 'monthly'], 'Invalid frequency'),
});

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  initialSettings,
  onSave,
  isLoading = false
}) => {
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const digestFrequencyOptions: IDropdownOption[] = [
    { key: 'daily', text: 'Daily' },
    { key: 'weekly', text: 'Weekly' },
    { key: 'monthly', text: 'Monthly' }
  ];

  const handleSubmit = useCallback(async (values: NotificationSettingsData) => {
    try {
      setIsSaving(true);
      setNotification(null);

      await onSave(values);

      setNotification({
        type: MessageBarType.success,
        message: 'Notification settings saved successfully!'
      });
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to save notification settings. Please try again.'
      });
    } finally {
      setIsSaving(false);
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
    <div className="notification-settings">
      <Stack tokens={stackTokens}>
        {/* Notification Banner */}
        {notification && (
          <MessageBar
            messageBarType={notification.type}
            onDismiss={() => setNotification(null)}
            dismissButtonAriaLabel="Close"
          >
            {notification.message}
          </MessageBar>
        )}

        <Formik
          initialValues={initialSettings}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {(formik: FormikProps<NotificationSettingsData>) => (
            <Form>
              <Stack tokens={stackTokens}>
                {/* Header */}
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                  <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
                    Notification Settings
                  </Text>
                </Stack>

                <Text variant="medium" styles={{ root: { color: '#666' } }}>
                  Configure how and when the system sends notifications to users and managers.
                </Text>

                {/* Email & SMS Notifications */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 16 } }}>
                    Notification Channels
                  </Text>

                  <Stack tokens={{ childrenGap: 16 }}>
                    <Field name="email_notifications">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Email Notifications"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('email_notifications', checked)}
                          onText="Enabled"
                          offText="Disabled"
                          styles={{ root: { marginBottom: 8 } }}
                        />
                      )}
                    </Field>
                    <Text variant="small" styles={{ root: { color: '#666', marginTop: -8 } }}>
                      Send email notifications for leave requests, approvals, and reminders
                    </Text>

                    <Field name="sms_notifications">
                      {({ field, form }: any) => (
                        <Toggle
                          label="SMS Notifications"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('sms_notifications', checked)}
                          onText="Enabled"
                          offText="Disabled"
                          styles={{ root: { marginBottom: 8 } }}
                        />
                      )}
                    </Field>
                    <Text variant="small" styles={{ root: { color: '#666', marginTop: -8 } }}>
                      Send SMS alerts for urgent notifications (requires SMS gateway configuration)
                    </Text>
                  </Stack>
                </div>

                {/* Event-Based Notifications */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 16 } }}>
                    Event Notifications
                  </Text>

                  <Stack tokens={{ childrenGap: 16 }}>
                    <Field name="manager_approval_notifications">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Manager Approval Notifications"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('manager_approval_notifications', checked)}
                          onText="Enabled"
                          offText="Disabled"
                          styles={{ root: { marginBottom: 8 } }}
                        />
                      )}
                    </Field>
                    <Text variant="small" styles={{ root: { color: '#666', marginTop: -8 } }}>
                      Notify managers when new leave requests require approval
                    </Text>

                    <Field name="employee_request_notifications">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Employee Request Notifications"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('employee_request_notifications', checked)}
                          onText="Enabled"
                          offText="Disabled"
                          styles={{ root: { marginBottom: 8 } }}
                        />
                      )}
                    </Field>
                    <Text variant="small" styles={{ root: { color: '#666', marginTop: -8 } }}>
                      Notify employees about status changes on their leave requests
                    </Text>

                    <Field name="balance_threshold_notifications">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Balance Threshold Notifications"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('balance_threshold_notifications', checked)}
                          onText="Enabled"
                          offText="Disabled"
                          styles={{ root: { marginBottom: 8 } }}
                        />
                      )}
                    </Field>
                    <Text variant="small" styles={{ root: { color: '#666', marginTop: -8 } }}>
                      Alert employees when their leave balance is running low
                    </Text>

                    <Field name="accrual_processing_notifications">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Accrual Processing Notifications"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('accrual_processing_notifications', checked)}
                          onText="Enabled"
                          offText="Disabled"
                          styles={{ root: { marginBottom: 8 } }}
                        />
                      )}
                    </Field>
                    <Text variant="small" styles={{ root: { color: '#666', marginTop: -8 } }}>
                      Notify admins when leave accrual processing completes
                    </Text>
                  </Stack>
                </div>

                {/* Reminder Settings */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <Text variant="large" styles={{ root: { fontWeight: 600, marginBottom: 16 } }}>
                    Reminder Settings
                  </Text>

                  <Stack tokens={{ childrenGap: 16 }}>
                    <Field name="reminder_days_before">
                      {({ field, meta }: any) => (
                        <TextField
                          label="Reminder Days Before"
                          description="Number of days before leave expiry to send reminder"
                          type="number"
                          min="1"
                          max="90"
                          {...field}
                          value={String(field.value)}
                          onChange={(_, newValue) => {
                            const numValue = newValue ? Number(newValue) : 7;
                            formik.setFieldValue('reminder_days_before', numValue);
                          }}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          styles={{ root: { maxWidth: 200 } }}
                        />
                      )}
                    </Field>

                    <Field name="digest_frequency">
                      {({ field, meta, form }: any) => (
                        <Dropdown
                          label="Digest Frequency"
                          description="How often to send summary email digests"
                          selectedKey={field.value}
                          options={digestFrequencyOptions}
                          onChange={(_, option) => form.setFieldValue('digest_frequency', option?.key)}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                          styles={{ dropdown: { maxWidth: 200 } }}
                        />
                      )}
                    </Field>
                  </Stack>
                </div>

                {/* Form Actions */}
                <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                  <DefaultButton
                    text="Reset"
                    onClick={() => formik.resetForm()}
                    disabled={isSaving || isLoading}
                  />
                  <PrimaryButton
                    text="Save Settings"
                    type="submit"
                    disabled={!formik.isValid || isSaving || isLoading}
                    iconProps={{ iconName: 'Save' }}
                  />
                </Stack>
              </Stack>
            </Form>
          )}
        </Formik>
      </Stack>
    </div>
  );
};

export default NotificationSettings;
