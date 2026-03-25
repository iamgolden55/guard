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
  ActionButton,
  TooltipHost
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { UserRole } from '../../types';
import api from '../../services/api';
import profileService from '../../services/profileService';
import { employmentTypeService, type EmploymentType } from '../../services/employmentTypeService';
import { useToast } from '../../components/shared/ToastNotificationSystem';

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

// SIA License dropdown options for editing
const SIA_LICENSE_TYPE_OPTIONS: IDropdownOption[] = [
  { key: 'ds', text: 'Door Supervisor' },
  { key: 'sg', text: 'Security Guard' },
  { key: 'cctv', text: 'CCTV Operator' },
  { key: 'cp', text: 'Close Protection' },
  { key: 'k9', text: 'Dog Handler' },
  { key: 'vs', text: 'Vehicle Security' },
  { key: 'key', text: 'Key Holding' },
];

const SIA_LICENSE_LEVEL_OPTIONS: IDropdownOption[] = [
  { key: 'trainee', text: 'Trainee' },
  { key: 'qualified', text: 'Qualified' },
  { key: 'advanced', text: 'Advanced' },
  { key: 'instructor', text: 'Instructor' },
];

const SIA_LICENSE_STATUS_OPTIONS: IDropdownOption[] = [
  { key: 'valid', text: 'Valid' },
  { key: 'expired', text: 'Expired' },
  { key: 'pending', text: 'Pending' },
];

const StaffManagement: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
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

  // Two-step delete confirmation state
  const [showPhraseConfirmDialog, setShowPhraseConfirmDialog] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');

  // SIA License editing state
  const [showEditLicenseDialog, setShowEditLicenseDialog] = useState(false);
  const [editingLicense, setEditingLicense] = useState<any>(null);
  const [licenseFormData, setLicenseFormData] = useState({
    license_number: '',
    license_type: 'sg',
    level: 'qualified',
    issue_date: '',
    expiry_date: '',
    status: 'pending',
    document_url: ''
  });
  const [savingLicense, setSavingLicense] = useState(false);
  const [showCreateLicenseDialog, setShowCreateLicenseDialog] = useState(false);
  const [createLicenseForProfileId, setCreateLicenseForProfileId] = useState<number | null>(null);

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
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Staff) => <Text>{`${item.firstName} ${item.lastName}`}</Text>,
    },
    {
      key: 'email',
      name: 'Email',
      fieldName: 'email',
      minWidth: 150,
      maxWidth: 200,
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
      key: 'dateJoined',
      name: 'Date Joined',
      fieldName: 'dateJoined',
      minWidth: 120,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Staff) => <Text>{new Date(item.dateJoined).toLocaleDateString()}</Text>,
    },

    {
      key: 'actions',
      name: 'Actions',
      minWidth: 450,
      maxWidth: 500,
      isResizable: true,
      onRender: (item: Staff) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <ActionButton
            iconProps={{ iconName: 'View' }}
            onClick={() => handleViewStaffDetails(item)}
            text="Details"
          />
          <ActionButton
            iconProps={{ iconName: 'Edit' }}
            onClick={() => handleEditStaff(item)}
            text="Edit"
          />
          <ActionButton
            iconProps={{ iconName: 'Work' }}
            onClick={() => handleAssignEmploymentType(item)}
            styles={{ root: { color: item.employmentType ? undefined : '#F59E0B' } }}
            text={item.employmentType ? 'Change Type' : 'Assign Type'}
          />
          <ActionButton
            iconProps={{ iconName: item.isActive ? 'BlockContact' : 'Contact' }}
            onClick={() => handleToggleStatus(item)}
            styles={{ root: { color: item.isActive ? '#EF4444' : '#10B981' } }}
            text={item.isActive ? 'Deactivate' : 'Activate'}
          />
          <ActionButton
            iconProps={{ iconName: 'Delete' }}
            onClick={() => handleDeleteStaff(item)}
            styles={{ rootHovered: { color: '#EF4444' } }}
            text="Delete"
          />
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
      .then((data: any) => {
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
      // Call the API to update the user's active status
      await api.patch(`/api/v1/users/${staff.id}/`, {
        is_active: !staff.isActive
      });

      try {
        // If API call was successful, update the local state
        const updatedStaff = staffList.map(s =>
          s.id === staff.id ? { ...s, isActive: !s.isActive } : s
        );
        setStaffList(updatedStaff);
        setFilteredStaff(updatedStaff);

        // Show success toast
        setError(null);
        const newStatus = !staff.isActive;
        if (newStatus) {
          toast.showSuccess('Staff Activated', `${staff.firstName} ${staff.lastName} has been activated.`);
        } else {
          toast.showSuccess('Staff Deactivated', `${staff.firstName} ${staff.lastName} has been deactivated.`);
        }
      } catch (stateError) {
        console.error('Error updating UI state after status toggle:', stateError);
        // Reload the page as fallback
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
      toast.showError('Status Update Failed', 'Failed to update user status. Please try again.');
    }
  }, [staffList, toast]);

  const handleDeleteStaff = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setShowDeleteDialog(true);
  }, []);

  const handleViewStaffDetails = useCallback(async (staff: Staff) => {
    setDetailsLoading(true);
    setShowDetailsPanel(true);

    try {
      // Fetch detailed staff profile information
      const response = await api.get(`/api/v1/staff-profiles/?user=${staff.id}`);
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
      await api.patch(`/api/v1/sia-licenses/${licenseId}/`, {
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
      await api.patch(`/api/v1/sia-licenses/${licenseId}/`, {
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

  // SIA License editing handlers
  const handleEditLicense = useCallback((license: any) => {
    setEditingLicense(license);
    setLicenseFormData({
      license_number: license.license_number || '',
      license_type: license.license_type || 'sg',
      level: license.level || 'qualified',
      issue_date: license.issue_date || '',
      expiry_date: license.expiry_date || '',
      status: license.status || 'pending',
      document_url: license.document_url || ''
    });
    setShowEditLicenseDialog(true);
  }, []);

  const handleSaveLicense = useCallback(async () => {
    if (!editingLicense) return;

    setSavingLicense(true);
    try {
      await api.patch(`/api/v1/sia-licenses/${editingLicense.id}/`, licenseFormData);

      // Update local state
      if (detailedStaff) {
        const updatedLicenses = detailedStaff.sia_licenses.map((license: any) =>
          license.id === editingLicense.id ? { ...license, ...licenseFormData } : license
        );
        setDetailedStaff({
          ...detailedStaff,
          sia_licenses: updatedLicenses
        });
      }

      setShowEditLicenseDialog(false);
      setEditingLicense(null);
      alert('SIA License updated successfully!');
    } catch (error) {
      console.error('Error updating license:', error);
      alert('Failed to update license. Please try again.');
    } finally {
      setSavingLicense(false);
    }
  }, [editingLicense, licenseFormData, detailedStaff]);

  const handleCreateLicense = useCallback((staffProfileId: number) => {
    setCreateLicenseForProfileId(staffProfileId);
    setLicenseFormData({
      license_number: '',
      license_type: 'sg',
      level: 'qualified',
      issue_date: '',
      expiry_date: '',
      status: 'pending',
      document_url: ''
    });
    setShowCreateLicenseDialog(true);
  }, []);

  const handleSubmitNewLicense = useCallback(async () => {
    if (!createLicenseForProfileId) return;

    setSavingLicense(true);
    try {
      const response = await api.post('/api/v1/sia-licenses/', {
        ...licenseFormData,
        staff_profile: createLicenseForProfileId
      });

      // Update local state with the new license
      if (detailedStaff) {
        setDetailedStaff({
          ...detailedStaff,
          sia_licenses: [...(detailedStaff.sia_licenses || []), response.data]
        });
      }

      setShowCreateLicenseDialog(false);
      setCreateLicenseForProfileId(null);
      alert('SIA License created successfully!');
    } catch (error) {
      console.error('Error creating license:', error);
      alert('Failed to create license. Please try again.');
    } finally {
      setSavingLicense(false);
    }
  }, [createLicenseForProfileId, licenseFormData, detailedStaff]);

  const handleLicenseFormChange = useCallback((field: string, value: string) => {
    setLicenseFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const confirmDeleteStaff = useCallback(async () => {
    if (!selectedStaff) return;

    const staffName = `${selectedStaff.firstName} ${selectedStaff.lastName}`;

    try {
      // Call the API to delete the user
      await api.delete(`/api/v1/users/${selectedStaff.id}/`);

      try {
        // If API call was successful, update the local state
        const updatedStaff = staffList.filter(s => s.id !== selectedStaff.id);
        setStaffList(updatedStaff);
        setFilteredStaff(filteredStaff.filter(s => s.id !== selectedStaff.id));
        setShowDeleteDialog(false);
        setShowPhraseConfirmDialog(false);
        setConfirmationPhrase('');
        setSelectedStaff(null);

        // Show success toast
        setError(null);
        toast.showSuccess('Staff Member Deleted', `${staffName} has been permanently removed.`);
      } catch (stateError) {
        console.error('Error updating UI state after staff deletion:', stateError);
        // Still close dialogs even if state update fails
        setShowDeleteDialog(false);
        setShowPhraseConfirmDialog(false);
        setConfirmationPhrase('');
        setSelectedStaff(null);
        toast.showSuccess('Staff Member Deleted', `${staffName} has been permanently removed.`);
        // Reload the page as fallback
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to delete staff:', err);
      setError('Failed to delete staff. Please try again.');
      toast.showError('Delete Failed', 'Failed to delete staff member. Please try again.');
      // Close the phrase confirmation dialog on error so user can retry
      setShowPhraseConfirmDialog(false);
      setConfirmationPhrase('');
    }
  }, [selectedStaff, staffList, filteredStaff, toast]);

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

      // Call the API to create a new user
      const response = await api.post('/api/v1/users/', userData);

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

      // Call the API to update the user
      await api.patch(`/api/v1/users/${selectedStaff.id}/`, userData);

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

        // Show success toast
        setError(null);
        toast.showSuccess('Staff Updated', `${formData.firstName} ${formData.lastName}'s profile has been updated.`);
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
      toast.showError('Update Failed', 'Failed to update staff. Please try again.');
    }
  }, [selectedStaff, formData, staffList, toast]);

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
      const response = await api.get<StaffProfileDetail>(`/api/v1/staff-profiles/${staffListItem.id}/`);
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
        employmentType: selectedEmploymentType
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

      // Show success toast
      const employmentTypeName = employmentTypes.find(et => et.id === selectedEmploymentType)?.name || 'Employment type';
      toast.showSuccess('Employment Type Assigned', `${selectedStaff.firstName} ${selectedStaff.lastName} is now assigned as ${employmentTypeName}.`);

      // Close the panel
      setShowAssignEmploymentTypePanel(false);
      setSelectedStaff(null);
      setSelectedEmploymentType(null);

      // Clear any errors
      setError(null);
    } catch (err) {
      console.error('Failed to assign employment type:', err);
      toast.showError('Assignment Failed', 'Failed to assign employment type. Please try again.');
    } finally {
      setAssignmentLoading(false);
    }
  }, [selectedStaff, selectedEmploymentType, staffList, employmentTypes, toast]);

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

      {/* Delete Confirmation Modal - Step 1 */}
      {showDeleteDialog && selectedStaff && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowDeleteDialog(false)}
          />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Deletion</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{selectedStaff.firstName} {selectedStaff.lastName}</strong>? This action cannot be undone.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteDialog(false)}
                    className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-200 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteDialog(false);
                      setShowPhraseConfirmDialog(true);
                    }}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phrase Confirmation Modal - Step 2 */}
      {showPhraseConfirmDialog && selectedStaff && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setShowPhraseConfirmDialog(false);
              setConfirmationPhrase('');
            }}
          />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Final Confirmation</h3>
                <p className="text-gray-600 mb-4">
                  To permanently delete <strong>{selectedStaff.firstName} {selectedStaff.lastName}</strong>, type <strong className="text-red-600">DELETE</strong> below.
                </p>
                <input
                  type="text"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-center font-mono text-lg uppercase tracking-wider focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-all duration-200 mb-6"
                  autoFocus
                />
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setShowPhraseConfirmDialog(false);
                      setConfirmationPhrase('');
                    }}
                    className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-200 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteStaff}
                    disabled={confirmationPhrase.toLowerCase() !== 'delete'}
                    className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                      confirmationPhrase.toLowerCase() === 'delete'
                        ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Staff Details Modal - Modern Design */}
      {showDetailsPanel && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailsPanel(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <button
                  onClick={() => setShowDetailsPanel(false)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="font-medium">Back to Staff</span>
                </button>
                {detailedStaff && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (detailedStaff?.user) {
                          const staffItem: Staff = {
                            id: detailedStaff.user.id,
                            firstName: detailedStaff.user.first_name,
                            lastName: detailedStaff.user.last_name,
                            email: detailedStaff.user.email,
                            role: detailedStaff.user.role as UserRole,
                            isActive: detailedStaff.user.is_active,
                            dateJoined: new Date().toISOString(),
                            phone: detailedStaff.phone_number
                          };
                          handleEditStaff(staffItem);
                          setShowDetailsPanel(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                {detailsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-gray-600 font-medium">Loading staff details...</p>
                  </div>
                ) : detailedStaff ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div>
                      {/* Profile Header */}
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                          {detailedStaff.user?.first_name?.charAt(0) || 'S'}{detailedStaff.user?.last_name?.charAt(0) || 'M'}
                        </div>
                        <div className="flex-1">
                          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            {detailedStaff.user?.first_name} {detailedStaff.user?.last_name}
                          </h1>
                          <p className="text-gray-500">{detailedStaff.user?.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              detailedStaff.user?.is_active ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${detailedStaff.user?.is_active ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
                              {detailedStaff.user?.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              detailedStaff.is_approved ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                            }`}>
                              {detailedStaff.is_approved ? 'Approved' : 'Pending Approval'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="p-4 bg-gray-50 rounded-xl mb-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Contact Information</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-gray-600">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <a href={`mailto:${detailedStaff.user?.email}`} className="hover:text-red-600 transition-colors">
                              {detailedStaff.user?.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-3 text-gray-600">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {detailedStaff.phone_number ? (
                              <a href={`tel:${detailedStaff.phone_number}`} className="hover:text-red-600 transition-colors">
                                {detailedStaff.phone_number}
                              </a>
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-gray-600">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="capitalize">{detailedStaff.user?.role || 'Staff'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Personal Details */}
                      {(detailedStaff.date_of_birth || detailedStaff.national_insurance_number || detailedStaff.street || detailedStaff.city) && (
                        <div className="p-4 bg-gray-50 rounded-xl mb-6">
                          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Personal Details</h3>
                          <div className="space-y-3">
                            {detailedStaff.date_of_birth && (
                              <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-gray-600">Born: <strong className="text-gray-900">{detailedStaff.date_of_birth}</strong></span>
                              </div>
                            )}
                            {detailedStaff.national_insurance_number && (
                              <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-gray-600">NI: <strong className="text-gray-900 font-mono">{detailedStaff.national_insurance_number}</strong></span>
                              </div>
                            )}
                            {(detailedStaff.street || detailedStaff.city) && (
                              <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-gray-600">
                                  {[detailedStaff.street, detailedStaff.city, detailedStaff.postal_code, detailedStaff.country]
                                    .filter(Boolean)
                                    .join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Security Roles */}
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Security Roles</h3>
                        {detailedStaff.security_roles?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
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
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium"
                                >
                                  {roleLabels[role] || role}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm">No security roles assigned</p>
                        )}
                      </div>
                    </div>

                    {/* Right Column - SIA Licenses */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                          SIA Licenses ({detailedStaff.sia_licenses?.length || 0})
                        </h3>
                        <button
                          onClick={() => handleCreateLicense(detailedStaff.id)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add License
                        </button>
                      </div>

                      {detailedStaff.sia_licenses?.length > 0 ? (
                        <div className="space-y-4">
                          {detailedStaff.sia_licenses.map((license: any, index: number) => (
                            <div
                              key={index}
                              className="border-2 border-gray-200 rounded-xl p-4 hover:border-red-300 transition-colors"
                            >
                              {/* License Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-mono text-lg font-bold text-gray-900">{license.license_number}</p>
                                  <p className="text-sm text-gray-500">{SIA_LICENSE_TYPE_DISPLAY[license.license_type] || license.license_type}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                  license.status === 'valid' ? 'bg-emerald-600 text-white' :
                                  license.status === 'expired' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    license.status === 'valid' ? 'bg-white animate-pulse' : 'bg-white/50'
                                  }`} />
                                  {license.status}
                                </span>
                              </div>

                              {/* License Details */}
                              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Issue Date</p>
                                  <p className="font-medium text-gray-900">{license.issue_date}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Expiry Date</p>
                                  <p className="font-medium text-gray-900">{license.expiry_date}</p>
                                </div>
                                {license.level && (
                                  <div>
                                    <p className="text-gray-500">Level</p>
                                    <p className="font-medium text-gray-900 capitalize">{license.level}</p>
                                  </div>
                                )}
                                {license.document_url && (
                                  <div>
                                    <p className="text-gray-500">Document</p>
                                    <a
                                      href={license.document_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-red-600 hover:text-red-700 transition-colors"
                                    >
                                      View Document
                                    </a>
                                  </div>
                                )}
                              </div>

                              {/* License Actions */}
                              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                <button
                                  onClick={() => handleEditLicense(license)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                {license.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveLicense(license.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectLicense(license.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-xl">
                          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-gray-500 mb-4">No SIA licenses on file</p>
                          <button
                            onClick={() => handleCreateLicense(detailedStaff.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add First License
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-gray-500">Unable to load staff details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Edit License Dialog */}
      <Dialog
        hidden={!showEditLicenseDialog}
        onDismiss={() => {
          setShowEditLicenseDialog(false);
          setEditingLicense(null);
        }}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Edit SIA License',
          subText: 'Update the license details below.'
        }}
        modalProps={{
          isBlocking: true,
          styles: { main: { maxWidth: 500 } }
        }}
      >
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: '10px 0' }}>
          <TextField
            label="License Number"
            required
            value={licenseFormData.license_number}
            onChange={(_, newValue) => handleLicenseFormChange('license_number', newValue || '')}
          />
          <Dropdown
            label="License Type"
            required
            options={SIA_LICENSE_TYPE_OPTIONS}
            selectedKey={licenseFormData.license_type}
            onChange={(_, option) => handleLicenseFormChange('license_type', option?.key as string)}
          />
          <Dropdown
            label="Level"
            options={SIA_LICENSE_LEVEL_OPTIONS}
            selectedKey={licenseFormData.level}
            onChange={(_, option) => handleLicenseFormChange('level', option?.key as string)}
          />
          <TextField
            label="Issue Date"
            required
            type="date"
            value={licenseFormData.issue_date}
            onChange={(_, newValue) => handleLicenseFormChange('issue_date', newValue || '')}
          />
          <TextField
            label="Expiry Date"
            required
            type="date"
            value={licenseFormData.expiry_date}
            onChange={(_, newValue) => handleLicenseFormChange('expiry_date', newValue || '')}
          />
          <Dropdown
            label="Status"
            required
            options={SIA_LICENSE_STATUS_OPTIONS}
            selectedKey={licenseFormData.status}
            onChange={(_, option) => handleLicenseFormChange('status', option?.key as string)}
          />
          <TextField
            label="Document URL"
            value={licenseFormData.document_url}
            onChange={(_, newValue) => handleLicenseFormChange('document_url', newValue || '')}
            placeholder="https://..."
          />
        </Stack>
        <DialogFooter>
          <DefaultButton
            text="Cancel"
            onClick={() => {
              setShowEditLicenseDialog(false);
              setEditingLicense(null);
            }}
          />
          <PrimaryButton
            text={savingLicense ? 'Saving...' : 'Save Changes'}
            onClick={handleSaveLicense}
            disabled={savingLicense || !licenseFormData.license_number || !licenseFormData.issue_date || !licenseFormData.expiry_date}
          />
        </DialogFooter>
      </Dialog>

      {/* Create License Dialog */}
      <Dialog
        hidden={!showCreateLicenseDialog}
        onDismiss={() => {
          setShowCreateLicenseDialog(false);
          setCreateLicenseForProfileId(null);
        }}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Add New SIA License',
          subText: 'Enter the license details below.'
        }}
        modalProps={{
          isBlocking: true,
          styles: { main: { maxWidth: 500 } }
        }}
      >
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: '10px 0' }}>
          <TextField
            label="License Number"
            required
            value={licenseFormData.license_number}
            onChange={(_, newValue) => handleLicenseFormChange('license_number', newValue || '')}
            placeholder="e.g., 1234567890123456"
          />
          <Dropdown
            label="License Type"
            required
            options={SIA_LICENSE_TYPE_OPTIONS}
            selectedKey={licenseFormData.license_type}
            onChange={(_, option) => handleLicenseFormChange('license_type', option?.key as string)}
          />
          <Dropdown
            label="Level"
            options={SIA_LICENSE_LEVEL_OPTIONS}
            selectedKey={licenseFormData.level}
            onChange={(_, option) => handleLicenseFormChange('level', option?.key as string)}
          />
          <TextField
            label="Issue Date"
            required
            type="date"
            value={licenseFormData.issue_date}
            onChange={(_, newValue) => handleLicenseFormChange('issue_date', newValue || '')}
          />
          <TextField
            label="Expiry Date"
            required
            type="date"
            value={licenseFormData.expiry_date}
            onChange={(_, newValue) => handleLicenseFormChange('expiry_date', newValue || '')}
          />
          <Dropdown
            label="Status"
            required
            options={SIA_LICENSE_STATUS_OPTIONS}
            selectedKey={licenseFormData.status}
            onChange={(_, option) => handleLicenseFormChange('status', option?.key as string)}
          />
          <TextField
            label="Document URL"
            value={licenseFormData.document_url}
            onChange={(_, newValue) => handleLicenseFormChange('document_url', newValue || '')}
            placeholder="https://..."
          />
        </Stack>
        <DialogFooter>
          <DefaultButton
            text="Cancel"
            onClick={() => {
              setShowCreateLicenseDialog(false);
              setCreateLicenseForProfileId(null);
            }}
          />
          <PrimaryButton
            text={savingLicense ? 'Creating...' : 'Create License'}
            onClick={handleSubmitNewLicense}
            disabled={savingLicense || !licenseFormData.license_number || !licenseFormData.issue_date || !licenseFormData.expiry_date}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default StaffManagement;
