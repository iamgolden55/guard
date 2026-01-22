import React, { useState, useEffect, useCallback } from 'react';
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
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  DatePicker,
  DayOfWeek,
  IDatePickerStrings
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { bankHolidayService, BankHoliday, CreateBankHolidayRequest, UpdateBankHolidayRequest } from '../../services/bankHolidayService';

const datePickerStrings: IDatePickerStrings = {
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  goToToday: 'Go to today',
  prevMonthAriaLabel: 'Go to previous month',
  nextMonthAriaLabel: 'Go to next month',
  prevYearAriaLabel: 'Go to previous year',
  nextYearAriaLabel: 'Go to next year'
};

const BankHolidayManagement: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPopulateDialogOpen, setIsPopulateDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<BankHoliday | null>(null);

  // Form states
  const [formData, setFormData] = useState<CreateBankHolidayRequest>({
    name: '',
    date: '',
    is_active: true
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [populateYear, setPopulateYear] = useState<number>(currentYear);

  // Generate year options for dropdown (5 years back and forward)
  const yearOptions: IDropdownOption[] = Array.from({ length: 11 }, (_, i) => {
    const year = currentYear - 5 + i;
    return { key: year, text: year.toString() };
  });

  const loadBankHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bankHolidayService.getBankHolidays({ year: selectedYear });
      setBankHolidays(data);
    } catch (err) {
      setError('Failed to load bank holidays');
      console.error('Error loading bank holidays:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadBankHolidays();
  }, [loadBankHolidays]);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      is_active: true
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Holiday name is required';
    }

    if (!formData.date) {
      errors.date = 'Date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      await bankHolidayService.createBankHoliday(formData);
      setIsCreateDialogOpen(false);
      resetForm();
      await loadBankHolidays();
      showSuccess('Bank holiday created successfully');
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data) {
        const errorData = err.response.data;
        if (errorData.name) {
          setError(errorData.name[0] || 'Name validation failed');
        } else if (errorData.date) {
          setError(errorData.date[0] || 'Date validation failed');
        } else if (errorData.non_field_errors) {
          setError(errorData.non_field_errors[0] || 'Validation error');
        } else {
          setError('Validation error. Please check your input.');
        }
      } else {
        setError('Failed to create bank holiday');
      }
      console.error('Error creating bank holiday:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedHoliday || !validateForm()) return;

    try {
      setSubmitting(true);
      const updateData: UpdateBankHolidayRequest = {
        name: formData.name,
        date: formData.date,
        is_active: formData.is_active
      };

      await bankHolidayService.updateBankHoliday(selectedHoliday.id, updateData);
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedHoliday(null);
      await loadBankHolidays();
      showSuccess('Bank holiday updated successfully');
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data) {
        setError('Validation error. Please check your input.');
      } else {
        setError('Failed to update bank holiday');
      }
      console.error('Error updating bank holiday:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedHoliday) return;

    try {
      setSubmitting(true);
      await bankHolidayService.deleteBankHoliday(selectedHoliday.id);
      setIsDeleteDialogOpen(false);
      setSelectedHoliday(null);
      await loadBankHolidays();
      showSuccess('Bank holiday deleted successfully');
    } catch (err) {
      setError('Failed to delete bank holiday');
      console.error('Error deleting bank holiday:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePopulateUKDefaults = async () => {
    try {
      setSubmitting(true);
      const result = await bankHolidayService.populateUKDefaults(populateYear);
      setIsPopulateDialogOpen(false);
      await loadBankHolidays();
      showSuccess(`Created ${result.created_count} UK bank holidays for ${populateYear}`);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to populate UK bank holidays');
      }
      console.error('Error populating UK defaults:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (item: BankHoliday) => {
    setSelectedHoliday(item);
    setFormData({
      name: item.name,
      date: item.date,
      is_active: item.is_active
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (item: BankHoliday) => {
    setSelectedHoliday(item);
    setIsDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Holiday Name',
      fieldName: 'name',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
      onRender: (item: BankHoliday) => (
        <Stack>
          <Text variant="medium" style={{ fontWeight: 600 }}>
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
      key: 'date',
      name: 'Date',
      fieldName: 'date',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: BankHoliday) => (
        <Text variant="medium">{formatDate(item.date)}</Text>
      )
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'is_active',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: BankHoliday) => (
        <span
          style={{
            backgroundColor: item.is_active ? '#107c10' : '#d13438',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 200,
      onRender: (item: BankHoliday) => (
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
      text: 'Add Bank Holiday',
      iconProps: { iconName: 'Add' },
      onClick: openCreateDialog
    },
    {
      key: 'populate',
      text: 'Populate UK Defaults',
      iconProps: { iconName: 'Calendar' },
      onClick: () => {
        setPopulateYear(selectedYear);
        setIsPopulateDialogOpen(true);
      }
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: loadBankHolidays
    }
  ];

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 16 }} style={{ padding: '20px' }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <div>
            <Text variant="xLarge" style={{ fontWeight: 600 }}>Bank Holiday Management</Text>
            <Text variant="small" style={{ display: 'block', color: '#605e5c', marginTop: '4px' }}>
              Manage bank holidays for permanent employee invoicing
            </Text>
          </div>
          <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="center">
            <Dropdown
              label="Year"
              selectedKey={selectedYear}
              options={yearOptions}
              onChange={(_, option) => option && setSelectedYear(option.key as number)}
              styles={{ dropdown: { width: 120 } }}
            />
            <Text variant="medium" style={{ paddingTop: '28px' }}>
              Total: {bankHolidays.length} holidays
            </Text>
          </Stack>
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

        {loading ? (
          <Spinner label="Loading bank holidays..." size={SpinnerSize.large} />
        ) : bankHolidays.length === 0 ? (
          <MessageBar messageBarType={MessageBarType.info}>
            No bank holidays found for {selectedYear}. Click "Populate UK Defaults" to add standard UK bank holidays.
          </MessageBar>
        ) : (
          <DetailsList
            items={bankHolidays}
            columns={columns}
            setKey="set"
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
            isHeaderVisible={true}
          />
        )}

        {/* Create Dialog */}
        <Dialog
          hidden={!isCreateDialogOpen}
          onDismiss={() => setIsCreateDialogOpen(false)}
          dialogContentProps={{
            type: 'largeHeader' as any,
            title: 'Add Bank Holiday',
            subText: 'Add a new bank holiday for permanent employee invoicing.'
          }}
          minWidth={450}
        >
          <DialogContent>
            <Stack tokens={{ childrenGap: 16 }}>
              <TextField
                label="Holiday Name"
                value={formData.name}
                onChange={(_, newValue) => setFormData({ ...formData, name: newValue || '' })}
                errorMessage={formErrors.name}
                placeholder="e.g., Christmas Day"
                required
              />
              <DatePicker
                label="Date"
                firstDayOfWeek={DayOfWeek.Monday}
                strings={datePickerStrings}
                value={formData.date ? new Date(formData.date) : undefined}
                onSelectDate={(date) => {
                  if (date) {
                    const formattedDate = date.toISOString().split('T')[0];
                    setFormData({ ...formData, date: formattedDate });
                  }
                }}
                isRequired
              />
              {formErrors.date && (
                <Text variant="small" style={{ color: '#d13438' }}>{formErrors.date}</Text>
              )}
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
            <PrimaryButton text="Create" onClick={handleCreate} disabled={submitting} />
            <DefaultButton text="Cancel" onClick={() => setIsCreateDialogOpen(false)} disabled={submitting} />
          </DialogFooter>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog
          hidden={!isEditDialogOpen}
          onDismiss={() => setIsEditDialogOpen(false)}
          dialogContentProps={{
            type: 'largeHeader' as any,
            title: 'Edit Bank Holiday',
            subText: 'Update the bank holiday details.'
          }}
          minWidth={450}
        >
          <DialogContent>
            <Stack tokens={{ childrenGap: 16 }}>
              <TextField
                label="Holiday Name"
                value={formData.name}
                onChange={(_, newValue) => setFormData({ ...formData, name: newValue || '' })}
                errorMessage={formErrors.name}
                required
              />
              <DatePicker
                label="Date"
                firstDayOfWeek={DayOfWeek.Monday}
                strings={datePickerStrings}
                value={formData.date ? new Date(formData.date) : undefined}
                onSelectDate={(date) => {
                  if (date) {
                    const formattedDate = date.toISOString().split('T')[0];
                    setFormData({ ...formData, date: formattedDate });
                  }
                }}
                isRequired
              />
              {formErrors.date && (
                <Text variant="small" style={{ color: '#d13438' }}>{formErrors.date}</Text>
              )}
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
            <PrimaryButton text="Update" onClick={handleEdit} disabled={submitting} />
            <DefaultButton text="Cancel" onClick={() => setIsEditDialogOpen(false)} disabled={submitting} />
          </DialogFooter>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog
          hidden={!isDeleteDialogOpen}
          onDismiss={() => setIsDeleteDialogOpen(false)}
          dialogContentProps={{
            type: 'normal' as any,
            title: 'Delete Bank Holiday',
            subText: `Are you sure you want to delete "${selectedHoliday?.name}"? This action cannot be undone.`
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

        {/* Populate UK Defaults Dialog */}
        <Dialog
          hidden={!isPopulateDialogOpen}
          onDismiss={() => setIsPopulateDialogOpen(false)}
          dialogContentProps={{
            type: 'normal' as any,
            title: 'Populate UK Bank Holidays',
            subText: 'This will add all standard UK bank holidays for the selected year. Existing holidays will not be duplicated.'
          }}
          minWidth={400}
        >
          <DialogContent>
            <Stack tokens={{ childrenGap: 16 }}>
              <Dropdown
                label="Year"
                selectedKey={populateYear}
                options={yearOptions}
                onChange={(_, option) => option && setPopulateYear(option.key as number)}
              />
              <MessageBar messageBarType={MessageBarType.info}>
                UK bank holidays include:
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>New Year's Day</li>
                  <li>Good Friday & Easter Monday</li>
                  <li>Early May Bank Holiday</li>
                  <li>Spring Bank Holiday</li>
                  <li>Summer Bank Holiday</li>
                  <li>Christmas Day & Boxing Day</li>
                </ul>
              </MessageBar>
            </Stack>
          </DialogContent>
          <DialogFooter>
            <PrimaryButton
              text="Populate"
              onClick={handlePopulateUKDefaults}
              disabled={submitting}
              iconProps={{ iconName: 'Calendar' }}
            />
            <DefaultButton
              text="Cancel"
              onClick={() => setIsPopulateDialogOpen(false)}
              disabled={submitting}
            />
          </DialogFooter>
        </Dialog>
      </Stack>
    </MainLayout>
  );
};

export default BankHolidayManagement;
