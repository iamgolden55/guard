import React, { useState, useCallback } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  Selection,
  SelectionMode,
  CommandBar,
  ICommandBarItemProps,
  Stack,
  Text,
  DefaultButton,
  PrimaryButton,
  IconButton,
  TooltipHost,
  Modal,
  MessageBar,
  MessageBarType,
  TextField,
  Dropdown,
  IDropdownOption,
  Toggle
} from '@fluentui/react';
import { LeavePolicy, EmploymentType } from '../../types/leave';

interface PolicyListTableProps {
  policies: LeavePolicy[];
  employmentTypes: EmploymentType[];
  isLoading?: boolean;
  onEdit?: (policy: LeavePolicy) => void;
  onDelete?: (policyId: number) => void;
  onActivate?: (policyId: number, isActive: boolean) => void;
  onRefresh?: () => void;
  className?: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  actionType: 'delete' | 'activate' | 'deactivate';
  policyId: number | null;
}

const PolicyListTable: React.FC<PolicyListTableProps> = ({
  policies,
  employmentTypes,
  isLoading = false,
  onEdit,
  onDelete,
  onActivate,
  onRefresh,
  className = ''
}) => {
  const [selection] = useState(() => new Selection());
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPolicies, setFilteredPolicies] = useState(policies);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'delete',
    policyId: null
  });
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);

  // Filter policies based on search term
  React.useEffect(() => {
    if (!searchTerm) {
      setFilteredPolicies(policies);
    } else {
      const filtered = policies.filter(policy =>
        policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        policy.leave_type.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPolicies(filtered);
    }
  }, [policies, searchTerm]);

  // Get employment type names
  const getEmploymentTypeNames = (employmentTypeIds: EmploymentType[]) => {
    return employmentTypeIds.map(et => et.name).join(', ') || 'All Types';
  };

  // Format accrual method display
  const formatAccrualMethod = (method: string) => {
    return method
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format carryover method display
  const formatCarryoverMethod = (method: string) => {
    return method
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Handle confirmation actions
  const handleConfirmAction = useCallback(async () => {
    if (!confirmModal.policyId) return;

    try {
      switch (confirmModal.actionType) {
        case 'delete':
          await onDelete?.(confirmModal.policyId);
          setNotification({
            type: MessageBarType.success,
            message: 'Policy deleted successfully!'
          });
          break;
        case 'activate':
          await onActivate?.(confirmModal.policyId, true);
          setNotification({
            type: MessageBarType.success,
            message: 'Policy activated successfully!'
          });
          break;
        case 'deactivate':
          await onActivate?.(confirmModal.policyId, false);
          setNotification({
            type: MessageBarType.success,
            message: 'Policy deactivated successfully!'
          });
          break;
      }

      setConfirmModal({
        isOpen: false,
        title: '',
        message: '',
        actionType: 'delete',
        policyId: null
      });

      onRefresh?.();
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Action failed. Please try again.'
      });
    }
  }, [confirmModal, onDelete, onActivate, onRefresh]);

  // Open confirmation modal
  const openConfirmModal = useCallback((actionType: 'delete' | 'activate' | 'deactivate', policyId: number, policyName: string) => {
    const titles = {
      delete: 'Delete Policy',
      activate: 'Activate Policy',
      deactivate: 'Deactivate Policy'
    };

    const messages = {
      delete: `Are you sure you want to delete the policy "${policyName}"? This action cannot be undone.`,
      activate: `Are you sure you want to activate the policy "${policyName}"?`,
      deactivate: `Are you sure you want to deactivate the policy "${policyName}"? This will prevent new entitlements from being created.`
    };

    setConfirmModal({
      isOpen: true,
      title: titles[actionType],
      message: messages[actionType],
      actionType,
      policyId
    });
  }, []);

  // Define columns
  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Policy Name',
      fieldName: 'name',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
      onRender: (policy: LeavePolicy) => (
        <Stack>
          <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
            {policy.name}
          </Text>
          <Text variant="small" styles={{ root: { color: '#666' } }}>
            {policy.leave_type.name}
          </Text>
        </Stack>
      )
    },
    {
      key: 'employment_types',
      name: 'Employment Types',
      fieldName: 'employment_types',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (policy: LeavePolicy) => (
        <Text variant="small">
          {getEmploymentTypeNames(policy.employment_types)}
        </Text>
      )
    },
    {
      key: 'accrual_method',
      name: 'Accrual Method',
      fieldName: 'accrual_method',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (policy: LeavePolicy) => (
        <Text variant="small">
          {formatAccrualMethod(policy.accrual_method)}
        </Text>
      )
    },
    {
      key: 'accrual_rate',
      name: 'Accrual Rate',
      fieldName: 'accrual_rate',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (policy: LeavePolicy) => (
        <Text variant="small">
          {policy.accrual_rate} days
        </Text>
      )
    },
    {
      key: 'carryover_method',
      name: 'Carryover',
      fieldName: 'carryover_method',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (policy: LeavePolicy) => (
        <Text variant="small">
          {formatCarryoverMethod(policy.carryover_method)}
        </Text>
      )
    },
    {
      key: 'effective_date',
      name: 'Effective Date',
      fieldName: 'effective_date',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (policy: LeavePolicy) => (
        <Text variant="small">
          {new Date(policy.effective_date).toLocaleDateString()}
        </Text>
      )
    },
    {
      key: 'is_active',
      name: 'Status',
      fieldName: 'is_active',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (policy: LeavePolicy) => (
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          policy.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {policy.is_active ? 'Active' : 'Inactive'}
        </div>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      fieldName: 'actions',
      minWidth: 150,
      maxWidth: 200,
      isResizable: false,
      onRender: (policy: LeavePolicy) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <TooltipHost content="Edit policy">
            <IconButton
              iconProps={{ iconName: 'Edit' }}
              onClick={() => onEdit?.(policy)}
            />
          </TooltipHost>

          <TooltipHost content={policy.is_active ? 'Deactivate policy' : 'Activate policy'}>
            <IconButton
              iconProps={{ iconName: policy.is_active ? 'BlockContact' : 'CheckMark' }}
              onClick={() => openConfirmModal(
                policy.is_active ? 'deactivate' : 'activate',
                policy.id,
                policy.name
              )}
            />
          </TooltipHost>

          <TooltipHost content="Delete policy">
            <IconButton
              iconProps={{ iconName: 'Delete' }}
              onClick={() => openConfirmModal('delete', policy.id, policy.name)}
              styles={{ root: { color: '#d13438' } }}
            />
          </TooltipHost>
        </Stack>
      )
    }
  ];

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'new',
      text: 'New Policy',
      iconProps: { iconName: 'Add' },
      onClick: () => onEdit?.(null as any), // This will trigger create mode
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: onRefresh,
    }
  ];

  // Clear notification after 5 seconds
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className={`policy-list-table ${className}`}>
      <Stack tokens={{ childrenGap: 16 }}>
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

        {/* Header and Search */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
            Leave Policies
          </Text>

          <TextField
            placeholder="Search policies..."
            iconProps={{ iconName: 'Search' }}
            value={searchTerm}
            onChange={(_, newValue) => setSearchTerm(newValue || '')}
            styles={{ root: { width: 300 } }}
          />
        </Stack>

        {/* Command Bar */}
        <CommandBar items={commandBarItems} />

        {/* Data Table */}
        <DetailsList
          items={filteredPolicies}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selection={selection}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
          onRenderMissingItem={() => null}
          styles={{
            root: {
              backgroundColor: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '4px'
            },
            headerWrapper: {
              '& [role="row"]': {
                backgroundColor: '#f8f9fa',
                fontWeight: '600'
              }
            }
          }}
        />

        {filteredPolicies.length === 0 && !isLoading && (
          <Stack horizontalAlign="center" tokens={{ padding: 40 }}>
            <Text variant="large" styles={{ root: { color: '#666' } }}>
              {searchTerm ? 'No policies found matching your search.' : 'No leave policies configured yet.'}
            </Text>
            {!searchTerm && (
              <PrimaryButton
                text="Create First Policy"
                iconProps={{ iconName: 'Add' }}
                onClick={() => onEdit?.(null as any)}
                styles={{ root: { marginTop: 16 } }}
              />
            )}
          </Stack>
        )}
      </Stack>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onDismiss={() => setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          actionType: 'delete',
          policyId: null
        })}
        containerClassName="confirmation-modal"
      >
        <div className="p-6 bg-white min-w-96">
          <Stack tokens={{ childrenGap: 16 }}>
            <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
              {confirmModal.title}
            </Text>

            <Text variant="medium">
              {confirmModal.message}
            </Text>

            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
              <DefaultButton
                text="Cancel"
                onClick={() => setConfirmModal({
                  isOpen: false,
                  title: '',
                  message: '',
                  actionType: 'delete',
                  policyId: null
                })}
              />
              <PrimaryButton
                text="Confirm"
                onClick={handleConfirmAction}
                styles={{
                  root: {
                    backgroundColor: confirmModal.actionType === 'delete' ? '#d13438' : '#0078d4',
                    borderColor: confirmModal.actionType === 'delete' ? '#d13438' : '#0078d4',
                  }
                }}
              />
            </Stack>
          </Stack>
        </div>
      </Modal>
    </div>
  );
};

export default PolicyListTable;