import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  CommandBar,
  type ICommandBarItemProps,
  SearchBox,
  Dropdown,
  type IDropdownOption,
  Stack,
  Text,
  StackItem,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Link,
  Dialog,
  DialogType,
  TextField,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  Toggle,
  CompoundButton,
  Pivot,
  PivotItem,
  IconButton,
  type IIconProps,
  Panel,
  PanelType,
  Label,
  Persona,
  PersonaSize,
  ActionButton
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { UserRole } from '../../types';
import api from '../../services/api';
import profileService from '../../services/profileService';
import { employmentTypeService, EmploymentType } from '../../services/employmentTypeService';

// Icons
const addIcon: IIconProps = { iconName: 'PersonAdd' };
const filterIcon: IIconProps = { iconName: 'Filter' };
const refreshIcon: IIconProps = { iconName: 'Refresh' };
const reviewIcon: IIconProps = { iconName: 'View' };

// Interface to match backend User response 
interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Interface for frontend staff display with camelCase
interface Staff {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  dateJoined: string;
  lastLogin?: string | null;
  employmentType?: EmploymentType | null;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

// Extend Staff interface or create a new one for the profile details with user nested
interface StaffProfileDetail {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
  };
  phone_number: string;
  date_of_birth: string;
  national_insurance_number: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  profile_image_url?: string;
  notes?: string;
  is_approved: boolean;
  security_roles?: string[];
  sia_licenses: Array<{
    id: number;
    license_number: string;
    license_type: string;
    issue_date: string;
    expiry_date: string;
    status: string;
    document_url?: string;
  }>;
}

// Add mapping for SIA License Type display names
const SIA_LICENSE_TYPE_DISPLAY: { [key: string]: string } = {
  ds: 'Door Supervisor',
  sg: 'Security Guard',
  cctv: 'CCTV Operator',
  cp: 'Close Protection',
  k9: 'Dog Handler',
  vs: 'Vehicle Security',
  key: 'Key Holding',
};

const StaffManagement: React.FC = () => {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAddStaffPanel, setShowAddStaffPanel] = useState(false);
  const [showEditStaffPanel, setShowEditStaffPanel] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pendingStaff, setPendingStaff] = useState<StaffProfileDetail[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewingStaff, setReviewingStaff] = useState<StaffProfileDetail | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [detailedStaff, setDetailedStaff] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  // Employment type assignment state
  const [showAssignEmploymentTypePanel, setShowAssignEmploymentTypePanel] = useState(false);
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<number | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // Form state for new/edit staff
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: UserRole.STAFF,
    isActive: true,
    street: '',
    city: '',
    postalCode: '',
    country: '',
  });

  // Set up columns for the DetailsList
  const columns: IColumn[] = [
    {
      key: 'fullName',
      name: 'Name',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: Staff) => <Text>{`${item.firstName} ${item.lastName}`}</Text>,
    },
    {
      key: 'email',
      name: 'Email',
      fieldName: 'email',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
    },
    {
      key: 'phone',
      name: 'Phone',
      fieldName: 'phone',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
    },
    {
      key: 'role',
      name: 'Role',
      fieldName: 'role',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Staff) => {
        const roleLabels = {
          [UserRole.STAFF]: 'Staff',
          [UserRole.MANAGER]: 'Manager',
          [UserRole.ADMIN]: 'Admin',
        };
        return <Text>{roleLabels[item.role]}</Text>;
      }
    },
    {
      key: 'employmentType',
      name: 'Employment Type',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: Staff) => (
        <Stack>
          <Text variant="medium">
            {item.employmentType?.name || 'Not Set'}
          </Text>
          {!item.employmentType && (
            <Text variant="small" style={{ color: '#F59E0B' }}>
              ⚠ Needs Assignment
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'isActive',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Staff) => (
        <div
          style={{
            backgroundColor: item.isActive ? '#10B981' : '#9CA3AF',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            display: 'inline-block',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
        >
          {item.isActive ? 'Active' : 'Inactive'}
        </div>
      ),
    },
    {
      key: 'securityRoles',
      name: 'Security Roles',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: any) => {
        const roles = item.securityRoles || item.security_roles || [];
        const roleLabels: { [key: string]: string } = {
          'ds': 'Door Supervisor',
          'sg': 'Security Guard',
          'cctv': 'CCTV Operator',
          'cp': 'Close Protection',
          'steward': 'Steward',
          'k9': 'Dog Handler',
          'retail': 'Retail Security',
          'static': 'Static Guard',
          'mobile': 'Mobile Patrol',
          'event': 'Event Security'
        };
        return (
          <Stack>
            {roles.length > 0 ? (
              roles.map((role: string, index: number) => (
                <Text key={index} variant="small">
                  {roleLabels[role] || role}
                </Text>
              ))
            ) : (
              <Text variant="small" style={{ color: '#9CA3AF' }}>No roles</Text>
            )}
          </Stack>
        );
      },
    },
    {
      key: 'siaLicenses',
      name: 'SIA Licenses',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: any) => {
        const licenses = item.siaLicenses || item.sia_licenses || [];
        return (
          <Stack>
            <Text variant="small">
              {licenses.length > 0 ? `${licenses.length} license${licenses.length !== 1 ? 's' : ''}` : 'No licenses'}
            </Text>
            {licenses.length > 0 && (
              <Text variant="small" style={{ color: '#10B981' }}>
                ✓ Submitted
              </Text>
            )}
          </Stack>
        );
      },
    },
    {
      key: 'approvalStatus',
      name: 'Approval',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: any) => {
        const isApproved = item.isApproved ?? item.is_approved ?? false;
        return (
          <div
            style={{
              backgroundColor: isApproved ? '#10B981' : '#F59E0B',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              display: 'inline-block',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              textAlign: 'center'
            }}
          >
            {isApproved ? 'Approved' : 'Pending'}
          </div>
        );
      },
    },
    {
      key: 'dateJoined',
      name: 'Date Joined',
      fieldName: 'dateJoined',
      minWidth: 120,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Staff) => <Text>{new Date(item.dateJoined).toLocaleDateString()}</Text>,
    },
    {
      key: 'lastLogin',
      name: 'Last Login',
      fieldName: 'lastLogin',
      minWidth: 120,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Staff) => <Text>{item.lastLogin ? new Date(item.lastLogin).toLocaleDateString() : '-'}</Text>,
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Staff) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <Link onClick={() => handleViewStaffDetails(item)}>
            View Details
          </Link>
          <Link onClick={() => handleEditStaff(item)}>
            Edit
          </Link>
          <Link onClick={() => handleAssignEmploymentType(item)}>
            {item.employmentType ? 'Change Type' : 'Assign Type'}
          </Link>
          <Link onClick={() => handleToggleStatus(item)}>
            {item.isActive ? 'Deactivate' : 'Activate'}
          </Link>
          <Link onClick={() => handleDeleteStaff(item)}>
            Delete
          </Link>
        </Stack>
      ),
    },
  ];

  // Filter options
  const roleOptions: IDropdownOption[] = [
    { key: '', text: 'All Roles' },
    { key: UserRole.STAFF, text: 'Staff' },
    { key: UserRole.MANAGER, text: 'Manager' },
    { key: UserRole.ADMIN, text: 'Admin' },
  ];

  const statusOptions: IDropdownOption[] = [
    { key: '', text: 'All Statuses' },
    { key: 'active', text: 'Active' },
    { key: 'inactive', text: 'Inactive' },
  ];

  // Load staff from API - using useCallback to avoid dependency issues in useEffect
  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch users and employment types in parallel
      const [usersResponse, employmentTypesResponse] = await Promise.all([
        api.get<User[]>('/api/v1/users/'),
        employmentTypeService.getEmploymentTypes().catch(err => {
          console.error('Employment types fetch error:', err);
          return [];
        })
      ]);
      
      console.log('API Response:', usersResponse.data);
      
      // Handle paginated response - extract results array
      const employmentTypesArray = Array.isArray(employmentTypesResponse) ? employmentTypesResponse : (employmentTypesResponse?.results || []);
      
      setEmploymentTypes(employmentTypesArray);
      
      // For each user, fetch their profile to get employment type
      const staffWithProfiles = await Promise.all(
        usersResponse.data.map(async (user) => {
          let employmentType: EmploymentType | null = null;
          let phone = '';
          
          try {
            // Sprint 3: Use /api/v1/ prefix for cookie authentication
            const profileResponse = await api.get(`/api/v1/staff-profiles/?user=${user.id}`);
            const profileData = profileResponse.data.results || profileResponse.data;
            if (profileData && profileData.length > 0) {
              const profile = profileData[0];
              phone = profile.phone_number || '';
              
              // Find employment type if it exists
              if (profile.employment_type_details) {
                employmentType = profile.employment_type_details;
              }
            }
          } catch (profileError) {
            // Profile doesn't exist or error fetching it, that's OK
            console.warn(`No profile found for user ${user.id}:`, profileError);
          }
          
          return {
            id: user.id,
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            email: user.email,
            phone: phone,
            role: user.role as UserRole,
            isActive: user.is_active,
            dateJoined: user.created_at || new Date().toISOString(),
            lastLogin: null,
            employmentType: employmentType,
          };
        })
      );
      
      setStaffList(staffWithProfiles);
    } catch (err) {
      console.error('API Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load staff data.');
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array - runs once on mount

  const loadPendingStaff = useCallback(async () => {
    setPendingLoading(true);
    profileService.getPendingStaffProfiles()
      .then(data => {
        console.log('Received pending staff data:', data);
        let pendingStaffData = [];
        
        if (data && Array.isArray(data.results)) {
          pendingStaffData = data.results;
        } else if (Array.isArray(data)) { // Fallback if API doesn't paginate
          pendingStaffData = data;
        } else {
          console.error('Pending staff data is not an array or paginated object:', data);
          setPendingError('Received invalid data format for pending staff.');
          setPendingStaff([]);
          setPendingLoading(false);
          return;
        }
        
        // Additional frontend filter: only include staff with SIA licenses
        const filteredPendingStaff = pendingStaffData.filter((staff: StaffProfileDetail) => 
          staff.sia_licenses && 
          staff.sia_licenses.length > 0 &&
          !staff.is_approved
        );
        
        console.log('Original pending staff count:', pendingStaffData.length);
        console.log('Filtered pending staff count:', filteredPendingStaff.length);
        
        setPendingStaff(filteredPendingStaff);
        setPendingError(null);
      })
      .catch(err => {
        console.error('Error fetching pending staff:', err);
        setPendingError('Failed to load pending staff.');
        setPendingStaff([]);
      })
      .finally(() => setPendingLoading(false));
  }, []);

  // Effect to load staff on component mount
  useEffect(() => {
    loadStaff();
    loadPendingStaff();
  }, [loadStaff, loadPendingStaff]);

  // Effect to apply filters when search/filter changes
  useEffect(() => {
    if (!staffList.length) {
      setFilteredStaff([]);
      return;
    }

    let filtered = [...staffList];

    // Apply text search
    if (searchText) {
      const lowerCaseSearchText = searchText.toLowerCase();
      filtered = filtered.filter(
        staff =>
          staff.firstName.toLowerCase().includes(lowerCaseSearchText) ||
          staff.lastName.toLowerCase().includes(lowerCaseSearchText) ||
          staff.email.toLowerCase().includes(lowerCaseSearchText) ||
          `${staff.firstName} ${staff.lastName}`.toLowerCase().includes(lowerCaseSearchText)
      );
    }

    // Apply role filter
    if (roleFilter) {
      filtered = filtered.filter(staff => staff.role === roleFilter);
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(staff => 
        (statusFilter === 'active' && staff.isActive) ||
        (statusFilter === 'inactive' && !staff.isActive)
      );
    }

    setFilteredStaff(filtered);
  }, [staffList, searchText, roleFilter, statusFilter]);

  // Handler functions
  const handleEditStaff = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setFormData({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone || '',
      role: staff.role,
      isActive: staff.isActive,
      street: staff.address?.street || '',
      city: staff.address?.city || '',
      postalCode: staff.address?.postalCode || '',
      country: staff.address?.country || '',
    });
    setShowEditStaffPanel(true);
  }, []);

  const handleToggleStatus = useCallback(async (staff: Staff) => {
    try {
      console.log('Toggling status for staff ID:', staff.id, 'Current status:', staff.isActive);
      
      // Call the API to update the user's active status
      await api.patch(`/users/${staff.id}/`, {
        is_active: !staff.isActive
      });
      
      try {
        // If API call was successful, update the local state
        const updatedStaff = staffList.map(s =>
          s.id === staff.id ? { ...s, isActive: !s.isActive } : s
        );
        setStaffList(updatedStaff);
        setFilteredStaff(updatedStaff);
        
        // Show success message
        setError(null);
      } catch (stateError) {
        console.error('Error updating UI state after status toggle:', stateError);
        // Reload the page as fallback
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setError('Failed to update user status. Please try again.');
    }
  }, [staffList]);

  const handleDeleteStaff = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setShowDeleteDialog(true);
  }, []);

  const handleViewStaffDetails = useCallback(async (staff: Staff) => {
    setDetailsLoading(true);
    setShowDetailsPanel(true);
    
    try {
      // Fetch detailed staff profile information
      const response = await api.get(`/staff-profiles/?user=${staff.id}`);
      const profileData = response.data.results?.[0] || response.data[0];
      
      if (profileData) {
        setDetailedStaff(profileData);
      } else {
        setDetailedStaff({
          user: {
            first_name: staff.firstName,
            last_name: staff.lastName,
            email: staff.email,
            role: staff.role,
            is_active: staff.isActive
          },
          phone_number: staff.phone || 'Not provided',
          is_approved: false,
          sia_licenses: [],
          security_roles: []
        });
      }
    } catch (error) {
      console.error('Error fetching staff details:', error);
      setDetailedStaff(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleApproveLicense = useCallback(async (licenseId: number) => {
    try {
      await api.patch(`/sia-licenses/${licenseId}/`, {
        status: 'valid'
      });
      
      // Refresh the detailed staff data
      if (detailedStaff) {
        const updatedLicenses = detailedStaff.sia_licenses.map((license: any) =>
          license.id === licenseId ? { ...license, status: 'valid' } : license
        );
        setDetailedStaff({
          ...detailedStaff,
          sia_licenses: updatedLicenses
        });
      }
      
      // Show success message
      alert('SIA License approved successfully!');
    } catch (error) {
      console.error('Error approving license:', error);
      alert('Failed to approve license. Please try again.');
    }
  }, [detailedStaff]);

  const handleRejectLicense = useCallback(async (licenseId: number) => {
    const confirmed = window.confirm('Are you sure you want to mark this license as expired? This will prevent the staff member from working until they provide a valid license.');
    
    if (!confirmed) return;
    
    try {
      await api.patch(`/sia-licenses/${licenseId}/`, {
        status: 'expired'
      });
      
      // Refresh the detailed staff data
      if (detailedStaff) {
        const updatedLicenses = detailedStaff.sia_licenses.map((license: any) =>
          license.id === licenseId ? { ...license, status: 'expired' } : license
        );
        setDetailedStaff({
          ...detailedStaff,
          sia_licenses: updatedLicenses
        });
      }
      
      // Show success message
      alert('SIA License marked as expired.');
    } catch (error) {
      console.error('Error updating license status:', error);
      alert('Failed to update license status. Please try again.');
    }
  }, [detailedStaff]);

  const confirmDeleteStaff = useCallback(async () => {
    if (!selectedStaff) return;

    try {
      console.log('Deleting staff ID:', selectedStaff.id);

      // Call the API to delete the user
      await api.delete(`/api/v1/users/${selectedStaff.id}/`);
      
      try {
        // If API call was successful, update the local state
        const updatedStaff = staffList.filter(s => s.id !== selectedStaff.id);
        setStaffList(updatedStaff);
        setFilteredStaff(filteredStaff.filter(s => s.id !== selectedStaff.id));
        setShowDeleteDialog(false);
        setSelectedStaff(null);
        
        // Show success message
        setError(null);
      } catch (stateError) {
        console.error('Error updating UI state after staff deletion:', stateError);
        // Still close dialog even if state update fails
        setShowDeleteDialog(false);
        setSelectedStaff(null);
        // Reload the page as fallback
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to delete staff:', err);
      setError('Failed to delete staff. Please try again.');
    }
  }, [selectedStaff, staffList, filteredStaff]);

  const handleAddStaff = useCallback(() => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: UserRole.STAFF,
      isActive: true,
      street: '',
      city: '',
      postalCode: '',
      country: '',
    });
    setShowAddStaffPanel(true);
  }, []);

  const handleSubmitNewStaff = useCallback(async () => {
    try {
      // Prepare data for API call in the format expected by the backend
      const userData = {
        username: formData.email.split('@')[0], // Create username from email
        email: formData.email,
        password: 'temppassword123', // Set a temporary password that user will need to change
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role.toLowerCase(), // Backend expects lowercase roles
        is_active: formData.isActive
      };
      
      console.log('Submitting new staff data:', userData);
      
      // Call the API to create a new user
      const response = await api.post('/users/', userData);
      
      console.log('API response for new staff:', response.data);
      
      try {
        // Map the response to our Staff interface
        const newStaff: Staff = {
          id: response.data.id,
          firstName: response.data.first_name,
          lastName: response.data.last_name,
          email: response.data.email,
          phone: formData.phone || '',
          role: response.data.role as UserRole,
          isActive: response.data.is_active,
          dateJoined: response.data.created_at,
          lastLogin: null
        };

        // Update local state with the new staff member
        const updatedStaff = [...staffList, newStaff];
        setStaffList(updatedStaff);
        setFilteredStaff(updatedStaff); // Make sure filtered list is also updated
        
        // Close the panel
        setShowAddStaffPanel(false);
        
        // Show success message
        setError(null);
        
        // Force refresh page to prevent blank screen issue
        // This is a temporary workaround - ideally, the state updates above would be sufficient
        window.location.reload();
      } catch (stateError) {
        console.error('Error updating UI state after staff creation:', stateError);
        // Still close the panel even if state update fails
        setShowAddStaffPanel(false);
        // Reload the page as fallback to show the updated data
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to add staff:', err);
      setError('Failed to add staff. Please try again.');
    }
  }, [formData, staffList]);

  const handleUpdateStaff = useCallback(async () => {
    if (!selectedStaff) return;

    try {
      // Prepare data for API call in the format expected by the backend
      const userData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        role: formData.role.toLowerCase(), // Backend expects lowercase roles
        is_active: formData.isActive
      };
      
      console.log('Updating staff data for ID:', selectedStaff.id, userData);
      
      // Call the API to update the user
      await api.patch(`/users/${selectedStaff.id}/`, userData);
      
      try {
        // If API call was successful, update the local state
        const updatedStaff = staffList.map(s =>
          s.id === selectedStaff.id
            ? {
                ...s,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone || '',
                role: formData.role,
                isActive: formData.isActive,
                address: {
                  street: formData.street,
                  city: formData.city,
                  postalCode: formData.postalCode,
                  country: formData.country,
                }
              }
            : s
        );

        setStaffList(updatedStaff);
        setFilteredStaff(updatedStaff); // Make sure filtered list is also updated
        setShowEditStaffPanel(false);
        setSelectedStaff(null);
        
        // Show success message
        setError(null);
      } catch (stateError) {
        console.error('Error updating UI state after staff update:', stateError);
        // Still close the panel even if state update fails
        setShowEditStaffPanel(false);
        setSelectedStaff(null);
        // Reload the page as fallback to show the updated data
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to update staff:', err);
      setError('Failed to update staff. Please try again.');
    }
  }, [selectedStaff, formData, staffList]);

  const handleRefresh = useCallback(() => {
    loadStaff();
    return false; // Return false to prevent default behavior
  }, [loadStaff]);

  const handleFormInputChange = useCallback((field: string, value: string | UserRole | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleOpenReviewPanel = useCallback(async (staffListItem: StaffProfileDetail) => {
    setShowReviewPanel(true);
    setReviewingStaff(null); // Clear previous data
    setReviewLoading(true);
    setReviewError(null);
    try {
      // Fetch full profile details using the ID from the list item
      const response = await api.get<StaffProfileDetail>(`/staff-profiles/${staffListItem.id}/`);
      console.log("Full staff details received for review:", response.data);
      setReviewingStaff(response.data);
    } catch (err) {
      console.error('Failed to fetch staff details for review:', err);
      setReviewError('Could not load staff details. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const handleApproveStaff = useCallback(async (profileId: number) => {
    if (!reviewingStaff || reviewingStaff.id !== profileId) return;
    // No need for separate loading state here, can use panel loading
    // setReviewLoading(true); // Remove this if approval is quick
    try {
      await profileService.approveStaffProfile(profileId);
      setPendingStaff(prev => prev.filter(p => p.id !== profileId));
      setShowReviewPanel(false);
      setReviewingStaff(null);
    } catch (err) {
      alert('Failed to approve staff.');
    } finally {
      // setReviewLoading(false); // Remove this if approval is quick
    }
  }, [reviewingStaff]);

  const handleAssignEmploymentType = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setSelectedEmploymentType(staff.employmentType?.id || null);
    setShowAssignEmploymentTypePanel(true);
  }, []);

  const handleSubmitEmploymentTypeAssignment = useCallback(async () => {
    if (!selectedStaff || selectedEmploymentType === null) return;
    
    setAssignmentLoading(true);
    try {
      // First, get the staff profile ID for this user
      const profileResponse = await api.get(`/api/v1/staff-profiles/?user=${selectedStaff.id}`);
      const staffProfile = profileResponse.data.results?.[0] || profileResponse.data[0];

      if (!staffProfile) {
        throw new Error('Staff profile not found');
      }

      // Update the staff profile with the selected employment type
      await api.patch(`/api/v1/staff-profiles/${staffProfile.id}/`, {
        employment_type: selectedEmploymentType
      });
      
      // Update the local state
      const updatedStaff = staffList.map(staff =>
        staff.id === selectedStaff.id
          ? {
              ...staff,
              employmentType: employmentTypes.find(et => et.id === selectedEmploymentType) || null
            }
          : staff
      );
      setStaffList(updatedStaff);
      setFilteredStaff(updatedStaff);
      
      // Close the panel
      setShowAssignEmploymentTypePanel(false);
      setSelectedStaff(null);
      setSelectedEmploymentType(null);
      
      // Clear any errors
      setError(null);
    } catch (err) {
      console.error('Failed to assign employment type:', err);
      setError('Failed to assign employment type. Please try again.');
    } finally {
      setAssignmentLoading(false);
    }
  }, [selectedStaff, selectedEmploymentType, staffList, employmentTypes]);

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'addStaff',
      text: 'Add Staff',
      iconProps: addIcon,
      onClick: handleAddStaff,
    },
    {
      key: 'filter',
      text: 'Filter',
      iconProps: filterIcon,
      subMenuProps: {
        items: [
          {
            key: 'filterActive',
            text: 'Show Active Only',
            onClick: () => setStatusFilter('active'),
            canCheck: true,
            checked: statusFilter === 'active',
          },
          {
            key: 'filterInactive',
            text: 'Show Inactive Only',
            onClick: () => setStatusFilter('inactive'),
            canCheck: true,
            checked: statusFilter === 'inactive',
          },
          {
            key: 'filterAll',
            text: 'Show All',
            onClick: () => setStatusFilter(''),
            canCheck: true,
            checked: statusFilter === '',
          },
          {
            key: 'divider',
            itemType: 1, // Divider
          },
          {
            key: 'filterStaff',
            text: 'Staff Only',
            onClick: () => setRoleFilter(UserRole.STAFF),
            canCheck: true,
            checked: roleFilter === UserRole.STAFF,
          },
          {
            key: 'filterManagers',
            text: 'Managers Only',
            onClick: () => setRoleFilter(UserRole.MANAGER),
            canCheck: true,
            checked: roleFilter === UserRole.MANAGER,
          },
          {
            key: 'filterAdmins',
            text: 'Admins Only',
            onClick: () => setRoleFilter(UserRole.ADMIN),
            canCheck: true,
            checked: roleFilter === UserRole.ADMIN,
          },
          {
            key: 'filterAllRoles',
            text: 'All Roles',
            onClick: () => setRoleFilter(''),
            canCheck: true,
            checked: roleFilter === '',
          },
        ],
      },
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: refreshIcon,
      onClick: handleRefresh,
    },
  ];

  // Validate form
  const isFormValid = () => {
    return formData.firstName.trim() !== '' &&
           formData.lastName.trim() !== '' &&
           formData.email.trim() !== '';
    // Phone is now optional
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Staff Management</Text>
        </Stack>

        {/* Pending Staff Approval Section - Simplified List */}
        <Stack tokens={{ childrenGap: 12 }} style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: 16 }}>
          <Text variant="xLarge">Only Staff Pending Approval with Valid Submitted Credentials ({pendingStaff.length})</Text>
          {pendingLoading ? (
            <Spinner size={SpinnerSize.medium} label="Loading pending staff..." />
          ) : pendingError ? (
            <MessageBar messageBarType={MessageBarType.error}>{pendingError}</MessageBar>
          ) : pendingStaff.length === 0 ? (
            <Stack tokens={{ childrenGap: 8 }}>
              <Text>No staff with submitted credentials are pending approval.</Text>
              <MessageBar messageBarType={MessageBarType.info}>
                Staff members must submit valid SIA license information before they will appear here for approval.
              </MessageBar>
            </Stack>
          ) : (
            <DetailsList
              items={pendingStaff}
              columns={[
                {
                  key: 'pendingName', name: 'Name', minWidth: 150, isResizable: true,
                  onRender: (item: StaffProfileDetail) => (
                    <Text>{item.user ? `${item.user.first_name} ${item.user.last_name}` : `Profile ID: ${item.id}`}</Text>
                  )
                },
                {
                  key: 'pendingEmail', name: 'Email', minWidth: 200, isResizable: true,
                  onRender: (item: StaffProfileDetail) => <Text>{item.user?.email || 'N/A'}</Text>
                },
                {
                  key: 'pendingActions', name: 'Actions', minWidth: 100,
                  onRender: (item: StaffProfileDetail) => (
                    <ActionButton iconProps={reviewIcon} onClick={() => handleOpenReviewPanel(item)}>
                      Review
                    </ActionButton>
                  )
                }
              ]}
              layoutMode={DetailsListLayoutMode.justified}
              selectionMode={SelectionMode.none}
              compact={true}
            />
          )}
        </Stack>

        {/* Pending SIA Licenses Section */}
        <Stack tokens={{ childrenGap: 12 }} style={{ background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 8, padding: 16 }}>
          <Text variant="xLarge">Pending SIA License Approvals</Text>
          <Text variant="medium">
            Review and approve submitted SIA licenses by clicking "View Details" on staff members with licenses requiring approval.
          </Text>
          <MessageBar messageBarType={MessageBarType.info}>
            SIA licenses with status "pending" require admin verification. Use the "View Details" action to approve or reject individual licenses.
          </MessageBar>
        </Stack>

        <CommandBar items={commandBarItems} />

        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <StackItem grow={3}>
            <SearchBox
              placeholder="Search by name, email, or phone"
              onChange={(_, newValue) => setSearchText(newValue || '')}
              onClear={() => setSearchText('')}
              value={searchText}
            />
          </StackItem>
          <StackItem grow={1}>
            <Dropdown
              placeholder="Filter by role"
              options={roleOptions}
              selectedKey={roleFilter}
              onChange={(_, option) => setRoleFilter(option?.key as string)}
            />
          </StackItem>
        </Stack>

        {/* Active filters display */}
        {(roleFilter || statusFilter) && (
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
            <Text>Active filters:</Text>
            {roleFilter && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                Role: {roleOptions.find(option => option.key === roleFilter)?.text}
              </div>
            )}
            {statusFilter && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                Status: {statusOptions.find(option => option.key === statusFilter)?.text}
              </div>
            )}
            <Link onClick={() => {
              setRoleFilter('');
              setStatusFilter('');
            }}>
              Clear all
            </Link>
          </Stack>
        )}

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size={SpinnerSize.large} label="Loading staff..." />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Text variant="large">No staff found</Text>
            <Text>Adjust your search criteria or add a new staff member.</Text>
          </div>
        ) : (
          <DetailsList
            items={filteredStaff}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        )}
      </Stack>

      {/* Add Staff Panel */}
      <Panel
        isOpen={showAddStaffPanel}
        onDismiss={() => setShowAddStaffPanel(false)}
        headerText="Add New Staff Member"
        closeButtonAriaLabel="Close"
        type={PanelType.medium}
      >
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
          <Pivot>
            <PivotItem headerText="Basic Information">
              <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
                <TextField
                  label="First Name"
                  required
                  value={formData.firstName}
                  onChange={(_, newValue) => handleFormInputChange('firstName', newValue || '')}
                />
                <TextField
                  label="Last Name"
                  required
                  value={formData.lastName}
                  onChange={(_, newValue) => handleFormInputChange('lastName', newValue || '')}
                />
                <TextField
                  label="Email"
                  required
                  type="email"
                  value={formData.email}
                  onChange={(_, newValue) => handleFormInputChange('email', newValue || '')}
                />
                <TextField
                  label="Phone"
                  required
                  value={formData.phone}
                  onChange={(_, newValue) => handleFormInputChange('phone', newValue || '')}
                />
                <Dropdown
                  label="Role"
                  required
                  options={[
                    { key: UserRole.STAFF, text: 'Staff' },
                    { key: UserRole.MANAGER, text: 'Manager' },
                    { key: UserRole.ADMIN, text: 'Admin' },
                  ]}
                  selectedKey={formData.role}
                  onChange={(_, option) => handleFormInputChange('role', option?.key as UserRole)}
                />
                <Toggle
                  label="Active"
                  checked={formData.isActive}
                  onChange={(_, checked) => handleFormInputChange('isActive', checked || false)}
                  onText="Yes"
                  offText="No"
                />
              </Stack>
            </PivotItem>
            <PivotItem headerText="Address">
              <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
                <TextField
                  label="Street"
                  value={formData.street}
                  onChange={(_, newValue) => handleFormInputChange('street', newValue || '')}
                />
                <TextField
                  label="City"
                  value={formData.city}
                  onChange={(_, newValue) => handleFormInputChange('city', newValue || '')}
                />
                <TextField
                  label="Postal Code"
                  value={formData.postalCode}
                  onChange={(_, newValue) => handleFormInputChange('postalCode', newValue || '')}
                />
                <TextField
                  label="Country"
                  value={formData.country}
                  onChange={(_, newValue) => handleFormInputChange('country', newValue || '')}
                />
              </Stack>
            </PivotItem>
          </Pivot>

          <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end" style={{ marginTop: 20 }}>
            <DefaultButton
              text="Cancel"
              onClick={() => setShowAddStaffPanel(false)}
            />
            <PrimaryButton
              text="Add Staff Member"
              onClick={handleSubmitNewStaff}
              disabled={!isFormValid()}
            />
          </Stack>
        </Stack>
      </Panel>

      {/* Edit Staff Panel */}
      <Panel
        isOpen={showEditStaffPanel}
        onDismiss={() => {
          setShowEditStaffPanel(false);
          setSelectedStaff(null);
        }}
        headerText="Edit Staff Member"
        closeButtonAriaLabel="Close"
        type={PanelType.medium}
      >
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
          <Pivot>
            <PivotItem headerText="Basic Information">
              <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
                <TextField
                  label="First Name"
                  required
                  value={formData.firstName}
                  onChange={(_, newValue) => handleFormInputChange('firstName', newValue || '')}
                />
                <TextField
                  label="Last Name"
                  required
                  value={formData.lastName}
                  onChange={(_, newValue) => handleFormInputChange('lastName', newValue || '')}
                />
                <TextField
                  label="Email"
                  required
                  type="email"
                  value={formData.email}
                  onChange={(_, newValue) => handleFormInputChange('email', newValue || '')}
                />
                <TextField
                  label="Phone"
                  required
                  value={formData.phone}
                  onChange={(_, newValue) => handleFormInputChange('phone', newValue || '')}
                />
                <Dropdown
                  label="Role"
                  required
                  options={[
                    { key: UserRole.STAFF, text: 'Staff' },
                    { key: UserRole.MANAGER, text: 'Manager' },
                    { key: UserRole.ADMIN, text: 'Admin' },
                  ]}
                  selectedKey={formData.role}
                  onChange={(_, option) => handleFormInputChange('role', option?.key as UserRole)}
                />
                <Toggle
                  label="Active"
                  checked={formData.isActive}
                  onChange={(_, checked) => handleFormInputChange('isActive', checked || false)}
                  onText="Yes"
                  offText="No"
                />
              </Stack>
            </PivotItem>
            <PivotItem headerText="Address">
              <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
                <TextField
                  label="Street"
                  value={formData.street}
                  onChange={(_, newValue) => handleFormInputChange('street', newValue || '')}
                />
                <TextField
                  label="City"
                  value={formData.city}
                  onChange={(_, newValue) => handleFormInputChange('city', newValue || '')}
                />
                <TextField
                  label="Postal Code"
                  value={formData.postalCode}
                  onChange={(_, newValue) => handleFormInputChange('postalCode', newValue || '')}
                />
                <TextField
                  label="Country"
                  value={formData.country}
                  onChange={(_, newValue) => handleFormInputChange('country', newValue || '')}
                />
              </Stack>
            </PivotItem>
          </Pivot>

          <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end" style={{ marginTop: 20 }}>
            <DefaultButton
              text="Cancel"
              onClick={() => {
                setShowEditStaffPanel(false);
                setSelectedStaff(null);
              }}
            />
            <PrimaryButton
              text="Update Staff Member"
              onClick={handleUpdateStaff}
              disabled={!isFormValid()}
            />
          </Stack>
        </Stack>
      </Panel>

      {/* Delete Confirmation Dialog */}
      <Dialog
        hidden={!showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Confirm Deletion',
          subText: selectedStaff ?
            `Are you sure you want to delete ${selectedStaff.firstName} ${selectedStaff.lastName}? This action cannot be undone.` :
            'Are you sure you want to delete this staff member? This action cannot be undone.'
        }}
      >
        <DialogFooter>
          <PrimaryButton
            text="Delete"
            onClick={confirmDeleteStaff}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setShowDeleteDialog(false)}
          />
        </DialogFooter>
      </Dialog>

      {/* Staff Review Panel - Updated */}
      <Panel
        isOpen={showReviewPanel}
        onDismiss={() => {
          setShowReviewPanel(false);
          setReviewingStaff(null);
          setReviewError(null); // Clear error on dismiss
        }}
        // Use optional chaining and provide defaults for header before data loads
        headerText={`Review Staff: ${reviewingStaff?.user?.first_name || 'Loading...'} ${reviewingStaff?.user?.last_name || ''}`}
        closeButtonAriaLabel="Close"
        type={PanelType.large}
        isLightDismiss
      >
        {reviewLoading ? (
          <Spinner label="Loading details..." style={{ padding: '20px' }} />
        ) : reviewError ? (
          <MessageBar messageBarType={MessageBarType.error} style={{ margin: '20px' }}>{reviewError}</MessageBar>
        ) : reviewingStaff ? (
          <Stack tokens={{ childrenGap: 20 }} style={{ padding: '20px' }}>
            {/* Use optional chaining for user details */}
            <Persona
              imageUrl={reviewingStaff.profile_image_url}
              text={`${reviewingStaff.user?.first_name || ''} ${reviewingStaff.user?.last_name || ''}`}
              secondaryText={reviewingStaff.user?.email || 'N/A'}
              tertiaryText={`Role: ${reviewingStaff.user?.role || 'N/A'}`}
              size={PersonaSize.size72}
            />
            {/* Other sections remain similar, ensure they use reviewingStaff fields */}
            <Stack tokens={{ childrenGap: 10 }}>
              <Label>Contact Info</Label>
              <Text>Phone: {reviewingStaff.phone_number || 'N/A'}</Text>
            </Stack>
            <Stack tokens={{ childrenGap: 10 }}>
              <Label>Address</Label>
              <Text>{reviewingStaff.street || 'N/A'}</Text>
              <Text>{reviewingStaff.city || 'N/A'}, {reviewingStaff.postal_code || 'N/A'}</Text>
              <Text>{reviewingStaff.country || 'N/A'}</Text>
            </Stack>
            <Stack tokens={{ childrenGap: 10 }}>
              <Label>Personal Details</Label>
              <Text>DOB: {reviewingStaff.date_of_birth || 'N/A'}</Text>
              <Text>NI Number: {reviewingStaff.national_insurance_number || 'N/A'}</Text>
            </Stack>
            <Stack tokens={{ childrenGap: 10 }}>
              <Label>Security Roles</Label>
              {/* Check if security_roles exists and is an array */}
              <Text>{Array.isArray(reviewingStaff.security_roles) && reviewingStaff.security_roles.length > 0 ? reviewingStaff.security_roles.join(', ') : 'None specified'}</Text>
            </Stack>
            <Stack tokens={{ childrenGap: 10 }}>
              <Label>SIA License(s)</Label>
              {reviewingStaff.sia_licenses && reviewingStaff.sia_licenses.length > 0 ? (
                reviewingStaff.sia_licenses.map((lic, idx) => (
                  <Stack key={idx} tokens={{ childrenGap: 4 }} style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 8 }}>
                    <Text>Number: {lic.license_number}</Text>
                    {/* Use the display mapping for type */}
                    <Text>Type: {SIA_LICENSE_TYPE_DISPLAY[lic.license_type] || lic.license_type}</Text>
                    <Text>Status: {lic.status}</Text>
                    <Text>Issue Date: {lic.issue_date}</Text>
                    <Text>Expiry Date: {lic.expiry_date}</Text>
                    {lic.document_url && (
                      <Link href={lic.document_url} target="_blank" rel="noopener noreferrer">View Submitted Document</Link>
                    )}
                  </Stack>
                ))
              ) : (
                <Text>No SIA license details found.</Text>
              )}
            </Stack>

            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} style={{ marginTop: 30 }}>
              <PrimaryButton
                text="Approve Staff Member"
                iconProps={{ iconName: 'CheckMark' }}
                onClick={() => handleApproveStaff(reviewingStaff.id)}
                // Disable button while loading review details or if already approved
                disabled={reviewLoading || reviewingStaff.is_approved}
              />
            </Stack>
          </Stack>
        ) : (
          <Text style={{ padding: '20px' }}>No staff selected or failed to load details.</Text>
        )}
      </Panel>

      {/* Staff Details Panel */}
      <Panel
        isOpen={showDetailsPanel}
        onDismiss={() => setShowDetailsPanel(false)}
        headerText="Staff Details"
        closeButtonAriaLabel="Close"
        type={PanelType.medium}
      >
        {detailsLoading ? (
          <Spinner size={SpinnerSize.medium} label="Loading staff details..." />
        ) : detailedStaff ? (
          <Stack tokens={{ childrenGap: 20 }} style={{ padding: '20px 0' }}>
            {/* Basic Information */}
            <Stack tokens={{ childrenGap: 10 }}>
              <Text variant="large" style={{ fontWeight: 'bold', color: '#0078d4' }}>
                Basic Information
              </Text>
              <Stack tokens={{ childrenGap: 8 }}>
                <Stack horizontal>
                  <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Name:</Text>
                  <Text>{detailedStaff.user?.first_name} {detailedStaff.user?.last_name}</Text>
                </Stack>
                <Stack horizontal>
                  <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Email:</Text>
                  <Text>{detailedStaff.user?.email}</Text>
                </Stack>
                <Stack horizontal>
                  <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Phone:</Text>
                  <Text>{detailedStaff.phone_number || 'Not provided'}</Text>
                </Stack>
                <Stack horizontal>
                  <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Role:</Text>
                  <Text>{detailedStaff.user?.role}</Text>
                </Stack>
                <Stack horizontal>
                  <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Status:</Text>
                  <div
                    style={{
                      backgroundColor: detailedStaff.user?.is_active ? '#10B981' : '#9CA3AF',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {detailedStaff.user?.is_active ? 'Active' : 'Inactive'}
                  </div>
                </Stack>
                <Stack horizontal>
                  <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Approval:</Text>
                  <div
                    style={{
                      backgroundColor: detailedStaff.is_approved ? '#10B981' : '#F59E0B',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {detailedStaff.is_approved ? 'Approved' : 'Pending'}
                  </div>
                </Stack>
              </Stack>
            </Stack>

            {/* Security Roles */}
            <Stack tokens={{ childrenGap: 10 }}>
              <Text variant="large" style={{ fontWeight: 'bold', color: '#0078d4' }}>
                Security Roles
              </Text>
              {detailedStaff.security_roles?.length > 0 ? (
                <Stack tokens={{ childrenGap: 4 }}>
                  {detailedStaff.security_roles.map((role: string, index: number) => {
                    const roleLabels: { [key: string]: string } = {
                      'ds': 'Door Supervisor',
                      'sg': 'Security Guard',
                      'cctv': 'CCTV Operator',
                      'cp': 'Close Protection',
                      'steward': 'Steward/Marshal',
                      'k9': 'Dog Handler',
                      'retail': 'Retail Security',
                      'static': 'Static Guard',
                      'mobile': 'Mobile Patrol',
                      'event': 'Event Security'
                    };
                    return (
                      <div
                        key={index}
                        style={{
                          backgroundColor: '#e3f2fd',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          marginRight: '8px',
                          marginBottom: '4px'
                        }}
                      >
                        <Text variant="small">{roleLabels[role] || role}</Text>
                      </div>
                    );
                  })}
                </Stack>
              ) : (
                <Text style={{ color: '#9CA3AF' }}>No security roles assigned</Text>
              )}
            </Stack>

            {/* SIA Licenses */}
            <Stack tokens={{ childrenGap: 10 }}>
              <Text variant="large" style={{ fontWeight: 'bold', color: '#0078d4' }}>
                SIA Licenses ({detailedStaff.sia_licenses?.length || 0})
              </Text>
              {detailedStaff.sia_licenses?.length > 0 ? (
                <Stack tokens={{ childrenGap: 15 }}>
                  {detailedStaff.sia_licenses.map((license: any, index: number) => (
                    <Stack
                      key={index}
                      style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: '#f9f9f9'
                      }}
                      tokens={{ childrenGap: 8 }}
                    >
                      <Stack horizontal>
                        <Text style={{ minWidth: 120, fontWeight: 'bold' }}>License #{index + 1}:</Text>
                        <Text>{license.license_number}</Text>
                      </Stack>
                      <Stack horizontal>
                        <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Type:</Text>
                        <Text>{SIA_LICENSE_TYPE_DISPLAY[license.license_type] || license.license_type}</Text>
                      </Stack>
                      <Stack horizontal>
                        <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Status:</Text>
                        <div
                          style={{
                            backgroundColor: license.status === 'valid' ? '#10B981' : 
                                           license.status === 'expired' ? '#EF4444' : '#F59E0B',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            display: 'inline-block',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {license.status}
                        </div>
                      </Stack>
                      <Stack horizontal>
                        <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Issue Date:</Text>
                        <Text>{license.issue_date}</Text>
                      </Stack>
                      <Stack horizontal>
                        <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Expiry Date:</Text>
                        <Text>{license.expiry_date}</Text>
                      </Stack>
                      {license.document_url && (
                        <Stack horizontal>
                          <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Document:</Text>
                          <Link href={license.document_url} target="_blank">
                            View Document
                          </Link>
                        </Stack>
                      )}
                      {license.status === 'pending' && (
                        <Stack horizontal tokens={{ childrenGap: 10 }}>
                          <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Actions:</Text>
                          <Stack horizontal tokens={{ childrenGap: 8 }}>
                            <PrimaryButton
                              text="Approve License"
                              onClick={() => handleApproveLicense(license.id)}
                              iconProps={{ iconName: 'CheckMark' }}
                              styles={{ root: { minWidth: 'auto', padding: '4px 12px' } }}
                            />
                            <DefaultButton
                              text="Mark Expired"
                              onClick={() => handleRejectLicense(license.id)}
                              iconProps={{ iconName: 'Cancel' }}
                              styles={{ root: { minWidth: 'auto', padding: '4px 12px' } }}
                            />
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Text style={{ color: '#9CA3AF' }}>No SIA licenses on file</Text>
              )}
            </Stack>

            {/* Personal Details */}
            {(detailedStaff.date_of_birth || detailedStaff.national_insurance_number || 
              detailedStaff.street || detailedStaff.city) && (
              <Stack tokens={{ childrenGap: 10 }}>
                <Text variant="large" style={{ fontWeight: 'bold', color: '#0078d4' }}>
                  Personal Details
                </Text>
                <Stack tokens={{ childrenGap: 8 }}>
                  {detailedStaff.date_of_birth && (
                    <Stack horizontal>
                      <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Date of Birth:</Text>
                      <Text>{detailedStaff.date_of_birth}</Text>
                    </Stack>
                  )}
                  {detailedStaff.national_insurance_number && (
                    <Stack horizontal>
                      <Text style={{ minWidth: 120, fontWeight: 'bold' }}>NI Number:</Text>
                      <Text>{detailedStaff.national_insurance_number}</Text>
                    </Stack>
                  )}
                  {(detailedStaff.street || detailedStaff.city) && (
                    <Stack horizontal>
                      <Text style={{ minWidth: 120, fontWeight: 'bold' }}>Address:</Text>
                      <Text>
                        {[detailedStaff.street, detailedStaff.city, detailedStaff.postal_code, detailedStaff.country]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>
        ) : (
          <Text>Unable to load staff details</Text>
        )}
      </Panel>

      {/* Employment Type Assignment Panel */}
      <Panel
        isOpen={showAssignEmploymentTypePanel}
        onDismiss={() => {
          setShowAssignEmploymentTypePanel(false);
          setSelectedStaff(null);
          setSelectedEmploymentType(null);
        }}
        headerText={selectedStaff ? `Assign Employment Type - ${selectedStaff.firstName} ${selectedStaff.lastName}` : 'Assign Employment Type'}
        closeButtonAriaLabel="Close"
        type={PanelType.medium}
        isLightDismiss
      >
        <Stack tokens={{ childrenGap: 20 }} style={{ padding: '20px' }}>
          {selectedStaff && (
            <Stack tokens={{ childrenGap: 10 }}>
              <Text variant="mediumPlus">Staff Member:</Text>
              <Persona
                text={`${selectedStaff.firstName} ${selectedStaff.lastName}`}
                secondaryText={selectedStaff.email}
                tertiaryText={`Current: ${selectedStaff.employmentType?.name || 'Not Set'}`}
                size={PersonaSize.size48}
              />
            </Stack>
          )}
          
          <Stack tokens={{ childrenGap: 10 }}>
            <Label required>Employment Type</Label>
            <Dropdown
              placeholder="Select employment type"
              options={Array.isArray(employmentTypes) ? employmentTypes.map(et => ({
                key: et.id,
                text: et.name,
                data: et
              })) : []}
              selectedKey={selectedEmploymentType}
              onChange={(event, option) => {
                setSelectedEmploymentType(option?.key as number);
              }}
            />
            {employmentTypes.length === 0 && (
              <Text variant="small" style={{ color: '#d13438' }}>
                No employment types available. Please create some in Settings first.
              </Text>
            )}
          </Stack>
          
          <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end" style={{ marginTop: 20 }}>
            <DefaultButton
              text="Cancel"
              onClick={() => {
                setShowAssignEmploymentTypePanel(false);
                setSelectedStaff(null);
                setSelectedEmploymentType(null);
              }}
            />
            <PrimaryButton
              text="Assign Employment Type"
              onClick={handleSubmitEmploymentTypeAssignment}
              disabled={!selectedEmploymentType || assignmentLoading}
            />
          </Stack>
          
          {assignmentLoading && (
            <Spinner label="Assigning employment type..." />
          )}
        </Stack>
      </Panel>
    </MainLayout>
  );
};

export default StaffManagement;
