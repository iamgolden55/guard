import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../../types';
import api from '../../services/api';
import profileService from '../../services/profileService';
import { employmentTypeService, type EmploymentType } from '../../services/employmentTypeService';
import { useToast } from '../../components/shared/ToastNotificationSystem';
import { Header, Container, CloudscapeTable, StatusIndicator, EmptyState, ConfirmationModal, SpaceBetween, FormSection } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';

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
const SIA_LICENSE_TYPE_OPTIONS = [
  { value: 'ds', label: 'Door Supervisor' },
  { value: 'sg', label: 'Security Guard' },
  { value: 'cctv', label: 'CCTV Operator' },
  { value: 'cp', label: 'Close Protection' },
  { value: 'k9', label: 'Dog Handler' },
  { value: 'vs', label: 'Vehicle Security' },
  { value: 'key', label: 'Key Holding' },
];

const SIA_LICENSE_LEVEL_OPTIONS = [
  { value: 'trainee', label: 'Trainee' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'instructor', label: 'Instructor' },
];

const SIA_LICENSE_STATUS_OPTIONS = [
  { value: 'valid', label: 'Valid' },
  { value: 'expired', label: 'Expired' },
  { value: 'pending', label: 'Pending' },
];

// ─── Reusable Tailwind class constants ───────────────────────────────────────
const INPUT_CLASS = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent";
const SELECT_CLASS = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent";
const LABEL_CLASS = "block text-sm font-medium text-gray-700 mb-1";
const BTN_PRIMARY = "px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-colors";
const BTN_SECONDARY = "px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-colors";

// ─── Slide-over panel component ──────────────────────────────────────────────
const SlidePanel: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ open, onClose, title, wide = false, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex">
        <div className={`relative bg-white shadow-xl ${wide ? 'w-[700px] max-w-[90vw]' : 'w-[480px] max-w-[90vw]'} flex flex-col`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tab component ───────────────────────────────────────────────────────────
const Tabs: React.FC<{
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
}> = ({ tabs, activeTab, onChange }) => (
  <div className="flex border-b border-gray-200 mb-4">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          activeTab === tab.id
            ? 'border-red-600 text-red-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

const StaffManagement: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const flash = useFlashbar();
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

  // Tab state for form panels
  const [addFormTab, setAddFormTab] = useState('basic');
  const [editFormTab, setEditFormTab] = useState('basic');

  // Sorting state
  const [sortingColumn, setSortingColumn] = useState<{ sortingField: string } | undefined>(undefined);
  const [sortingDescending, setSortingDescending] = useState(false);

  // Load staff from API
  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersResponse, employmentTypesResponse] = await Promise.all([
        api.get<User[]>('/api/v1/users/'),
        employmentTypeService.getEmploymentTypes().catch(err => {
          console.error('Employment types fetch error:', err);
          return [];
        })
      ]);

      const employmentTypesArray = Array.isArray(employmentTypesResponse) ? employmentTypesResponse : ((employmentTypesResponse as any)?.results || []);
      setEmploymentTypes(employmentTypesArray);

      const staffWithProfiles = await Promise.all(
        usersResponse.data.map(async (user) => {
          let employmentType: EmploymentType | null = null;
          let phone = '';

          try {
            const profileResponse = await api.get(`/api/v1/staff-profiles/?user=${user.id}`);
            const profileData = profileResponse.data.results || profileResponse.data;
            if (profileData && profileData.length > 0) {
              const profile = profileData[0];
              phone = profile.phone_number || '';
              if (profile.employment_type_details) {
                employmentType = profile.employment_type_details;
              }
            }
          } catch (profileError) {
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
  }, []);

  const loadPendingStaff = useCallback(async () => {
    setPendingLoading(true);
    profileService.getPendingStaffProfiles()
      .then((data: any) => {
        let pendingStaffData = [];

        if (data && Array.isArray(data.results)) {
          pendingStaffData = data.results;
        } else if (Array.isArray(data)) {
          pendingStaffData = data;
        } else {
          console.error('Pending staff data is not an array or paginated object:', data);
          setPendingError('Received invalid data format for pending staff.');
          setPendingStaff([]);
          setPendingLoading(false);
          return;
        }

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

  useEffect(() => {
    loadStaff();
    loadPendingStaff();
  }, [loadStaff, loadPendingStaff]);

  // Apply filters
  useEffect(() => {
    if (!staffList.length) {
      setFilteredStaff([]);
      return;
    }

    let filtered = [...staffList];

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

    if (roleFilter) {
      filtered = filtered.filter(staff => staff.role === roleFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter(staff =>
        (statusFilter === 'active' && staff.isActive) ||
        (statusFilter === 'inactive' && !staff.isActive)
      );
    }

    // Apply sorting
    if (sortingColumn) {
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;
        switch (sortingColumn.sortingField) {
          case 'name':
            aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
            bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
            break;
          case 'email':
            aVal = a.email.toLowerCase();
            bVal = b.email.toLowerCase();
            break;
          case 'role':
            aVal = a.role;
            bVal = b.role;
            break;
          case 'dateJoined':
            aVal = a.dateJoined;
            bVal = b.dateJoined;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortingDescending ? 1 : -1;
        if (aVal > bVal) return sortingDescending ? -1 : 1;
        return 0;
      });
    }

    setFilteredStaff(filtered);
  }, [staffList, searchText, roleFilter, statusFilter, sortingColumn, sortingDescending]);

  // ─── Handler functions (all business logic preserved exactly) ───────────────

  const handleEditStaff = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setFormData({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone || '',
      role: staff.role,
      isActive: staff.isActive,
      street: (staff as any).street || staff.address?.street || '',
      city: (staff as any).city || staff.address?.city || '',
      postalCode: (staff as any).postal_code || staff.address?.postalCode || '',
      country: (staff as any).country || staff.address?.country || '',
    });
    setEditFormTab('basic');
    setShowEditStaffPanel(true);
  }, []);

  const handleToggleStatus = useCallback(async (staff: Staff) => {
    try {
      await api.patch(`/api/v1/users/${staff.id}/`, {
        is_active: !staff.isActive
      });

      try {
        const updatedStaff = staffList.map(s =>
          s.id === staff.id ? { ...s, isActive: !s.isActive } : s
        );
        setStaffList(updatedStaff);
        setFilteredStaff(updatedStaff);

        setError(null);
        const newStatus = !staff.isActive;
        if (newStatus) {
          toast.showSuccess('Staff Activated', `${staff.firstName} ${staff.lastName} has been activated.`);
        } else {
          toast.showSuccess('Staff Deactivated', `${staff.firstName} ${staff.lastName} has been deactivated.`);
        }
      } catch (stateError) {
        console.error('Error updating UI state after status toggle:', stateError);
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

      if (detailedStaff) {
        const updatedLicenses = detailedStaff.sia_licenses.map((license: any) =>
          license.id === licenseId ? { ...license, status: 'valid' } : license
        );
        setDetailedStaff({
          ...detailedStaff,
          sia_licenses: updatedLicenses
        });
      }

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

      if (detailedStaff) {
        const updatedLicenses = detailedStaff.sia_licenses.map((license: any) =>
          license.id === licenseId ? { ...license, status: 'expired' } : license
        );
        setDetailedStaff({
          ...detailedStaff,
          sia_licenses: updatedLicenses
        });
      }

      alert('SIA License marked as expired.');
    } catch (error) {
      console.error('Error updating license status:', error);
      alert('Failed to update license status. Please try again.');
    }
  }, [detailedStaff]);

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
      await api.delete(`/api/v1/users/${selectedStaff.id}/`);

      try {
        const updatedStaff = staffList.filter(s => s.id !== selectedStaff.id);
        setStaffList(updatedStaff);
        setFilteredStaff(filteredStaff.filter(s => s.id !== selectedStaff.id));
        setShowDeleteDialog(false);
        setShowPhraseConfirmDialog(false);
        setConfirmationPhrase('');
        setSelectedStaff(null);

        setError(null);
        toast.showSuccess('Staff Member Deleted', `${staffName} has been permanently removed.`);
      } catch (stateError) {
        console.error('Error updating UI state after staff deletion:', stateError);
        setShowDeleteDialog(false);
        setShowPhraseConfirmDialog(false);
        setConfirmationPhrase('');
        setSelectedStaff(null);
        toast.showSuccess('Staff Member Deleted', `${staffName} has been permanently removed.`);
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to delete staff:', err);
      setError('Failed to delete staff. Please try again.');
      toast.showError('Delete Failed', 'Failed to delete staff member. Please try again.');
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
    setAddFormTab('basic');
    setShowAddStaffPanel(true);
  }, []);

  const handleSubmitNewStaff = useCallback(async () => {
    try {
      const userData = {
        username: formData.email.split('@')[0],
        email: formData.email,
        password: 'temppassword123',
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role.toLowerCase(),
        is_active: formData.isActive
      };

      const response = await api.post('/api/v1/users/', userData);

      try {
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

        const updatedStaff = [...staffList, newStaff];
        setStaffList(updatedStaff);
        setFilteredStaff(updatedStaff);

        setShowAddStaffPanel(false);
        setError(null);

        window.location.reload();
      } catch (stateError) {
        console.error('Error updating UI state after staff creation:', stateError);
        setShowAddStaffPanel(false);
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
      const userData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        role: formData.role.toLowerCase(),
        is_active: formData.isActive
      };

      await api.patch(`/api/v1/users/${selectedStaff.id}/`, userData);

      try {
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
        setFilteredStaff(updatedStaff);
        setShowEditStaffPanel(false);
        setSelectedStaff(null);

        setError(null);
        toast.showSuccess('Staff Updated', `${formData.firstName} ${formData.lastName}'s profile has been updated.`);
      } catch (stateError) {
        console.error('Error updating UI state after staff update:', stateError);
        setShowEditStaffPanel(false);
        setSelectedStaff(null);
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to update staff:', err);
      toast.showError('Update Failed', 'Failed to update staff. Please try again.');
    }
  }, [selectedStaff, formData, staffList, toast]);

  const handleRefresh = useCallback(() => {
    loadStaff();
    return false;
  }, [loadStaff]);

  const handleFormInputChange = useCallback((field: string, value: string | UserRole | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleOpenReviewPanel = useCallback(async (staffListItem: StaffProfileDetail) => {
    setShowReviewPanel(true);
    setReviewingStaff(null);
    setReviewLoading(true);
    setReviewError(null);
    try {
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
    try {
      await profileService.approveStaffProfile(profileId);
      setPendingStaff(prev => prev.filter(p => p.id !== profileId));
      setShowReviewPanel(false);
      setReviewingStaff(null);
    } catch (err) {
      alert('Failed to approve staff.');
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
      const profileResponse = await api.get(`/api/v1/staff-profiles/?user=${selectedStaff.id}`);
      const staffProfile = profileResponse.data.results?.[0] || profileResponse.data[0];

      if (!staffProfile) {
        throw new Error('Staff profile not found');
      }

      await api.patch(`/api/v1/staff-profiles/${staffProfile.id}/`, {
        employmentType: selectedEmploymentType
      });

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

      const employmentTypeName = employmentTypes.find(et => et.id === selectedEmploymentType)?.name || 'Employment type';
      toast.showSuccess('Employment Type Assigned', `${selectedStaff.firstName} ${selectedStaff.lastName} is now assigned as ${employmentTypeName}.`);

      setShowAssignEmploymentTypePanel(false);
      setSelectedStaff(null);
      setSelectedEmploymentType(null);
      setError(null);
    } catch (err) {
      console.error('Failed to assign employment type:', err);
      toast.showError('Assignment Failed', 'Failed to assign employment type. Please try again.');
    } finally {
      setAssignmentLoading(false);
    }
  }, [selectedStaff, selectedEmploymentType, staffList, employmentTypes, toast]);

  const isFormValid = () => {
    return formData.firstName.trim() !== '' &&
      formData.lastName.trim() !== '' &&
      formData.email.trim() !== '';
  };

  // ─── Column definitions for CloudscapeTable ────────────────────────────────

  const roleLabels: Record<string, string> = {
    [UserRole.STAFF]: 'Staff',
    [UserRole.MANAGER]: 'Manager',
    [UserRole.ADMIN]: 'Admin',
  };

  const columnDefinitions: ColumnDefinition<Staff>[] = [
    {
      id: 'name',
      header: 'Name',
      sortingField: 'name',
      cell: (item) => (
        <span className="font-medium text-gray-900">{item.firstName} {item.lastName}</span>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      sortingField: 'email',
      cell: (item) => item.email,
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: (item) => item.phone || <span className="text-gray-400">--</span>,
    },
    {
      id: 'role',
      header: 'Role',
      sortingField: 'role',
      cell: (item) => roleLabels[item.role] || item.role,
    },
    {
      id: 'employmentType',
      header: 'Employment type',
      cell: (item) => (
        <div>
          <span className="text-sm">{item.employmentType?.name || 'Not set'}</span>
          {!item.employmentType && (
            <div>
              <StatusIndicator type="warning">Needs assignment</StatusIndicator>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item) => (
        <StatusIndicator type={item.isActive ? 'success' : 'stopped'}>
          {item.isActive ? 'Active' : 'Inactive'}
        </StatusIndicator>
      ),
    },
    {
      id: 'dateJoined',
      header: 'Date joined',
      sortingField: 'dateJoined',
      cell: (item) => new Date(item.dateJoined).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      minWidth: 420,
      cell: (item) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleViewStaffDetails(item)}
            className="px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            View details
          </button>
          <button
            onClick={() => handleEditStaff(item)}
            className="px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleAssignEmploymentType(item)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              item.employmentType ? 'text-gray-700 hover:bg-gray-100' : 'text-amber-600 hover:bg-amber-50'
            }`}
          >
            {item.employmentType ? 'Change type' : 'Assign type'}
          </button>
          <button
            onClick={() => handleToggleStatus(item)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              item.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
            }`}
          >
            {item.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => handleDeleteStaff(item)}
            className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  // ─── Pending staff column definitions ──────────────────────────────────────

  const pendingColumnDefinitions: ColumnDefinition<StaffProfileDetail>[] = [
    {
      id: 'pendingName',
      header: 'Name',
      cell: (item) => (
        <span className="font-medium text-gray-900">
          {item.user ? `${item.user.first_name} ${item.user.last_name}` : `Profile ID: ${item.id}`}
        </span>
      ),
    },
    {
      id: 'pendingEmail',
      header: 'Email',
      cell: (item) => item.user?.email || 'N/A',
    },
    {
      id: 'pendingActions',
      header: 'Actions',
      cell: (item) => (
        <button
          onClick={() => handleOpenReviewPanel(item)}
          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          Review
        </button>
      ),
    },
  ];

  // ─── License form (shared between edit and create) ─────────────────────────

  const renderLicenseForm = () => (
    <div className="flex flex-col gap-4">
      <div>
        <label className={LABEL_CLASS}>License number <span className="text-red-500">*</span></label>
        <input
          type="text"
          className={INPUT_CLASS}
          value={licenseFormData.license_number}
          onChange={(e) => handleLicenseFormChange('license_number', e.target.value)}
          placeholder="e.g., 1234567890123456"
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>License type <span className="text-red-500">*</span></label>
        <select
          className={SELECT_CLASS}
          value={licenseFormData.license_type}
          onChange={(e) => handleLicenseFormChange('license_type', e.target.value)}
        >
          {SIA_LICENSE_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>Level</label>
        <select
          className={SELECT_CLASS}
          value={licenseFormData.level}
          onChange={(e) => handleLicenseFormChange('level', e.target.value)}
        >
          {SIA_LICENSE_LEVEL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Issue date <span className="text-red-500">*</span></label>
          <input
            type="date"
            className={INPUT_CLASS}
            value={licenseFormData.issue_date}
            onChange={(e) => handleLicenseFormChange('issue_date', e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Expiry date <span className="text-red-500">*</span></label>
          <input
            type="date"
            className={INPUT_CLASS}
            value={licenseFormData.expiry_date}
            onChange={(e) => handleLicenseFormChange('expiry_date', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={LABEL_CLASS}>Status <span className="text-red-500">*</span></label>
        <select
          className={SELECT_CLASS}
          value={licenseFormData.status}
          onChange={(e) => handleLicenseFormChange('status', e.target.value)}
        >
          {SIA_LICENSE_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>Document URL</label>
        <input
          type="url"
          className={INPUT_CLASS}
          value={licenseFormData.document_url}
          onChange={(e) => handleLicenseFormChange('document_url', e.target.value)}
          placeholder="https://..."
        />
      </div>
    </div>
  );

  // ─── Staff form (shared between add and edit) ──────────────────────────────

  const renderStaffForm = (activeTab: string, onTabChange: (tab: string) => void) => (
    <>
      <Tabs
        tabs={[
          { id: 'basic', label: 'Basic information' },
          { id: 'address', label: 'Address' },
        ]}
        activeTab={activeTab}
        onChange={onTabChange}
      />

      {activeTab === 'basic' && (
        <FormSection header="Basic information">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>First name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={formData.firstName}
                onChange={(e) => handleFormInputChange('firstName', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Last name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={formData.lastName}
                onChange={(e) => handleFormInputChange('lastName', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              className={INPUT_CLASS}
              value={formData.email}
              onChange={(e) => handleFormInputChange('email', e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Phone</label>
            <input
              type="tel"
              className={INPUT_CLASS}
              value={formData.phone}
              onChange={(e) => handleFormInputChange('phone', e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Role <span className="text-red-500">*</span></label>
            <select
              className={SELECT_CLASS}
              value={formData.role}
              onChange={(e) => handleFormInputChange('role', e.target.value as UserRole)}
            >
              <option value={UserRole.STAFF}>Staff</option>
              <option value={UserRole.MANAGER}>Manager</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleFormInputChange('isActive', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:bg-red-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm text-gray-700">{formData.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </FormSection>
      )}

      {activeTab === 'address' && (
        <FormSection header="Address">
          <div>
            <label className={LABEL_CLASS}>Street</label>
            <input
              type="text"
              className={INPUT_CLASS}
              value={formData.street}
              onChange={(e) => handleFormInputChange('street', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>City</label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={formData.city}
                onChange={(e) => handleFormInputChange('city', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Postal code</label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={formData.postalCode}
                onChange={(e) => handleFormInputChange('postalCode', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Country</label>
            <input
              type="text"
              className={INPUT_CLASS}
              value={formData.country}
              onChange={(e) => handleFormInputChange('country', e.target.value)}
            />
          </div>
        </FormSection>
      )}
    </>
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <SpaceBetween size="l">
      <Flashbar items={flash.items} onDismiss={flash.removeFlash} />

      {error && (
        <Flashbar
          items={[{
            id: 'page-error',
            type: 'error',
            content: error,
            dismissible: true,
          }]}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Page header */}
      <Header
        variant="h1"
        counter={String(filteredStaff.length)}
        description="Manage staff members, approve pending registrations, and assign employment types."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} className={BTN_SECONDARY}>
              Refresh
            </button>
            <button onClick={handleAddStaff} className={BTN_PRIMARY}>
              Create staff member
            </button>
          </div>
        }
      >
        Staff
      </Header>

      {/* Pending staff approval section */}
      <Container
        header={
          <Header variant="h2" counter={String(pendingStaff.length)}>
            Pending approval with submitted credentials
          </Header>
        }
      >
        {pendingLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading pending staff...
          </div>
        ) : pendingError ? (
          <Flashbar
            items={[{ id: 'pending-error', type: 'error', content: pendingError, dismissible: false }]}
          />
        ) : pendingStaff.length === 0 ? (
          <EmptyState
            title="No pending approvals"
            description="Staff members must submit valid SIA license information before they will appear here for approval."
          />
        ) : (
          <CloudscapeTable
            items={pendingStaff}
            columnDefinitions={pendingColumnDefinitions}
            trackBy="id"
            variant="embedded"
          />
        )}
      </Container>

      {/* Pending SIA license approvals info */}
      <Container
        header={
          <Header variant="h2">Pending SIA license approvals</Header>
        }
      >
        <p className="text-sm text-gray-600 mb-2">
          Review and approve submitted SIA licenses by clicking "View details" on staff members with licenses requiring approval.
        </p>
        <Flashbar
          items={[{
            id: 'sia-info',
            type: 'info',
            content: 'SIA licenses with status "pending" require admin verification. Use the "View details" action to approve or reject individual licenses.',
            dismissible: false,
            autoDismiss: false,
          }]}
        />
      </Container>

      {/* Main staff table */}
      <CloudscapeTable
        items={filteredStaff}
        columnDefinitions={columnDefinitions}
        loading={isLoading}
        loadingText="Loading staff..."
        trackBy="id"
        variant="container"
        stickyHeader
        wrapLines
        sortingColumn={sortingColumn}
        sortingDescending={sortingDescending}
        onSortingChange={(detail) => {
          setSortingColumn(detail.sortingColumn);
          setSortingDescending(detail.isDescending);
        }}
        header={
          <Header variant="h2" counter={String(filteredStaff.length)}>
            All staff members
          </Header>
        }
        filter={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                className={INPUT_CLASS}
                placeholder="Search by name, email, or phone"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <select
              className={`${SELECT_CLASS} sm:w-40`}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              <option value={UserRole.STAFF}>Staff</option>
              <option value={UserRole.MANAGER}>Manager</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
            <select
              className={`${SELECT_CLASS} sm:w-40`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {(roleFilter || statusFilter) && (
              <button
                onClick={() => { setRoleFilter(''); setStatusFilter(''); }}
                className="text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>
        }
        empty={
          <EmptyState
            title="No staff found"
            description="Adjust your search criteria or create a new staff member."
            variant="no-match"
            action={
              <button onClick={handleAddStaff} className={BTN_PRIMARY}>
                Create staff member
              </button>
            }
          />
        }
      />

      {/* ─── Add staff panel ─────────────────────────────────────────────── */}
      <SlidePanel
        open={showAddStaffPanel}
        onClose={() => setShowAddStaffPanel(false)}
        title="Create staff member"
      >
        {renderStaffForm(addFormTab, setAddFormTab)}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <button className={BTN_SECONDARY} onClick={() => setShowAddStaffPanel(false)}>
            Cancel
          </button>
          <button
            className={BTN_PRIMARY}
            onClick={handleSubmitNewStaff}
            disabled={!isFormValid()}
          >
            Create staff member
          </button>
        </div>
      </SlidePanel>

      {/* ─── Edit staff panel ────────────────────────────────────────────── */}
      <SlidePanel
        open={showEditStaffPanel}
        onClose={() => { setShowEditStaffPanel(false); setSelectedStaff(null); }}
        title="Edit staff member"
      >
        {renderStaffForm(editFormTab, setEditFormTab)}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <button className={BTN_SECONDARY} onClick={() => { setShowEditStaffPanel(false); setSelectedStaff(null); }}>
            Cancel
          </button>
          <button
            className={BTN_PRIMARY}
            onClick={handleUpdateStaff}
            disabled={!isFormValid()}
          >
            Save changes
          </button>
        </div>
      </SlidePanel>

      {/* ─── Delete confirmation - step 1 ────────────────────────────────── */}
      <ConfirmationModal
        visible={showDeleteDialog && !!selectedStaff}
        header="Delete staff member"
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={() => {
          setShowDeleteDialog(false);
          setShowPhraseConfirmDialog(true);
        }}
        onCancel={() => setShowDeleteDialog(false)}
      >
        <p>
          Are you sure you want to delete <strong>{selectedStaff?.firstName} {selectedStaff?.lastName}</strong>? This action cannot be undone.
        </p>
      </ConfirmationModal>

      {/* ─── Delete confirmation - step 2 (phrase) ───────────────────────── */}
      <ConfirmationModal
        visible={showPhraseConfirmDialog && !!selectedStaff}
        header="Final confirmation"
        variant="destructive"
        confirmLabel="Delete permanently"
        confirmationText="DELETE"
        onConfirm={confirmDeleteStaff}
        onCancel={() => {
          setShowPhraseConfirmDialog(false);
          setConfirmationPhrase('');
        }}
      >
        <p>
          To permanently delete <strong>{selectedStaff?.firstName} {selectedStaff?.lastName}</strong>, type <strong className="text-red-600">DELETE</strong> below.
        </p>
      </ConfirmationModal>

      {/* ─── Staff review panel ──────────────────────────────────────────── */}
      <SlidePanel
        open={showReviewPanel}
        onClose={() => { setShowReviewPanel(false); setReviewingStaff(null); setReviewError(null); }}
        title={`Review staff: ${reviewingStaff?.user?.first_name || 'Loading...'} ${reviewingStaff?.user?.last_name || ''}`}
        wide
      >
        {reviewLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <svg className="animate-spin h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading details...
          </div>
        ) : reviewError ? (
          <Flashbar items={[{ id: 'review-error', type: 'error', content: reviewError, dismissible: false }]} />
        ) : reviewingStaff ? (
          <SpaceBetween size="l">
            {/* Profile header */}
            <div className="flex items-center gap-4">
              {reviewingStaff.profile_image_url ? (
                <img src={reviewingStaff.profile_image_url} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xl font-bold">
                  {reviewingStaff.user?.first_name?.charAt(0) || 'S'}{reviewingStaff.user?.last_name?.charAt(0) || 'M'}
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {reviewingStaff.user?.first_name || ''} {reviewingStaff.user?.last_name || ''}
                </h3>
                <p className="text-sm text-gray-500">{reviewingStaff.user?.email || 'N/A'}</p>
                <p className="text-sm text-gray-500">Role: {reviewingStaff.user?.role || 'N/A'}</p>
              </div>
            </div>

            <FormSection header="Contact information">
              <p className="text-sm text-gray-700">Phone: {reviewingStaff.phone_number || 'N/A'}</p>
            </FormSection>

            <FormSection header="Address">
              <p className="text-sm text-gray-700">{reviewingStaff.street || 'N/A'}</p>
              <p className="text-sm text-gray-700">{reviewingStaff.city || 'N/A'}, {reviewingStaff.postal_code || 'N/A'}</p>
              <p className="text-sm text-gray-700">{reviewingStaff.country || 'N/A'}</p>
            </FormSection>

            <FormSection header="Personal details">
              <p className="text-sm text-gray-700">DOB: {reviewingStaff.date_of_birth || 'N/A'}</p>
              <p className="text-sm text-gray-700">NI Number: {reviewingStaff.national_insurance_number || 'N/A'}</p>
            </FormSection>

            <FormSection header="Security roles">
              <p className="text-sm text-gray-700">
                {Array.isArray(reviewingStaff.security_roles) && reviewingStaff.security_roles.length > 0
                  ? reviewingStaff.security_roles.join(', ')
                  : 'None specified'}
              </p>
            </FormSection>

            <FormSection header="SIA licenses">
              {reviewingStaff.sia_licenses && reviewingStaff.sia_licenses.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {reviewingStaff.sia_licenses.map((lic, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-gray-900">Number: {lic.license_number}</p>
                      <p className="text-sm text-gray-600">Type: {SIA_LICENSE_TYPE_DISPLAY[lic.license_type] || lic.license_type}</p>
                      <p className="text-sm text-gray-600">
                        Status: <StatusIndicator type={lic.status === 'valid' ? 'success' : lic.status === 'expired' ? 'error' : 'pending'}>{lic.status}</StatusIndicator>
                      </p>
                      <p className="text-sm text-gray-600">Issue date: {lic.issue_date}</p>
                      <p className="text-sm text-gray-600">Expiry date: {lic.expiry_date}</p>
                      {lic.document_url && (
                        <a href={lic.document_url} target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 hover:text-red-700 font-medium">
                          View submitted document
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No SIA license details found.</p>
              )}
            </FormSection>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                className={BTN_PRIMARY}
                onClick={() => handleApproveStaff(reviewingStaff.id)}
                disabled={reviewLoading || reviewingStaff.is_approved}
              >
                Approve staff member
              </button>
            </div>
          </SpaceBetween>
        ) : (
          <p className="text-sm text-gray-500 py-4">No staff selected or failed to load details.</p>
        )}
      </SlidePanel>

      {/* ─── Staff details modal ─────────────────────────────────────────── */}
      {showDetailsPanel && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailsPanel(false)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                <button
                  onClick={() => setShowDetailsPanel(false)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to staff
                </button>
                {detailedStaff && (
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
                    className={BTN_SECONDARY}
                  >
                    Edit
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                {detailsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-gray-600 font-medium text-sm">Loading staff details...</p>
                  </div>
                ) : detailedStaff ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div>
                      {/* Profile header */}
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                          {detailedStaff.user?.first_name?.charAt(0) || 'S'}{detailedStaff.user?.last_name?.charAt(0) || 'M'}
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl font-semibold text-gray-900">
                            {detailedStaff.user?.first_name} {detailedStaff.user?.last_name}
                          </h2>
                          <p className="text-sm text-gray-500">{detailedStaff.user?.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <StatusIndicator type={detailedStaff.user?.is_active ? 'success' : 'stopped'}>
                              {detailedStaff.user?.is_active ? 'Active' : 'Inactive'}
                            </StatusIndicator>
                            <StatusIndicator type={detailedStaff.is_approved ? 'success' : 'warning'}>
                              {detailedStaff.is_approved ? 'Approved' : 'Pending approval'}
                            </StatusIndicator>
                          </div>
                        </div>
                      </div>

                      {/* Contact information */}
                      <div className="p-4 bg-gray-50 rounded-xl mb-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact information</h3>
                        <div className="space-y-2.5 text-sm">
                          <div className="flex items-center gap-2.5 text-gray-600">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <a href={`mailto:${detailedStaff.user?.email}`} className="hover:text-red-600 transition-colors">
                              {detailedStaff.user?.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2.5 text-gray-600">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          <div className="flex items-center gap-2.5 text-gray-600">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="capitalize">{detailedStaff.user?.role || 'Staff'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Personal details */}
                      {(detailedStaff.date_of_birth || detailedStaff.national_insurance_number || detailedStaff.street || detailedStaff.city) && (
                        <div className="p-4 bg-gray-50 rounded-xl mb-4">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Personal details</h3>
                          <div className="space-y-2.5 text-sm">
                            {detailedStaff.date_of_birth && (
                              <div className="flex items-center gap-2.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-gray-600">Born: <strong className="text-gray-900">{detailedStaff.date_of_birth}</strong></span>
                              </div>
                            )}
                            {detailedStaff.national_insurance_number && (
                              <div className="flex items-center gap-2.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-gray-600">NI: <strong className="text-gray-900 font-mono">{detailedStaff.national_insurance_number}</strong></span>
                              </div>
                            )}
                            {(detailedStaff.street || detailedStaff.city) && (
                              <div className="flex items-start gap-2.5">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                      {/* Security roles */}
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Security roles</h3>
                        {detailedStaff.security_roles?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {detailedStaff.security_roles.map((role: string, index: number) => {
                              const roleLabelsMap: { [key: string]: string } = {
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
                                  className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium"
                                >
                                  {roleLabelsMap[role] || role}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm">No security roles assigned</p>
                        )}
                      </div>
                    </div>

                    {/* Right column - SIA Licenses */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          SIA licenses ({detailedStaff.sia_licenses?.length || 0})
                        </h3>
                        <button
                          onClick={() => handleCreateLicense(detailedStaff.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                        >
                          + Add license
                        </button>
                      </div>

                      {detailedStaff.sia_licenses?.length > 0 ? (
                        <div className="space-y-4">
                          {detailedStaff.sia_licenses.map((license: any, index: number) => (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-mono text-base font-semibold text-gray-900">{license.license_number}</p>
                                  <p className="text-sm text-gray-500">{SIA_LICENSE_TYPE_DISPLAY[license.license_type] || license.license_type}</p>
                                </div>
                                <StatusIndicator
                                  type={license.status === 'valid' ? 'success' : license.status === 'expired' ? 'error' : 'pending'}
                                >
                                  {license.status}
                                </StatusIndicator>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                                <div>
                                  <p className="text-gray-500 text-xs">Issue date</p>
                                  <p className="font-medium text-gray-900">{license.issue_date}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs">Expiry date</p>
                                  <p className="font-medium text-gray-900">{license.expiry_date}</p>
                                </div>
                                {license.level && (
                                  <div>
                                    <p className="text-gray-500 text-xs">Level</p>
                                    <p className="font-medium text-gray-900 capitalize">{license.level}</p>
                                  </div>
                                )}
                                {license.document_url && (
                                  <div>
                                    <p className="text-gray-500 text-xs">Document</p>
                                    <a
                                      href={license.document_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-red-600 hover:text-red-700 transition-colors text-sm"
                                    >
                                      View document
                                    </a>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                <button
                                  onClick={() => handleEditLicense(license)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                >
                                  Edit
                                </button>
                                {license.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveLicense(license.id)}
                                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectLicense(license.id)}
                                      className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No SIA licenses on file"
                          description="Add a license to get started."
                          action={
                            <button
                              onClick={() => handleCreateLicense(detailedStaff.id)}
                              className={BTN_PRIMARY}
                            >
                              Add first license
                            </button>
                          }
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Unable to load staff details"
                    variant="error"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Employment type assignment panel ────────────────────────────── */}
      <SlidePanel
        open={showAssignEmploymentTypePanel}
        onClose={() => { setShowAssignEmploymentTypePanel(false); setSelectedStaff(null); setSelectedEmploymentType(null); }}
        title={selectedStaff ? `Assign employment type - ${selectedStaff.firstName} ${selectedStaff.lastName}` : 'Assign employment type'}
      >
        {selectedStaff && (
          <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-sm font-bold">
              {selectedStaff.firstName.charAt(0)}{selectedStaff.lastName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedStaff.firstName} {selectedStaff.lastName}</p>
              <p className="text-xs text-gray-500">{selectedStaff.email}</p>
              <p className="text-xs text-gray-500">Current: {selectedStaff.employmentType?.name || 'Not set'}</p>
            </div>
          </div>
        )}

        <FormSection header="Employment type">
          <div>
            <label className={LABEL_CLASS}>Select employment type <span className="text-red-500">*</span></label>
            <select
              className={SELECT_CLASS}
              value={selectedEmploymentType ?? ''}
              onChange={(e) => setSelectedEmploymentType(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select employment type</option>
              {Array.isArray(employmentTypes) && employmentTypes.map(et => (
                <option key={et.id} value={et.id}>{et.name}</option>
              ))}
            </select>
            {employmentTypes.length === 0 && (
              <p className="text-xs text-red-600 mt-1">No employment types available. Please create some in Settings first.</p>
            )}
          </div>
        </FormSection>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <button
            className={BTN_SECONDARY}
            onClick={() => { setShowAssignEmploymentTypePanel(false); setSelectedStaff(null); setSelectedEmploymentType(null); }}
          >
            Cancel
          </button>
          <button
            className={BTN_PRIMARY}
            onClick={handleSubmitEmploymentTypeAssignment}
            disabled={!selectedEmploymentType || assignmentLoading}
          >
            {assignmentLoading ? 'Assigning...' : 'Assign employment type'}
          </button>
        </div>
      </SlidePanel>

      {/* ─── Edit license modal ──────────────────────────────────────────── */}
      {showEditLicenseDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => { setShowEditLicenseDialog(false); setEditingLicense(null); }} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">Edit SIA license</h2>
              <p className="text-sm text-gray-500 mt-1">Update the license details below.</p>
            </div>
            <div className="px-6 py-4">
              {renderLicenseForm()}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                className={BTN_SECONDARY}
                onClick={() => { setShowEditLicenseDialog(false); setEditingLicense(null); }}
              >
                Cancel
              </button>
              <button
                className={BTN_PRIMARY}
                onClick={handleSaveLicense}
                disabled={savingLicense || !licenseFormData.license_number || !licenseFormData.issue_date || !licenseFormData.expiry_date}
              >
                {savingLicense ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create license modal ────────────────────────────────────────── */}
      {showCreateLicenseDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => { setShowCreateLicenseDialog(false); setCreateLicenseForProfileId(null); }} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">Add new SIA license</h2>
              <p className="text-sm text-gray-500 mt-1">Enter the license details below.</p>
            </div>
            <div className="px-6 py-4">
              {renderLicenseForm()}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                className={BTN_SECONDARY}
                onClick={() => { setShowCreateLicenseDialog(false); setCreateLicenseForProfileId(null); }}
              >
                Cancel
              </button>
              <button
                className={BTN_PRIMARY}
                onClick={handleSubmitNewLicense}
                disabled={savingLicense || !licenseFormData.license_number || !licenseFormData.issue_date || !licenseFormData.expiry_date}
              >
                {savingLicense ? 'Creating...' : 'Create license'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SpaceBetween>
  );
};

export default StaffManagement;
