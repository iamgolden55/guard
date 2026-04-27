import React, { useState, useEffect, useCallback } from 'react';
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
import { Header, Container, SpaceBetween, StatusIndicator } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';

const LeavePolicies: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<LeavePolicy | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();
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
      addFlash({ type: 'error', content: 'Failed to load policies data. Please try again.' });
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
        addFlash({ type: 'success', content: 'Policy updated successfully!' });
      } else {
        // Create new policy
        await createPolicy(policyData);
        addFlash({ type: 'success', content: 'Policy created successfully!' });
      }

      setIsFormOpen(false);
      setSelectedPolicy(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error saving policy:', error);
      addFlash({ type: 'error', content: `Failed to ${selectedPolicy ? 'update' : 'create'} policy. Please try again.` });
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
      addFlash({ type: 'success', content: 'Policy deleted successfully!' });
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting policy:', error);
      addFlash({ type: 'error', content: 'Failed to delete policy. Please try again.' });
    }
  }, []);

  // Handle policy activate/deactivate
  const handleActivatePolicy = useCallback(async (policyId: number, isActive: boolean) => {
    try {
      await api.post(`/api/v1/leave-policies/${policyId}/${isActive ? 'activate' : 'deactivate'}/`);
      addFlash({ type: 'success', content: `Policy ${isActive ? 'activated' : 'deactivated'} successfully!` });
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error(`Error ${isActive ? 'activating' : 'deactivating'} policy:`, error);
      addFlash({ type: 'error', content: `Failed to ${isActive ? 'activate' : 'deactivate'} policy. Please try again.` });
    }
  }, []);

  // Handle form cancel
  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false);
    setSelectedPolicy(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading leave policies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <SpaceBetween size="l">
        {/* Page Header */}
        <Header
          variant="h1"
          description="Configure leave policies for different employment types and leave categories"
          actions={
            <div className="flex items-center gap-2">
              <button
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Import Policies
              </button>
              <button
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Export Policies
              </button>
              <button
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh data"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          }
        >
          Leave Policies
        </Header>

        <Flashbar items={flashItems} onDismiss={removeFlash} />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Container>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-red-600">{policies.length}</p>
              <p className="text-sm text-gray-600">Total Policies</p>
            </div>
          </Container>
          <Container>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-600">{policies.filter(p => p.is_active).length}</p>
              <p className="text-sm text-gray-600">Active Policies</p>
            </div>
          </Container>
          <Container>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-orange-600">{leaveTypes.length}</p>
              <p className="text-sm text-gray-600">Leave Types</p>
            </div>
          </Container>
          <Container>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-600">{employmentTypes.length}</p>
              <p className="text-sm text-gray-600">Employment Types</p>
            </div>
          </Container>
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
      </SpaceBetween>
    </div>
  );
};

export default LeavePolicies;
