import React, { useState, useEffect, useCallback } from 'react';
import { bankHolidayService, BankHoliday, CreateBankHolidayRequest, UpdateBankHolidayRequest } from '../../services/bankHolidayService';
import { Header, Container, CloudscapeTable, StatusIndicator, EmptyState, ConfirmationModal, SpaceBetween, Alert } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';

const BankHolidayManagement: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

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

  // Generate year options (5 years back and forward)
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const loadBankHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bankHolidayService.getBankHolidays({ year: selectedYear });
      setBankHolidays(data);
    } catch (err) {
      addFlash({ type: 'error', content: 'Failed to load bank holidays' });
      console.error('Error loading bank holidays:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadBankHolidays();
  }, [loadBankHolidays]);

  const resetForm = () => {
    setFormData({ name: '', date: '', is_active: true });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Holiday name is required';
    if (!formData.date) errors.date = 'Date is required';
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
      addFlash({ type: 'success', content: 'Bank holiday created successfully' });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data) {
        const d = err.response.data;
        const msg = d.name?.[0] || d.date?.[0] || d.non_field_errors?.[0] || 'Validation error. Check your input.';
        addFlash({ type: 'error', content: msg });
      } else {
        addFlash({ type: 'error', content: 'Failed to create bank holiday' });
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
      addFlash({ type: 'success', content: 'Bank holiday updated successfully' });
    } catch (err: any) {
      addFlash({ type: 'error', content: err.response?.status === 400 ? 'Validation error. Check your input.' : 'Failed to update bank holiday' });
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
      addFlash({ type: 'success', content: 'Bank holiday deleted successfully' });
    } catch (err) {
      addFlash({ type: 'error', content: 'Failed to delete bank holiday' });
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
      addFlash({ type: 'success', content: `Created ${result.created_count} UK bank holidays for ${populateYear}` });
    } catch (err: any) {
      addFlash({ type: 'error', content: err.response?.data?.message || 'Failed to populate UK bank holidays' });
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
    setFormData({ name: item.name, date: item.date, is_active: item.is_active });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (item: BankHoliday) => {
    setSelectedHoliday(item);
    setIsDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const columnDefinitions: ColumnDefinition<BankHoliday>[] = [
    {
      id: 'name',
      header: 'Holiday name',
      sortingField: 'name',
      cell: (item) => (
        <div>
          <span className="font-medium text-gray-900">{item.name}</span>
          {!item.is_active && (
            <span className="block text-xs text-red-600">Inactive</span>
          )}
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      sortingField: 'date',
      cell: (item) => <span className="text-sm text-gray-700">{formatDate(item.date)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortingField: 'is_active',
      cell: (item) => (
        <StatusIndicator type={item.is_active ? 'success' : 'stopped'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </StatusIndicator>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditDialog(item)}
            className="px-3 h-8 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => openDeleteDialog(item)}
            className="px-3 h-8 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  // Form modal component
  const FormModal: React.FC<{
    visible: boolean;
    title: string;
    onSubmit: () => void;
    onCancel: () => void;
    submitLabel: string;
  }> = ({ visible, title, onSubmit, onCancel, submitLabel }) => {
    if (!visible) return null;
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full animate-scale-in">
          <div className="px-6 pt-6">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <div className="px-6 py-4 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Holiday name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Christmas Day"
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {formErrors.date && <p className="text-xs text-red-600 mt-1">{formErrors.date}</p>}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Active</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_active ? 'bg-red-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-500">{formData.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <SpaceBetween size="m">
      <Flashbar items={flashItems} onDismiss={removeFlash} />

      <Header
        variant="h1"
        description="Manage bank holidays for permanent employee invoicing"
        counter={String(bankHolidays.length)}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button
              onClick={() => { setPopulateYear(selectedYear); setIsPopulateDialogOpen(true); }}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Populate UK defaults
            </button>
            <button
              onClick={loadBankHolidays}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={openCreateDialog}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Create bank holiday
            </button>
          </div>
        }
      >
        Bank holidays
      </Header>

      <CloudscapeTable
        items={bankHolidays}
        columnDefinitions={columnDefinitions}
        loading={loading}
        loadingText="Loading bank holidays..."
        trackBy="id"
        variant="container"
        stripedRows
        empty={
          <EmptyState
            title="No bank holidays"
            description={`No bank holidays found for ${selectedYear}. Use "Populate UK defaults" to add standard UK bank holidays.`}
            action={
              <button
                onClick={() => { setPopulateYear(selectedYear); setIsPopulateDialogOpen(true); }}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Populate UK defaults
              </button>
            }
          />
        }
      />

      {/* Create dialog */}
      <FormModal
        visible={isCreateDialogOpen}
        title="Create bank holiday"
        onSubmit={handleCreate}
        onCancel={() => setIsCreateDialogOpen(false)}
        submitLabel="Create"
      />

      {/* Edit dialog */}
      <FormModal
        visible={isEditDialogOpen}
        title="Edit bank holiday"
        onSubmit={handleEdit}
        onCancel={() => { setIsEditDialogOpen(false); setSelectedHoliday(null); }}
        submitLabel="Save changes"
      />

      {/* Delete confirmation */}
      <ConfirmationModal
        visible={isDeleteDialogOpen}
        header="Delete bank holiday"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => { setIsDeleteDialogOpen(false); setSelectedHoliday(null); }}
        loading={submitting}
      >
        Are you sure you want to delete "{selectedHoliday?.name}"? This action cannot be undone.
      </ConfirmationModal>

      {/* Populate UK defaults confirmation */}
      <ConfirmationModal
        visible={isPopulateDialogOpen}
        header="Populate UK bank holidays"
        confirmLabel="Populate"
        onConfirm={handlePopulateUKDefaults}
        onCancel={() => setIsPopulateDialogOpen(false)}
        loading={submitting}
      >
        <div className="flex flex-col gap-3">
          <p>This will add all standard UK bank holidays for the selected year. Existing holidays will not be duplicated.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={populateYear}
              onChange={(e) => setPopulateYear(Number(e.target.value))}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <Alert type="info">
            UK bank holidays include: New Year's Day, Good Friday, Easter Monday, Early May Bank Holiday, Spring Bank Holiday, Summer Bank Holiday, Christmas Day, and Boxing Day.
          </Alert>
        </div>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default BankHolidayManagement;
