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
  Label
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { UserRole } from '../../types';

// Icons
const addIcon: IIconProps = { iconName: 'PersonAdd' };
const filterIcon: IIconProps = { iconName: 'Filter' };
const refreshIcon: IIconProps = { iconName: 'Refresh' };

interface Staff {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  dateJoined: string;
  lastLogin: string | null;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

const StaffManagement: React.FC = () => {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAddStaffPanel, setShowAddStaffPanel] = useState(false);
  const [showEditStaffPanel, setShowEditStaffPanel] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

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
          <Link onClick={() => handleEditStaff(item)}>
            Edit
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
      // In a real application, this would use the actual API
      // const response = await authService.getAllStaff();
      // setStaffList(response);

      // For demo purposes, we'll use mock data
      const mockStaff: Staff[] = [
        {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+44 7700 900123',
          role: UserRole.STAFF,
          isActive: true,
          dateJoined: '2023-01-15T00:00:00Z',
          lastLogin: '2025-04-08T10:30:00Z',
          address: {
            street: '123 Main St',
            city: 'London',
            postalCode: 'SW1A 1AA',
            country: 'UK'
          }
        },
        {
          id: 2,
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          phone: '+44 7700 900124',
          role: UserRole.MANAGER,
          isActive: true,
          dateJoined: '2023-02-01T00:00:00Z',
          lastLogin: '2025-04-09T09:15:00Z',
          address: {
            street: '456 High St',
            city: 'Manchester',
            postalCode: 'M1 1AA',
            country: 'UK'
          }
        },
        {
          id: 3,
          firstName: 'Mike',
          lastName: 'Johnson',
          email: 'mike.johnson@example.com',
          phone: '+44 7700 900125',
          role: UserRole.STAFF,
          isActive: false,
          dateJoined: '2023-03-10T00:00:00Z',
          lastLogin: '2025-03-01T14:45:00Z',
          address: {
            street: '789 Park Lane',
            city: 'Birmingham',
            postalCode: 'B1 1AA',
            country: 'UK'
          }
        },
        {
          id: 4,
          firstName: 'Sarah',
          lastName: 'Williams',
          email: 'sarah.williams@example.com',
          phone: '+44 7700 900126',
          role: UserRole.ADMIN,
          isActive: true,
          dateJoined: '2022-11-05T00:00:00Z',
          lastLogin: '2025-04-09T08:30:00Z',
          address: {
            street: '10 Queen St',
            city: 'Edinburgh',
            postalCode: 'EH1 1AA',
            country: 'UK'
          }
        },
        {
          id: 5,
          firstName: 'David',
          lastName: 'Brown',
          email: 'david.brown@example.com',
          phone: '+44 7700 900127',
          role: UserRole.STAFF,
          isActive: true,
          dateJoined: '2024-01-20T00:00:00Z',
          lastLogin: '2025-04-07T17:10:00Z',
          address: {
            street: '25 George St',
            city: 'Glasgow',
            postalCode: 'G1 1AA',
            country: 'UK'
          }
        },
      ];

      setStaffList(mockStaff);
      setFilteredStaff(mockStaff);
    } catch (error) {
      console.error('Failed to load staff:', error);
      setError('Failed to load staff. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions
  const handleEditStaff = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setFormData({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      isActive: staff.isActive,
      street: staff.address?.street || '',
      city: staff.address?.city || '',
      postalCode: staff.address?.postalCode || '',
      country: staff.address?.country || '',
    });
    setShowEditStaffPanel(true);
  }, []);

  const handleToggleStatus = useCallback((staff: Staff) => {
    // In a real application, this would call the API
    // await authService.updateStaffStatus(staff.id, !staff.isActive);

    // For demo purposes, we'll just update the local state
    const updatedStaff = staffList.map(s =>
      s.id === staff.id ? { ...s, isActive: !s.isActive } : s
    );
    setStaffList(updatedStaff);
    setFilteredStaff(updatedStaff);
  }, [staffList]);

  const handleDeleteStaff = useCallback((staff: Staff) => {
    setSelectedStaff(staff);
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteStaff = useCallback(async () => {
    if (!selectedStaff) return;

    try {
      // In a real application, this would call the API
      // await authService.deleteStaff(selectedStaff.id);

      // For demo purposes, we'll just update the local state
      const updatedStaff = staffList.filter(s => s.id !== selectedStaff.id);
      setStaffList(updatedStaff);
      setFilteredStaff(updatedStaff);
      setShowDeleteDialog(false);
      setSelectedStaff(null);
    } catch (error) {
      console.error('Failed to delete staff:', error);
      setError('Failed to delete staff. Please try again.');
    }
  }, [selectedStaff, staffList]);

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
      // In a real application, this would call the API
      // const newStaff = await authService.createStaff(formData);

      // For demo purposes, we'll just update the local state
      const newStaff: Staff = {
        id: Math.max(...staffList.map(s => s.id)) + 1,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        isActive: formData.isActive,
        dateJoined: new Date().toISOString(),
        lastLogin: null,
        address: {
          street: formData.street,
          city: formData.city,
          postalCode: formData.postalCode,
          country: formData.country,
        }
      };

      const updatedStaff = [...staffList, newStaff];
      setStaffList(updatedStaff);
      setFilteredStaff(updatedStaff);
      setShowAddStaffPanel(false);
    } catch (error) {
      console.error('Failed to add staff:', error);
      setError('Failed to add staff. Please try again.');
    }
  }, [formData, staffList]);

  const handleUpdateStaff = useCallback(async () => {
    if (!selectedStaff) return;

    try {
      // In a real application, this would call the API
      // await authService.updateStaff(selectedStaff.id, formData);

      // For demo purposes, we'll just update the local state
      const updatedStaff = staffList.map(s =>
        s.id === selectedStaff.id
          ? {
              ...s,
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              phone: formData.phone,
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
    } catch (error) {
      console.error('Failed to update staff:', error);
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

  // Apply filters when search text, role filter, or status filter changes
  useEffect(() => {
    let result = staffList;

    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      result = result.filter(staff =>
        `${staff.firstName} ${staff.lastName}`.toLowerCase().includes(lowerCaseSearch) ||
        staff.email.toLowerCase().includes(lowerCaseSearch) ||
        staff.phone.includes(searchText)
      );
    }

    // Apply role filter
    if (roleFilter) {
      result = result.filter(staff => staff.role === roleFilter);
    }

    // Apply status filter
    if (statusFilter === 'active') {
      result = result.filter(staff => staff.isActive);
    } else if (statusFilter === 'inactive') {
      result = result.filter(staff => !staff.isActive);
    }

    setFilteredStaff(result);
  }, [searchText, roleFilter, statusFilter, staffList]);

  // Load staff when component mounts
  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Validate form
  const isFormValid = () => {
    return formData.firstName.trim() !== '' &&
           formData.lastName.trim() !== '' &&
           formData.email.trim() !== '' &&
           formData.phone.trim() !== '';
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Staff Management</Text>
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
    </MainLayout>
  );
};

export default StaffManagement;
