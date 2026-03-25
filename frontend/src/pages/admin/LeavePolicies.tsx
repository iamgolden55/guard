import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IStackTokens,
  DefaultButton,
  IconButton
} from '@fluentui/react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services';
import api from '../../services/api';
import {
  LeavePolicy,
  LeaveType,
  EmploymentType
} from '../../types/leave';
import PolicyListTable from '../../components/leave/PolicyListTable';
import PolicyDetailsForm from '../../components/leave/PolicyDetailsForm';

const stackTokens: IStackTokens = {
  childrenGap: 24,
  padding: 16,
};

const LeavePolicies: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<LeavePolicy | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!authState.user) return;

    setIsLoading(true);
    try {
      // Fetch policies, leave types, and employment types in parallel
      const [policiesResponse, leaveTypesResponse, employmentTypesResponse] = await Promise.allSettled([
        leaveService.getLeavePolicies(),
        leaveService.getLeaveTypes(false), // Include inactive types for admin view
        fetchEmploymentTypes() // This would need to be implemented in your service
      ]);

      // Handle policies
      if (policiesResponse.status === 'fulfilled' && Array.isArray(policiesResponse.value)) {
        setPolicies(policiesResponse.value);
      } else {
        console.error('Failed to fetch policies:', policiesResponse.status === 'rejected' ? policiesResponse.reason : 'Invalid response');
        setPolicies([]); // Ensure it's always an array
      }

      // Handle leave types
      if (leaveTypesResponse.status === 'fulfilled' && Array.isArray(leaveTypesResponse.value)) {
        setLeaveTypes(leaveTypesResponse.value);
      } else {
        console.error('Failed to fetch leave types:', leaveTypesResponse.status === 'rejected' ? leaveTypesResponse.reason : 'Invalid response');
        setLeaveTypes([]);
      }

      // Handle employment types
      if (employmentTypesResponse.status === 'fulfilled' && Array.isArray(employmentTypesResponse.value)) {
        setEmploymentTypes(employmentTypesResponse.value);
      } else {
        console.error('Failed to fetch employment types:', employmentTypesResponse.status === 'rejected' ? employmentTypesResponse.reason : 'Invalid response');
        setEmploymentTypes([]);
      }

    } catch (error) {
      console.error('Error fetching policies data:', error);
      // Ensure all arrays are initialized even on error
      setPolicies([]);
      setLeaveTypes([]);
      setEmploymentTypes([]);
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to load policies data. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [authState.user]);

  // Mock employment types data - replace with actual API call when endpoint is available
  const fetchEmploymentTypes = async (): Promise<EmploymentType[]> => {
    // Return mock data to avoid API errors
    return Promise.resolve([
      { id: 1, name: 'Full-time', description: 'Full-time employee', is_active: true },
      { id: 2, name: 'Part-time', description: 'Part-time employee', is_active: true },
      { id: 3, name: 'Contract', description: 'Contract worker', is_active: true }
    ]);
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Handle policy edit
  const handleEditPolicy = useCallback((policy: LeavePolicy | null) => {
    setSelectedPolicy(policy);
    setIsFormOpen(true);
  }, []);

  // Handle policy save
  const handleSavePolicy = useCallback(async (policyData: Partial<LeavePolicy>) => {
    setIsFormLoading(true);
    try {
      if (selectedPolicy) {
        // Update existing policy
        await updatePolicy(selectedPolicy.id, policyData);
        setNotification({
          type: MessageBarType.success,
          message: 'Policy updated successfully!'
        });
      } else {
        // Create new policy
        await createPolicy(policyData);
        setNotification({
          type: MessageBarType.success,
          message: 'Policy created successfully!'
        });
      }

      setIsFormOpen(false);
      setSelectedPolicy(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error saving policy:', error);
      setNotification({
        type: MessageBarType.error,
        message: `Failed to ${selectedPolicy ? 'update' : 'create'} policy. Please try again.`
      });
    } finally {
      setIsFormLoading(false);
    }
  }, [selectedPolicy]);

  // Create policy API call
  const createPolicy = async (policyData: Partial<LeavePolicy>): Promise<LeavePolicy> => {
    const { data } = await api.post('/api/v1/leave-policies/', {
      name: policyData.name,
      leave_type_id: policyData.leave_type?.id,
      employment_type_ids: policyData.employment_types?.map(et => et.id),
      accrual_method: policyData.accrual_method,
      accrual_rate: policyData.accrual_rate,
      max_accrual_per_year: policyData.max_accrual_per_year,
      max_balance: policyData.max_balance,
      service_brackets: policyData.service_brackets,
      carryover_method: policyData.carryover_method,
      carryover_limit: policyData.carryover_limit,
      carryover_expiry_months: policyData.carryover_expiry_months,
      probation_months: policyData.probation_months,
      min_employment_days: policyData.min_employment_days,
      allow_negative_balance: policyData.allow_negative_balance,
      negative_balance_limit: policyData.negative_balance_limit,
      is_active: policyData.is_active,
      effective_date: policyData.effective_date,
      expiry_date: policyData.expiry_date
    });

    return data;
  };

  // Update policy API call
  const updatePolicy = async (policyId: number, policyData: Partial<LeavePolicy>): Promise<LeavePolicy> => {
    const { data } = await api.put(`/api/v1/leave-policies/${policyId}/`, {
      name: policyData.name,
      leave_type_id: policyData.leave_type?.id,
      employment_type_ids: policyData.employment_types?.map(et => et.id),
      accrual_method: policyData.accrual_method,
      accrual_rate: policyData.accrual_rate,
      max_accrual_per_year: policyData.max_accrual_per_year,
      max_balance: policyData.max_balance,
      service_brackets: policyData.service_brackets,
      carryover_method: policyData.carryover_method,
      carryover_limit: policyData.carryover_limit,
      carryover_expiry_months: policyData.carryover_expiry_months,
      probation_months: policyData.probation_months,
      min_employment_days: policyData.min_employment_days,
      allow_negative_balance: policyData.allow_negative_balance,
      negative_balance_limit: policyData.negative_balance_limit,
      is_active: policyData.is_active,
      effective_date: policyData.effective_date,
      expiry_date: policyData.expiry_date
    });

    return data;
  };

  // Handle policy delete
  const handleDeletePolicy = useCallback(async (policyId: number) => {
    try {
      await api.delete(`/api/v1/leave-policies/${policyId}/`);

      setNotification({
        type: MessageBarType.success,
        message: 'Policy deleted successfully!'
      });

      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting policy:', error);
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to delete policy. Please try again.'
      });
    }
  }, []);

  // Handle policy activate/deactivate
  const handleActivatePolicy = useCallback(async (policyId: number, isActive: boolean) => {
    try {
      await api.post(`/api/v1/leave-policies/${policyId}/${isActive ? 'activate' : 'deactivate'}/`);

      setNotification({
        type: MessageBarType.success,
        message: `Policy ${isActive ? 'activated' : 'deactivated'} successfully!`
      });

      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error(`Error ${isActive ? 'activating' : 'deactivating'} policy:`, error);
      setNotification({
        type: MessageBarType.error,
        message: `Failed to ${isActive ? 'activate' : 'deactivate'} policy. Please try again.`
      });
    }
  }, []);

  // Handle form cancel
  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false);
    setSelectedPolicy(null);
  }, []);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (isLoading) {
    return (
      <div className="leave-policies-page">
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading leave policies..." />
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
              Leave Policies
            </Text>
            <Text variant="medium" styles={{ root: { color: '#666' } }}>
              Configure leave policies for different employment types and leave categories
            </Text>
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <DefaultButton
              text="Import Policies"
              iconProps={{ iconName: 'Upload' }}
            />
            <DefaultButton
              text="Export Policies"
              iconProps={{ iconName: 'Download' }}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                {policies.length}
              </Text>
              <Text variant="medium">Total Policies</Text>
            </Stack>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                {policies.filter(p => p.is_active).length}
              </Text>
              <Text variant="medium">Active Policies</Text>
            </Stack>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#ff8c00' } }}>
                {leaveTypes.length}
              </Text>
              <Text variant="medium">Leave Types</Text>
            </Stack>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#8a8886' } }}>
                {employmentTypes.length}
              </Text>
              <Text variant="medium">Employment Types</Text>
            </Stack>
          </div>
        </div>

        {/* Policies Table */}
        <PolicyListTable
          policies={policies}
          employmentTypes={employmentTypes}
          isLoading={isLoading}
          onEdit={handleEditPolicy}
          onDelete={handleDeletePolicy}
          onActivate={handleActivatePolicy}
          onRefresh={() => setRefreshTrigger(prev => prev + 1)}
        />

        {/* Policy Details Form */}
        <PolicyDetailsForm
          policy={selectedPolicy}
          leaveTypes={leaveTypes}
          employmentTypes={employmentTypes}
          isOpen={isFormOpen}
          isLoading={isFormLoading}
          onSave={handleSavePolicy}
          onCancel={handleCancelForm}
        />
      </Stack>
    </div>
  );
};

export default LeavePolicies;