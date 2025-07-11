import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode,
  CommandBar,
  ICommandBarItemProps,
  Dialog,
  DialogFooter,
  DialogContent,
  TextField,
  Toggle,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import { employmentTypeService, EmploymentType, CreateEmploymentTypeRequest, UpdateEmploymentTypeRequest } from '../services/employmentTypeService';

interface EmploymentTypesManagementProps {
  onRefresh?: () => void;
}

const EmploymentTypesManagement: React.FC<EmploymentTypesManagementProps> = ({ onRefresh }) => {
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<EmploymentType | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<CreateEmploymentTypeRequest>({
    name: '',
    description: '',
    is_active: true
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEmploymentTypes();
  }, []);


  const loadEmploymentTypes = async () => {
    try {
      setLoading(true);
      const data = await employmentTypeService.getEmploymentTypes();
      
      // Handle paginated response - extract results array
      const employmentTypesArray = Array.isArray(data) ? data : (data?.results || []);
      
      setEmploymentTypes(employmentTypesArray);
    } catch (err) {
      setError('Failed to load employment types');
      console.error('Error loading employment types:', err);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      await employmentTypeService.createEmploymentType(formData);
      setIsCreateDialogOpen(false);
      resetForm();
      await loadEmploymentTypes();
      showSuccess('Employment type created successfully');
      onRefresh?.();
    } catch (err: any) {
      // Check if it's a validation error from the backend
      if (err.response?.status === 400 && err.response?.data) {
        if (err.response.data.name) {
          setError(err.response.data.name[0] || 'Employment type name validation failed');
        } else if (err.response.data.description) {
          setError(err.response.data.description[0] || 'Description validation failed');
        } else {
          setError('Validation error. Please check your input.');
        }
      } else {
        setError('Failed to create employment type');
      }
      console.error('Error creating employment type:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedEmploymentType || !validateForm()) return;
    
    try {
      setSubmitting(true);
      const updateData: UpdateEmploymentTypeRequest = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active
      };
      
      await employmentTypeService.updateEmploymentType(selectedEmploymentType.id, updateData);
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedEmploymentType(null);
      await loadEmploymentTypes();
      showSuccess('Employment type updated successfully');
      onRefresh?.();
    } catch (err: any) {
      // Check if it's a validation error from the backend
      if (err.response?.status === 400 && err.response?.data) {
        if (err.response.data.name) {
          setError(err.response.data.name[0] || 'Employment type name validation failed');
        } else if (err.response.data.description) {
          setError(err.response.data.description[0] || 'Description validation failed');
        } else {
          setError('Validation error. Please check your input.');
        }
      } else {
        setError('Failed to update employment type');
      }
      console.error('Error updating employment type:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmploymentType) return;
    
    try {
      setSubmitting(true);
      await employmentTypeService.deleteEmploymentType(selectedEmploymentType.id);
      setIsDeleteDialogOpen(false);
      setSelectedEmploymentType(null);
      await loadEmploymentTypes();
      showSuccess('Employment type deleted successfully');
      onRefresh?.();
    } catch (err) {
      setError('Failed to delete employment type');
      console.error('Error deleting employment type:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (item: EmploymentType) => {
    setSelectedEmploymentType(item);
    setFormData({
      name: item.name,
      description: item.description,
      is_active: item.is_active
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (item: EmploymentType) => {
    setSelectedEmploymentType(item);
    setIsDeleteDialogOpen(true);
  };

  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Name',
      fieldName: 'name',
      minWidth: 150,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: EmploymentType) => (
        <Stack>
          <Text variant="medium" style={{ fontWeight: 'semibold' }}>
            {item.name}
          </Text>
          {!item.is_active && (
            <Text variant="small" style={{ color: '#d13438' }}>
              Inactive
            </Text>
          )}
        </Stack>
      )
    },
    {
      key: 'description',
      name: 'Description',
      fieldName: 'description',
      minWidth: 200,
      maxWidth: 400,
      isResizable: true,
      isMultiline: true,
      onRender: (item: EmploymentType) => (
        <Text variant="small">{item.description}</Text>
      )
    },
    {
      key: 'application_count',
      name: 'Applications',
      fieldName: 'application_count',
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: EmploymentType) => (
        <Text variant="medium">{item.application_count}</Text>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 200,
      onRender: (item: EmploymentType) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <DefaultButton
            text="Edit"
            iconProps={{ iconName: 'Edit' }}
            onClick={() => openEditDialog(item)}
          />
          <DefaultButton
            text="Delete"
            iconProps={{ iconName: 'Delete' }}
            onClick={() => openDeleteDialog(item)}
            style={{ color: '#d13438' }}
          />
        </Stack>
      )
    }
  ];

  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'new',
      text: 'New Employment Type',
      iconProps: { iconName: 'Add' },
      onClick: openCreateDialog
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: loadEmploymentTypes
    }
  ];

  if (loading) {
    return <Spinner label="Loading employment types..." size={SpinnerSize.large} />;
  }

  return (
    <Stack tokens={{ childrenGap: 16 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Text variant="xLarge">Employment Types</Text>
        <Text variant="medium">
          Total: {employmentTypes.length} types
        </Text>
      </Stack>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={() => setError(null)}
        >
          {error}
        </MessageBar>
      )}

      {successMessage && (
        <MessageBar
          messageBarType={MessageBarType.success}
          isMultiline={false}
          onDismiss={() => setSuccessMessage(null)}
        >
          {successMessage}
        </MessageBar>
      )}

      <CommandBar items={commandBarItems} />

      <DetailsList
        items={employmentTypes}
        columns={columns}
        setKey="set"
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
      />

      {/* Create Dialog */}
      <Dialog
        hidden={!isCreateDialogOpen}
        onDismiss={() => setIsCreateDialogOpen(false)}
        dialogContentProps={{
          type: 'largeHeader',
          title: 'Create Employment Type',
          subText: 'Add a new employment type for recruitment applications.'
        }}
        minWidth={500}
      >
        <DialogContent>
          <Stack tokens={{ childrenGap: 16 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(_, newValue) => setFormData({ ...formData, name: newValue || '' })}
              errorMessage={formErrors.name}
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(_, newValue) => setFormData({ ...formData, description: newValue || '' })}
              errorMessage={formErrors.description}
              multiline
              rows={3}
              required
            />
            <Toggle
              label="Active"
              checked={formData.is_active}
              onChange={(_, checked) => setFormData({ ...formData, is_active: checked || false })}
              onText="Active"
              offText="Inactive"
            />
          </Stack>
        </DialogContent>
        <DialogFooter>
          <PrimaryButton
            text="Create"
            onClick={handleCreate}
            disabled={submitting}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setIsCreateDialogOpen(false)}
            disabled={submitting}
          />
        </DialogFooter>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        hidden={!isEditDialogOpen}
        onDismiss={() => setIsEditDialogOpen(false)}
        dialogContentProps={{
          type: 'largeHeader',
          title: 'Edit Employment Type',
          subText: 'Update the employment type details.'
        }}
        minWidth={500}
      >
        <DialogContent>
          <Stack tokens={{ childrenGap: 16 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(_, newValue) => setFormData({ ...formData, name: newValue || '' })}
              errorMessage={formErrors.name}
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(_, newValue) => setFormData({ ...formData, description: newValue || '' })}
              errorMessage={formErrors.description}
              multiline
              rows={3}
              required
            />
            <Toggle
              label="Active"
              checked={formData.is_active}
              onChange={(_, checked) => setFormData({ ...formData, is_active: checked || false })}
              onText="Active"
              offText="Inactive"
            />
          </Stack>
        </DialogContent>
        <DialogFooter>
          <PrimaryButton
            text="Update"
            onClick={handleEdit}
            disabled={submitting}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setIsEditDialogOpen(false)}
            disabled={submitting}
          />
        </DialogFooter>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        hidden={!isDeleteDialogOpen}
        onDismiss={() => setIsDeleteDialogOpen(false)}
        dialogContentProps={{
          type: 'normal',
          title: 'Delete Employment Type',
          subText: `Are you sure you want to delete "${selectedEmploymentType?.name}"? This action cannot be undone.`
        }}
      >
        <DialogFooter>
          <PrimaryButton
            text="Delete"
            onClick={handleDelete}
            disabled={submitting}
            style={{ backgroundColor: '#d13438' }}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setIsDeleteDialogOpen(false)}
            disabled={submitting}
          />
        </DialogFooter>
      </Dialog>
    </Stack>
  );
};

export default EmploymentTypesManagement;