import React from 'react';
import {
  TextField,
  Dropdown,
  Stack,
  Text,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Checkbox,
  Toggle,
  IconButton,
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode,
  PrimaryButton
} from '@fluentui/react';
import {
  AdminRole,
  PlanType,
  BillingCycle,
  PaymentType
} from '../../../types/onboarding';
import type {
  OnboardingWizardData,
  AccountFinalizationData,
  AdminUser,
  ValidationError
} from '../../../types/onboarding';

interface AccountFinalizationStepProps {
  data: Partial<OnboardingWizardData>;
  onChange: (data: Partial<OnboardingWizardData>) => void;
  errors: ValidationError[];
  isLoading: boolean;
}

const AccountFinalizationStep: React.FC<AccountFinalizationStepProps> = ({
  data,
  onChange,
  errors,
  isLoading
}) => {
  const finalization = data.accountFinalization || {} as AccountFinalizationData;

  const updateFinalization = (updates: Partial<AccountFinalizationData>) => {
    onChange({
      accountFinalization: { ...finalization, ...updates }
    });
  };

  const updateSecuritySettings = (updates: Partial<AccountFinalizationData['securitySettings']>) => {
    updateFinalization({
      securitySettings: { ...finalization.securitySettings, ...updates }
    });
  };

  const updateBilling = (updates: Partial<AccountFinalizationData['billingInfo']>) => {
    updateFinalization({
      billingInfo: { ...finalization.billingInfo, ...updates }
    });
  };

  const updatePreferences = (updates: Partial<AccountFinalizationData['preferences']>) => {
    updateFinalization({
      preferences: { ...finalization.preferences, ...updates }
    });
  };

  const getFieldError = (fieldName: string): string | undefined => {
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  };

  // Admin role options
  const adminRoleOptions: IDropdownOption[] = [
    { key: AdminRole.SUPER_ADMIN, text: 'Super Administrator', data: { description: 'Full system access' } },
    { key: AdminRole.ADMIN, text: 'Administrator', data: { description: 'System administration' } },
    { key: AdminRole.MANAGER, text: 'Manager', data: { description: 'Staff and operations management' } },
    { key: AdminRole.HR_ADMIN, text: 'HR Administrator', data: { description: 'Human resources management' } },
    { key: AdminRole.FINANCE_ADMIN, text: 'Finance Administrator', data: { description: 'Financial operations' } }
  ];

  // Plan type options
  const planTypeOptions: IDropdownOption[] = [
    { key: PlanType.STARTER, text: 'Starter Plan', data: { price: '£29/month', description: 'Up to 25 staff' } },
    { key: PlanType.PROFESSIONAL, text: 'Professional Plan', data: { price: '£79/month', description: 'Up to 100 staff' } },
    { key: PlanType.ENTERPRISE, text: 'Enterprise Plan', data: { price: '£199/month', description: 'Unlimited staff' } },
    { key: PlanType.CUSTOM, text: 'Custom Plan', data: { price: 'Contact us', description: 'Tailored solution' } }
  ];

  // Billing cycle options
  const billingCycleOptions: IDropdownOption[] = [
    { key: BillingCycle.MONTHLY, text: 'Monthly', data: { discount: '0%' } },
    { key: BillingCycle.QUARTERLY, text: 'Quarterly', data: { discount: '5%' } },
    { key: BillingCycle.ANNUAL, text: 'Annual', data: { discount: '15%' } }
  ];

  // Admin users columns
  const adminUsersColumns: IColumn[] = [
    {
      key: 'name',
      name: 'Name',
      fieldName: 'name',
      minWidth: 150,
      maxWidth: 200,
      onRender: (item: AdminUser) => `${item.firstName} ${item.lastName}`
    },
    {
      key: 'email',
      name: 'Email',
      fieldName: 'email',
      minWidth: 200,
      maxWidth: 300
    },
    {
      key: 'role',
      name: 'Role',
      fieldName: 'role',
      minWidth: 120,
      maxWidth: 150,
      onRender: (item: AdminUser) => item.role.replace('_', ' ').toUpperCase()
    },
    {
      key: 'action',
      name: 'Action',
      fieldName: 'action',
      minWidth: 80,
      maxWidth: 80,
      onRender: (item: AdminUser, index?: number) => (
        <IconButton
          iconProps={{ iconName: 'Delete' }}
          title="Remove user"
          onClick={() => removeAdminUser(index || 0)}
          disabled={finalization.adminUsers?.length === 1} // Don't allow removing the last user
        />
      )
    }
  ];

  const addAdminUser = () => {
    const newUser: AdminUser = {
      firstName: '',
      lastName: '',
      email: '',
      role: AdminRole.ADMIN,
      permissions: []
    };
    const currentUsers = finalization.adminUsers || [];
    updateFinalization({ adminUsers: [...currentUsers, newUser] });
  };

  const removeAdminUser = (index: number) => {
    const currentUsers = finalization.adminUsers || [];
    if (currentUsers.length > 1) {
      const updatedUsers = currentUsers.filter((_, i) => i !== index);
      updateFinalization({ adminUsers: updatedUsers });
    }
  };

  const updateAdminUser = (index: number, updates: Partial<AdminUser>) => {
    const currentUsers = finalization.adminUsers || [];
    const updatedUsers = currentUsers.map((user, i) =>
      i === index ? { ...user, ...updates } : user
    );
    updateFinalization({ adminUsers: updatedUsers });
  };

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <MessageBar messageBarType={MessageBarType.info}>
        Complete your account setup by configuring admin users, security settings, and billing
        information. This is the final step before your system is ready to use.
      </MessageBar>

      {/* Admin Users */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Administrator Users
        </Text>

        <Text variant="medium" className="text-gray-600 mb-4">
          Set up admin users who will have access to system configuration and management.
        </Text>

        {/* Admin Users List */}
        {finalization.adminUsers && finalization.adminUsers.length > 0 && (
          <div className="mb-4">
            <DetailsList
              items={finalization.adminUsers}
              columns={adminUsersColumns}
              layoutMode={DetailsListLayoutMode.justified}
              selectionMode={SelectionMode.none}
              isHeaderVisible={true}
            />
          </div>
        )}

        {/* Add Admin User Form */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Text variant="mediumPlus" className="font-semibold mb-3">
            {finalization.adminUsers?.length > 0 ? 'Add Another Admin User' : 'Add Admin User'}
          </Text>

          <Stack tokens={{ childrenGap: 16 }}>
            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <TextField
                label="First Name"
                placeholder="First name"
                styles={{ root: { flex: 1 } }}
                disabled={isLoading}
              />
              <TextField
                label="Last Name"
                placeholder="Last name"
                styles={{ root: { flex: 1 } }}
                disabled={isLoading}
              />
            </Stack>

            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <TextField
                label="Email Address"
                type="email"
                placeholder="admin@company.com"
                styles={{ root: { flex: 2 } }}
                disabled={isLoading}
              />
              <Dropdown
                label="Role"
                options={adminRoleOptions}
                styles={{ root: { flex: 1 } }}
                disabled={isLoading}
              />
            </Stack>

            <PrimaryButton
              text="Add Admin User"
              iconProps={{ iconName: 'Add' }}
              onClick={addAdminUser}
              disabled={isLoading}
              styles={{ root: { alignSelf: 'flex-start' } }}
            />
          </Stack>
        </div>
      </div>

      {/* Security Settings */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Security Settings
        </Text>

        <div className="border rounded-lg p-6 space-y-6">
          <div>
            <Text variant="mediumPlus" className="font-semibold mb-3">
              Password Policy
            </Text>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Minimum Password Length"
                type="number"
                value={finalization.securitySettings?.passwordPolicy?.minLength?.toString() || '8'}
                onChange={(_, value) => updateSecuritySettings({
                  passwordPolicy: {
                    ...finalization.securitySettings?.passwordPolicy,
                    minLength: parseInt(value || '8')
                  }
                })}
                disabled={isLoading}
                min={6}
                max={50}
              />

              <TextField
                label="Password Expiry (days)"
                type="number"
                value={finalization.securitySettings?.passwordPolicy?.expiryDays?.toString() || '90'}
                onChange={(_, value) => updateSecuritySettings({
                  passwordPolicy: {
                    ...finalization.securitySettings?.passwordPolicy,
                    expiryDays: parseInt(value || '90')
                  }
                })}
                disabled={isLoading}
                min={30}
                max={365}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <Checkbox
                label="Require uppercase letters"
                checked={finalization.securitySettings?.passwordPolicy?.requireUppercase || false}
                onChange={(_, checked) => updateSecuritySettings({
                  passwordPolicy: {
                    ...finalization.securitySettings?.passwordPolicy,
                    requireUppercase: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="Require numbers"
                checked={finalization.securitySettings?.passwordPolicy?.requireNumbers || false}
                onChange={(_, checked) => updateSecuritySettings({
                  passwordPolicy: {
                    ...finalization.securitySettings?.passwordPolicy,
                    requireNumbers: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="Require lowercase letters"
                checked={finalization.securitySettings?.passwordPolicy?.requireLowercase || false}
                onChange={(_, checked) => updateSecuritySettings({
                  passwordPolicy: {
                    ...finalization.securitySettings?.passwordPolicy,
                    requireLowercase: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="Require symbols"
                checked={finalization.securitySettings?.passwordPolicy?.requireSymbols || false}
                onChange={(_, checked) => updateSecuritySettings({
                  passwordPolicy: {
                    ...finalization.securitySettings?.passwordPolicy,
                    requireSymbols: checked || false
                  }
                })}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <TextField
                label="Session Timeout (minutes)"
                type="number"
                value={finalization.securitySettings?.sessionTimeout?.toString() || '60'}
                onChange={(_, value) => updateSecuritySettings({
                  sessionTimeout: parseInt(value || '60')
                })}
                disabled={isLoading}
                min={15}
                max={480}
              />
            </div>

            <div>
              <TextField
                label="Data Retention Period (days)"
                type="number"
                value={finalization.securitySettings?.dataRetentionPeriod?.toString() || '365'}
                onChange={(_, value) => updateSecuritySettings({
                  dataRetentionPeriod: parseInt(value || '365')
                })}
                disabled={isLoading}
                min={30}
                max={2555} // 7 years
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Toggle
              label="Multi-Factor Authentication Required"
              checked={finalization.securitySettings?.mfaRequired || false}
              onChange={(_, checked) => updateSecuritySettings({
                mfaRequired: checked || false
              })}
              disabled={isLoading}
              onText="Required"
              offText="Optional"
            />

            <Toggle
              label="Audit Logging"
              checked={finalization.securitySettings?.auditLogging || false}
              onChange={(_, checked) => updateSecuritySettings({
                auditLogging: checked || false
              })}
              disabled={isLoading}
              onText="Enabled"
              offText="Disabled"
            />
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          Billing Information
        </Text>

        <div className="border rounded-lg p-6 space-y-6">
          <Stack horizontal tokens={{ childrenGap: 20 }}>
            <Dropdown
              label="Plan Type *"
              selectedKey={finalization.billingInfo?.planType}
              options={planTypeOptions}
              onChange={(_, option) => updateBilling({
                planType: option?.key as PlanType
              })}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
              onRenderOption={(option) => (
                <div>
                  <div className="font-medium">{option?.text}</div>
                  <div className="text-sm text-gray-600">
                    {option?.data?.price} - {option?.data?.description}
                  </div>
                </div>
              )}
            />

            <Dropdown
              label="Billing Cycle *"
              selectedKey={finalization.billingInfo?.billingCycle}
              options={billingCycleOptions}
              onChange={(_, option) => updateBilling({
                billingCycle: option?.key as BillingCycle
              })}
              disabled={isLoading}
              required
              styles={{ root: { flex: 1 } }}
              onRenderOption={(option) => (
                <div>
                  <div className="font-medium">{option?.text}</div>
                  <div className="text-sm text-green-600">
                    {option?.data?.discount} discount
                  </div>
                </div>
              )}
            />
          </Stack>
        </div>
      </div>

      {/* System Preferences */}
      <div>
        <Text variant="xLarge" className="font-semibold mb-4 block">
          System Preferences
        </Text>

        <div className="border rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TextField
              label="Timezone"
              value={finalization.preferences?.timezone || 'Europe/London'}
              onChange={(_, value) => updatePreferences({ timezone: value || 'Europe/London' })}
              disabled={isLoading}
            />

            <TextField
              label="Currency"
              value={finalization.preferences?.currency || 'GBP'}
              onChange={(_, value) => updatePreferences({ currency: value || 'GBP' })}
              disabled={isLoading}
            />

            <Dropdown
              label="Date Format"
              selectedKey={finalization.preferences?.dateFormat}
              options={[
                { key: 'DD/MM/YYYY', text: 'DD/MM/YYYY (UK)' },
                { key: 'MM/DD/YYYY', text: 'MM/DD/YYYY (US)' },
                { key: 'YYYY-MM-DD', text: 'YYYY-MM-DD (ISO)' }
              ]}
              onChange={(_, option) => updatePreferences({
                dateFormat: option?.key as string
              })}
              disabled={isLoading}
            />

            <Dropdown
              label="Time Format"
              selectedKey={finalization.preferences?.timeFormat}
              options={[
                { key: '24h', text: '24 Hour (14:30)' },
                { key: '12h', text: '12 Hour (2:30 PM)' }
              ]}
              onChange={(_, option) => updatePreferences({
                timeFormat: option?.key as string
              })}
              disabled={isLoading}
            />
          </div>

          <div>
            <Text variant="mediumPlus" className="font-semibold mb-3">
              Notification Preferences
            </Text>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Checkbox
                label="Email Notifications"
                checked={finalization.preferences?.notifications?.email || false}
                onChange={(_, checked) => updatePreferences({
                  notifications: {
                    ...finalization.preferences?.notifications,
                    email: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="SMS Notifications"
                checked={finalization.preferences?.notifications?.sms || false}
                onChange={(_, checked) => updatePreferences({
                  notifications: {
                    ...finalization.preferences?.notifications,
                    sms: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="Push Notifications"
                checked={finalization.preferences?.notifications?.pushNotifications || false}
                onChange={(_, checked) => updatePreferences({
                  notifications: {
                    ...finalization.preferences?.notifications,
                    pushNotifications: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="System Alerts"
                checked={finalization.preferences?.notifications?.systemAlerts || false}
                onChange={(_, checked) => updatePreferences({
                  notifications: {
                    ...finalization.preferences?.notifications,
                    systemAlerts: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="Shift Reminders"
                checked={finalization.preferences?.notifications?.shiftReminders || false}
                onChange={(_, checked) => updatePreferences({
                  notifications: {
                    ...finalization.preferences?.notifications,
                    shiftReminders: checked || false
                  }
                })}
                disabled={isLoading}
              />
              <Checkbox
                label="Compliance Alerts"
                checked={finalization.preferences?.notifications?.complianceAlerts || false}
                onChange={(_, checked) => updatePreferences({
                  notifications: {
                    ...finalization.preferences?.notifications,
                    complianceAlerts: checked || false
                  }
                })}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Final Confirmation */}
      <MessageBar messageBarType={MessageBarType.success}>
        <strong>Ready to Complete Setup!</strong>
        <br />
        Your onboarding configuration is complete. Click "Complete Setup" to finalize your
        account and start using the system.
      </MessageBar>
    </div>
  );
};

export default AccountFinalizationStep;