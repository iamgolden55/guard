import React, { useState, useEffect, useCallback } from 'react';
import {
  contractorUnavailabilityService,
  ContractorUnavailability as UnavailabilityPeriod
} from '../../services/contractorUnavailabilityService';
import { Header, Container, SpaceBetween, Alert, EmptyState, ConfirmationModal, ExpandableSection } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';

interface ContractorUnavailabilityProps {
  className?: string;
}

const ContractorUnavailability: React.FC<ContractorUnavailabilityProps> = ({ className }) => {
  const [unavailabilityPeriods, setUnavailabilityPeriods] = useState<UnavailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<UnavailabilityPeriod | null>(null);

  // Form states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const periods = await contractorUnavailabilityService.getMyUnavailability();
      // Sort by start date, upcoming first
      const sortedPeriods = periods.sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      setUnavailabilityPeriods(sortedPeriods);
    } catch (err) {
      addFlash({ type: 'error', content: 'Failed to load unavailability periods' });
      console.error('Error loading unavailability periods:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setFormErrors({});
    setSelectedPeriod(null);
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

  const calculateDays = (start: string, end: string): number => {
    const timeDiff = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      errors.endDate = 'End date must be after start date';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      await contractorUnavailabilityService.create({
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || undefined
      });
      setIsCreateDialogOpen(false);
      resetForm();
      await loadData();
      addFlash({ type: 'success', content: 'Unavailability period added successfully' });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data) {
        const errorData = err.response.data;
        if (errorData.detail) {
          addFlash({ type: 'error', content: errorData.detail });
        } else if (errorData.non_field_errors) {
          addFlash({ type: 'error', content: errorData.non_field_errors[0] || 'Validation error' });
        } else {
          addFlash({ type: 'error', content: 'This period overlaps with an existing unavailability period' });
        }
      } else {
        addFlash({ type: 'error', content: 'Failed to add unavailability period' });
      }
      console.error('Error creating unavailability:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedPeriod || !validateForm()) return;
    try {
      setSubmitting(true);
      await contractorUnavailabilityService.update(selectedPeriod.id, {
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || undefined
      });
      setIsEditDialogOpen(false);
      resetForm();
      await loadData();
      addFlash({ type: 'success', content: 'Unavailability period updated successfully' });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data) {
        addFlash({ type: 'error', content: 'Validation error. The period may overlap with another existing period.' });
      } else {
        addFlash({ type: 'error', content: 'Failed to update unavailability period' });
      }
      console.error('Error updating unavailability:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPeriod) return;
    try {
      setSubmitting(true);
      await contractorUnavailabilityService.delete(selectedPeriod.id);
      setIsDeleteDialogOpen(false);
      setSelectedPeriod(null);
      await loadData();
      addFlash({ type: 'success', content: 'Unavailability period deleted successfully' });
    } catch (err) {
      addFlash({ type: 'error', content: 'Failed to delete unavailability period' });
      console.error('Error deleting unavailability:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setStartDate(tomorrow.toISOString().split('T')[0]);
    setEndDate(tomorrow.toISOString().split('T')[0]);
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (period: UnavailabilityPeriod) => {
    setSelectedPeriod(period);
    setStartDate(period.start_date);
    setEndDate(period.end_date);
    setReason(period.reason || '');
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (period: UnavailabilityPeriod) => {
    setSelectedPeriod(period);
    setIsDeleteDialogOpen(true);
  };

  // Separate upcoming and past periods
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingPeriods = unavailabilityPeriods.filter(p => new Date(p.end_date) >= today);
  const pastPeriods = unavailabilityPeriods.filter(p => new Date(p.end_date) < today);

  const renderPeriodCard = (period: UnavailabilityPeriod, isPast: boolean = false) => {
    const days = calculateDays(period.start_date, period.end_date);
    return (
      <div
        key={period.id}
        className={`bg-white rounded-lg border ${isPast ? 'border-gray-200 opacity-70' : 'border-gray-200'} p-4 ${!isPast ? 'border-l-4 border-l-purple-500' : ''}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg className={`w-5 h-5 ${isPast ? 'text-gray-400' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`font-semibold ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>
              {formatDate(period.start_date)} - {formatDate(period.end_date)}
            </span>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${isPast ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-700'}`}>
            {days} day{days !== 1 ? 's' : ''}
          </span>
        </div>

        {period.reason && (
          <p className={`text-sm mb-3 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
            "{period.reason}"
          </p>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => openEditDialog(period)}
            className="px-3 h-8 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => openDeleteDialog(period)}
            className="px-3 h-8 text-xs font-medium text-red-600 bg-white border border-gray-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  // Form dialog content
  const renderFormDialog = (isOpen: boolean, onClose: () => void, onSubmit: () => void, title: string, submitLabel: string) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full animate-scale-in">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">Mark dates when you're not available for shifts.</p>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {formErrors.startDate && <p className="text-red-500 text-xs mt-1">{formErrors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={endDate}
                min={startDate || new Date().toISOString().split('T')[0]}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {formErrors.endDate && <p className="text-red-500 text-xs mt-1">{formErrors.endDate}</p>}
            </div>

            {startDate && endDate && new Date(startDate) <= new Date(endDate) && (
              <div className="bg-purple-50 rounded-lg p-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-purple-700 font-medium">
                  {calculateDays(startDate, endDate)} day{calculateDays(startDate, endDate) !== 1 ? 's' : ''} unavailable
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Personal commitment, vacation, etc."
                rows={3}
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 text-right mt-1">{reason.length}/200</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
            <button
              onClick={onClose}
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
    <div className={className}>
      <SpaceBetween size="l">
        {/* Header */}
        <Header
          variant="h1"
          description="Mark the dates when you're not available for shifts. This helps scheduling avoid assigning you during these periods."
          actions={
            <button
              onClick={openCreateDialog}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Add Unavailability Period
            </button>
          }
        >
          My Availability
        </Header>

        <Flashbar items={flashItems} onDismiss={removeFlash} />

        {/* Info Banner */}
        <Alert type="info">
          <strong>How it works:</strong> When you mark yourself as unavailable, you won't be assigned shifts during those dates.
          This is purely informational for scheduling - no approval is needed.
        </Alert>

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading your availability...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Upcoming Periods */}
            <div>
              <p className="font-semibold text-gray-700 uppercase tracking-wide text-xs mb-3">
                Upcoming Unavailability ({upcomingPeriods.length})
              </p>
              {upcomingPeriods.length > 0 ? (
                <div className="space-y-3">
                  {upcomingPeriods.map(period => renderPeriodCard(period, false))}
                </div>
              ) : (
                <EmptyState
                  title="No Upcoming Unavailability"
                  description="You haven't marked any upcoming unavailable dates. Click the button above to add a period."
                  icon={
                    <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                />
              )}
            </div>

            {/* Past Periods */}
            {pastPeriods.length > 0 && (
              <ExpandableSection header={`Past Unavailability (${pastPeriods.length})`} defaultExpanded={false}>
                <div className="space-y-3">
                  {pastPeriods.map(period => renderPeriodCard(period, true))}
                </div>
              </ExpandableSection>
            )}
          </>
        )}

        {/* Create Dialog */}
        {renderFormDialog(isCreateDialogOpen, () => setIsCreateDialogOpen(false), handleCreate, 'Add Unavailability Period', 'Add Period')}

        {/* Edit Dialog */}
        {renderFormDialog(isEditDialogOpen, () => setIsEditDialogOpen(false), handleEdit, 'Edit Unavailability Period', 'Update Period')}

        {/* Delete Confirmation */}
        <ConfirmationModal
          visible={isDeleteDialogOpen}
          header="Delete Unavailability Period"
          confirmLabel={submitting ? 'Deleting...' : 'Delete'}
          variant="destructive"
          onConfirm={handleDelete}
          onCancel={() => { setIsDeleteDialogOpen(false); setSelectedPeriod(null); }}
          loading={submitting}
        >
          {selectedPeriod && (
            <p>
              Are you sure you want to delete the unavailability period from{' '}
              <strong>{formatDate(selectedPeriod.start_date)}</strong> to{' '}
              <strong>{formatDate(selectedPeriod.end_date)}</strong>? This action cannot be undone.
            </p>
          )}
        </ConfirmationModal>
      </SpaceBetween>
    </div>
  );
};

export default ContractorUnavailability;
