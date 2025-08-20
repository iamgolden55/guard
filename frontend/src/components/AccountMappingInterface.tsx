import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  Dropdown,
  type IDropdownOption,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Icon,
  Dialog,
  DialogType,
  DialogFooter,
  Toggle,
  TextField
} from '@fluentui/react';
import { financeIntegrationsService } from '../services';
import type {
  AccountMapping,
  ProviderAccount,
  ProviderConnection
} from '../services/financeIntegrationsService';

interface AccountMappingInterfaceProps {
  connection: ProviderConnection;
  onMappingsChange?: () => void;
}

const AccountMappingInterface: React.FC<AccountMappingInterfaceProps> = ({
  connection,
  onMappingsChange
}) => {
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMapping, setEditingMapping] = useState<AccountMapping | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state for create/edit dialog
  const [formData, setFormData] = useState({
    mapping_type: 'revenue' as 'revenue' | 'expense' | 'liability' | 'asset' | 'equity',
    local_account_name: '',
    provider_account_id: '',
    is_default: false
  });

  // Local account types that can be mapped
  const localAccountTypes = [
    { key: 'revenue', text: 'Revenue (Invoice Income)', description: 'Where invoice payments are recorded' },
    { key: 'expense', text: 'Expense (Staff Wages)', description: 'Where staff wages are recorded' },
    { key: 'liability', text: 'Liability (PAYE/NI)', description: 'Tax and National Insurance' },
    { key: 'asset', text: 'Asset (Cash/Bank)', description: 'Cash or bank accounts' },
    { key: 'equity', text: 'Equity (Retained Earnings)', description: 'Business equity accounts' }
  ];

  useEffect(() => {
    loadData();
  }, [connection.id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [mappingsData, accountsData] = await Promise.all([
        financeIntegrationsService.getAccountMappings(connection.id),
        financeIntegrationsService.getProviderAccounts(connection.id)
      ]);

      setMappings(mappingsData);
      setProviderAccounts(accountsData);

    } catch (error: any) {
      console.error('Failed to load account mapping data:', error);
      setError('Failed to load account mapping data. Please ensure the connection is working.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMapping = () => {
    setEditingMapping(null);
    setFormData({
      mapping_type: 'revenue',
      local_account_name: '',
      provider_account_id: '',
      is_default: false
    });
    setShowCreateDialog(true);
  };

  const handleEditMapping = (mapping: AccountMapping) => {
    setEditingMapping(mapping);
    setFormData({
      mapping_type: mapping.mapping_type,
      local_account_name: mapping.local_account_name,
      provider_account_id: mapping.provider_account_id,
      is_default: mapping.is_default
    });
    setShowCreateDialog(true);
  };

  const handleSaveMapping = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      const mappingData = {
        connection: connection.id,
        mapping_type: formData.mapping_type,
        local_account_name: formData.local_account_name,
        provider_account_id: formData.provider_account_id,
        is_default: formData.is_default
      };

      if (editingMapping) {
        await financeIntegrationsService.updateAccountMapping(editingMapping.id, mappingData);
        setSuccess('Account mapping updated successfully.');
      } else {
        await financeIntegrationsService.createAccountMapping(mappingData);
        setSuccess('Account mapping created successfully.');
      }

      setShowCreateDialog(false);
      await loadData();
      onMappingsChange?.();

      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error('Failed to save account mapping:', error);
      setError('Failed to save account mapping. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMapping = async (mapping: AccountMapping) => {
    if (!window.confirm(`Are you sure you want to delete the mapping for "${mapping.local_account_name}"?`)) {
      return;
    }

    try {
      setError(null);
      await financeIntegrationsService.deleteAccountMapping(mapping.id);
      setSuccess('Account mapping deleted successfully.');
      await loadData();
      onMappingsChange?.();
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error('Failed to delete account mapping:', error);
      setError('Failed to delete account mapping. Please try again.');
    }
  };

  const getAccountTypeDescription = (type: string): string => {
    const accountType = localAccountTypes.find(t => t.key === type);
    return accountType ? accountType.description : '';
  };

  const getProviderAccountName = (accountId: string): string => {
    const account = providerAccounts.find(a => a.id === accountId);
    return account ? `${account.name}${account.code ? ` (${account.code})` : ''}` : accountId;
  };

  // Provider account options for dropdown
  const providerAccountOptions: IDropdownOption[] = providerAccounts
    .filter(account => account.is_active)
    .map(account => ({
      key: account.id,
      text: `${account.name}${account.code ? ` (${account.code})` : ''} - ${account.type}`
    }));

  // Account type options for dropdown
  const accountTypeOptions: IDropdownOption[] = localAccountTypes.map(type => ({
    key: type.key,
    text: type.text,
    data: type.description
  }));

  // Column definitions for mappings table
  const mappingColumns: IColumn[] = [
    {
      key: 'local_account',
      name: 'Local Account Type',
      fieldName: 'mapping_type',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: AccountMapping) => (
        <Stack>
          <Text style={{ fontWeight: 600 }}>{item.local_account_name}</Text>
          <Text variant="small" style={{ color: '#666' }}>
            {getAccountTypeDescription(item.mapping_type)}
          </Text>
        </Stack>
      )
    },
    {
      key: 'provider_account',
      name: `${connection.provider_name} Account`,
      fieldName: 'provider_account_name',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
      onRender: (item: AccountMapping) => (
        <Stack>
          <Text>{item.provider_account_name}</Text>
          <Text variant="small" style={{ color: '#666' }}>
            ID: {item.provider_account_id}
          </Text>
        </Stack>
      )
    },
    {
      key: 'is_default',
      name: 'Default',
      fieldName: 'is_default',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: AccountMapping) => (
        <Stack horizontal tokens={{ childrenGap: 4 }} verticalAlign="center">
          {item.is_default && <Icon iconName="CheckMark" style={{ color: 'green' }} />}
          <Text>{item.is_default ? 'Yes' : 'No'}</Text>
        </Stack>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: AccountMapping) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <DefaultButton
            text="Edit"
            iconProps={{ iconName: 'Edit' }}
            onClick={() => handleEditMapping(item)}
          />
          <DefaultButton
            text="Delete"
            iconProps={{ iconName: 'Delete' }}
            onClick={() => handleDeleteMapping(item)}
            style={{ color: 'red' }}
          />
        </Stack>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={SpinnerSize.large} label="Loading account mappings..." />
      </div>
    );
  }

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Stack>
          <Text variant="large" style={{ fontWeight: 600 }}>
            Account Mappings for {connection.provider_name}
          </Text>
          <Text variant="medium" style={{ color: '#666' }}>
            Map local account types to specific accounts in your {connection.provider_name} chart of accounts
          </Text>
        </Stack>
        <PrimaryButton
          text="Create Mapping"
          iconProps={{ iconName: 'Add' }}
          onClick={handleCreateMapping}
        />
      </Stack>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setError(null)}
        >
          {error}
        </MessageBar>
      )}

      {success && (
        <MessageBar
          messageBarType={MessageBarType.success}
          onDismiss={() => setSuccess(null)}
        >
          {success}
        </MessageBar>
      )}

      {mappings.length === 0 ? (
        <div className="text-center py-8">
          <Icon iconName="AccountActivity" style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
          <Text variant="large">No account mappings configured</Text>
          <Text>Create mappings to specify which {connection.provider_name} accounts to use for different transaction types.</Text>
          <PrimaryButton
            text="Create First Mapping"
            iconProps={{ iconName: 'Add' }}
            onClick={handleCreateMapping}
            style={{ marginTop: 16 }}
          />
        </div>
      ) : (
        <DetailsList
          items={mappings}
          columns={mappingColumns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
        />
      )}

      {/* Create/Edit Mapping Dialog */}
      <Dialog
        hidden={!showCreateDialog}
        onDismiss={() => setShowCreateDialog(false)}
        dialogContentProps={{
          type: DialogType.largeHeader,
          title: editingMapping ? 'Edit Account Mapping' : 'Create Account Mapping',
          subText: `Configure how local account types map to ${connection.provider_name} accounts.`
        }}
        minWidth={600}
      >
        <Stack tokens={{ childrenGap: 16 }}>
          <Dropdown
            label="Local Account Type"
            placeholder="Select account type"
            options={accountTypeOptions}
            selectedKey={formData.mapping_type}
            onChange={(_, option) => setFormData(prev => ({ ...prev, mapping_type: option?.key as any }))}
            required
          />

          <TextField
            label="Local Account Name"
            placeholder="Enter descriptive name (e.g., 'Security Services Revenue')"
            value={formData.local_account_name}
            onChange={(_, value) => setFormData(prev => ({ ...prev, local_account_name: value || '' }))}
            required
          />

          <Dropdown
            label={`${connection.provider_name} Account`}
            placeholder="Select provider account"
            options={providerAccountOptions}
            selectedKey={formData.provider_account_id}
            onChange={(_, option) => setFormData(prev => ({ ...prev, provider_account_id: option?.key as string }))}
            required
          />

          <Toggle
            label="Set as Default"
            inlineLabel
            checked={formData.is_default}
            onChange={(_, checked) => setFormData(prev => ({ ...prev, is_default: checked || false }))}
          />
          <Text variant="small" style={{ color: '#666' }}>
            Use this account as the default for this account type when no specific mapping is found.
          </Text>
        </Stack>

        <DialogFooter>
          <PrimaryButton
            onClick={handleSaveMapping}
            text={editingMapping ? 'Update' : 'Create'}
            disabled={!formData.local_account_name || !formData.provider_account_id || isProcessing}
          />
          <DefaultButton 
            onClick={() => setShowCreateDialog(false)} 
            text="Cancel"
            disabled={isProcessing}
          />
        </DialogFooter>
      </Dialog>
    </Stack>
  );
};

export default AccountMappingInterface;