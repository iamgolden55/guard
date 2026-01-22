import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Dialog,
  DialogFooter,
  DialogContent,
  TextField,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  DatePicker,
  DayOfWeek,
  IDatePickerStrings,
  Icon
} from '@fluentui/react';
import {
  contractorUnavailabilityService,
  ContractorUnavailability as UnavailabilityPeriod
} from '../../services/contractorUnavailabilityService';

interface ContractorUnavailabilityProps {
  className?: string;
}

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

const ContractorUnavailability: React.FC<ContractorUnavailabilityProps> = ({ className }) => {
  const [unavailabilityPeriods, setUnavailabilityPeriods] = useState<UnavailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<UnavailabilityPeriod | null>(null);

  // Form states
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
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
      setError('Failed to load unavailability periods');
      console.error('Error loading unavailability periods:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const resetForm = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('');
    setFormErrors({});
    setSelectedPeriod(null);
  };

  const formatDateForAPI = (date: Date): string => {
    return date.toISOString().split('T')[0];
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

  const calculateDays = (start: Date, end: Date): number => {
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!startDate) {
      errors.startDate = 'Start date is required';
    }

    if (!endDate) {
      errors.endDate = 'End date is required';
    }

    if (startDate && endDate && startDate > endDate) {
      errors.endDate = 'End date must be after start date';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm() || !startDate || !endDate) return;

    try {
      setSubmitting(true);
      await contractorUnavailabilityService.create({
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        reason: reason.trim() || undefined
      });
      setIsCreateDialogOpen(false);
      resetForm();
      await loadData();
      showSuccess('Unavailability period added successfully');
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data) {
        const errorData = err.response.data;
        if (errorData.detail) {
          setError(errorData.detail);
        } else if (errorData.non_field_errors) {
          setError(errorData.non_field_errors[0] || 'Validation error');
        } else {
          setError('This period overlaps with an existing unavailability period');
        }
      } else {
        setError('Failed to add unavailability period');
      }
      console.error('Error creating unavailability:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedPeriod || !validateForm() || !startDate || !endDate) return;

    try {
      setSubmitting(true);
      await contractorUnavailabilityService.update(selectedPeriod.id, {
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        reason: reason.trim() || undefined
      });
      setIsEditDialogOpen(false);
      resetForm();
      await loadData();
      showSuccess('Unavailability period updated successfully');
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data) {
        setError('Validation error. The period may overlap with another existing period.');
      } else {
        setError('Failed to update unavailability period');
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
      showSuccess('Unavailability period deleted successfully');
    } catch (err) {
      setError('Failed to delete unavailability period');
      console.error('Error deleting unavailability:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setStartDate(tomorrow);
    setEndDate(tomorrow);
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (period: UnavailabilityPeriod) => {
    setSelectedPeriod(period);
    setStartDate(new Date(period.start_date));
    setEndDate(new Date(period.end_date));
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
    const days = calculateDays(new Date(period.start_date), new Date(period.end_date));

    return (
      <div
        key={period.id}
        className={`bg-white rounded-lg border ${isPast ? 'border-gray-200 opacity-70' : 'border-gray-200'} p-4 mb-3 ${!isPast ? 'border-l-4 border-l-purple-500' : ''}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon
              iconName="Calendar"
              className={isPast ? 'text-gray-400' : 'text-purple-600'}
              style={{ fontSize: '18px' }}
            />
            <Text variant="medium" className={`font-semibold ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>
              {formatDate(period.start_date)} - {formatDate(period.end_date)}
            </Text>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              isPast ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-700'
            }`}
          >
            {days} day{days !== 1 ? 's' : ''}
          </span>
        </div>

        {period.reason && (
          <Text variant="small" className={`block mb-3 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
            "{period.reason}"
          </Text>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <DefaultButton
            text="Edit"
            iconProps={{ iconName: 'Edit' }}
            onClick={() => openEditDialog(period)}
            styles={{ root: { minWidth: 'auto' } }}
          />
          <DefaultButton
            text="Delete"
            iconProps={{ iconName: 'Delete' }}
            onClick={() => openDeleteDialog(period)}
            styles={{ root: { minWidth: 'auto', color: '#d13438' } }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      <Stack tokens={{ childrenGap: 20 }}>
        {/* Header */}
        <div>
          <Text variant="xLarge" className="font-bold text-gray-900 block">
            My Availability
          </Text>
          <Text variant="medium" className="text-gray-600 block mt-1">
            Mark the dates when you're not available for shifts. This helps scheduling avoid assigning you during these periods.
          </Text>
        </div>

        {/* Info Banner */}
        <MessageBar messageBarType={MessageBarType.info}>
          <strong>How it works:</strong> When you mark yourself as unavailable, you won't be assigned shifts during those dates.
          This is purely informational for scheduling - no approval is needed.
        </MessageBar>

        {/* Error/Success Messages */}
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

        {/* Add Button */}
        <div>
          <PrimaryButton
            text="Add Unavailability Period"
            iconProps={{ iconName: 'Add' }}
            onClick={openCreateDialog}
            styles={{
              root: {
                backgroundColor: '#8764b8',
                borderColor: '#8764b8'
              },
              rootHovered: {
                backgroundColor: '#7356a5',
                borderColor: '#7356a5'
              }
            }}
          />
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading your availability..." size={SpinnerSize.large} />
          </div>
        ) : (
          <>
            {/* Upcoming Periods */}
            <div>
              <Text variant="medium" className="font-semibold text-gray-700 uppercase tracking-wide text-xs block mb-3">
                Upcoming Unavailability ({upcomingPeriods.length})
              </Text>

              {upcomingPeriods.length > 0 ? (
                upcomingPeriods.map(period => renderPeriodCard(period, false))
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Icon
                    iconName="Calendar"
                    className="text-gray-300"
                    style={{ fontSize: '48px' }}
                  />
                  <Text variant="large" className="block font-semibold text-gray-700 mt-4">
                    No Upcoming Unavailability
                  </Text>
                  <Text variant="medium" className="block text-gray-500 mt-2">
                    You haven't marked any upcoming unavailable dates.
                    <br />
                    Click the button above to add a period.
                  </Text>
                </div>
              )}
            </div>

            {/* Past Periods (Collapsible) */}
            {pastPeriods.length > 0 && (
              <div className="mt-6">
                <Text variant="medium" className="font-semibold text-gray-500 uppercase tracking-wide text-xs block mb-3">
                  Past Unavailability ({pastPeriods.length})
                </Text>
                {pastPeriods.map(period => renderPeriodCard(period, true))}
              </div>
            )}
          </>
        )}

        {/* Create Dialog */}
        <Dialog
          hidden={!isCreateDialogOpen}
          onDismiss={() => setIsCreateDialogOpen(false)}
          dialogContentProps={{
            type: 'largeHeader' as any,
            title: 'Add Unavailability Period',
            subText: 'Mark dates when you\'re not available for shifts.'
          }}
          minWidth={450}
        >
          <DialogContent>
            <Stack tokens={{ childrenGap: 16 }}>
              <DatePicker
                label="Start Date"
                firstDayOfWeek={DayOfWeek.Monday}
                strings={datePickerStrings}
                value={startDate}
                minDate={new Date()}
                onSelectDate={(date) => {
                  if (date) {
                    setStartDate(date);
                    // If end date is before start date, reset it
                    if (endDate && date > endDate) {
                      setEndDate(date);
                    }
                  }
                }}
                isRequired
              />
              {formErrors.startDate && (
                <Text variant="small" style={{ color: '#d13438' }}>{formErrors.startDate}</Text>
              )}

              <DatePicker
                label="End Date"
                firstDayOfWeek={DayOfWeek.Monday}
                strings={datePickerStrings}
                value={endDate}
                minDate={startDate || new Date()}
                onSelectDate={(date) => {
                  if (date) {
                    setEndDate(date);
                  }
                }}
                isRequired
              />
              {formErrors.endDate && (
                <Text variant="small" style={{ color: '#d13438' }}>{formErrors.endDate}</Text>
              )}

              {/* Days Preview */}
              {startDate && endDate && startDate <= endDate && (
                <div className="bg-purple-50 rounded-lg p-3 flex items-center gap-2">
                  <Icon iconName="Clock" className="text-purple-600" />
                  <Text variant="medium" className="text-purple-700 font-medium">
                    {calculateDays(startDate, endDate)} day{calculateDays(startDate, endDate) !== 1 ? 's' : ''} unavailable
                  </Text>
                </div>
              )}

              <TextField
                label="Reason (Optional)"
                value={reason}
                onChange={(_, newValue) => setReason(newValue || '')}
                placeholder="e.g., Personal commitment, vacation, etc."
                multiline
                rows={3}
                maxLength={200}
              />
              <Text variant="small" className="text-gray-500 text-right">
                {reason.length}/200
              </Text>
            </Stack>
          </DialogContent>
          <DialogFooter>
            <PrimaryButton
              text={submitting ? 'Adding...' : 'Add Period'}
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
            type: 'largeHeader' as any,
            title: 'Edit Unavailability Period',
            subText: 'Update the dates or reason for this period.'
          }}
          minWidth={450}
        >
          <DialogContent>
            <Stack tokens={{ childrenGap: 16 }}>
              <DatePicker
                label="Start Date"
                firstDayOfWeek={DayOfWeek.Monday}
                strings={datePickerStrings}
                value={startDate}
                onSelectDate={(date) => {
                  if (date) {
                    setStartDate(date);
                    if (endDate && date > endDate) {
                      setEndDate(date);
                    }
                  }
                }}
                isRequired
              />
              {formErrors.startDate && (
                <Text variant="small" style={{ color: '#d13438' }}>{formErrors.startDate}</Text>
              )}

              <DatePicker
                label="End Date"
                firstDayOfWeek={DayOfWeek.Monday}
                strings={datePickerStrings}
                value={endDate}
                minDate={startDate}
                onSelectDate={(date) => {
                  if (date) {
                    setEndDate(date);
                  }
                }}
                isRequired
              />
              {formErrors.endDate && (
                <Text variant="small" style={{ color: '#d13438' }}>{formErrors.endDate}</Text>
              )}

              {startDate && endDate && startDate <= endDate && (
                <div className="bg-purple-50 rounded-lg p-3 flex items-center gap-2">
                  <Icon iconName="Clock" className="text-purple-600" />
                  <Text variant="medium" className="text-purple-700 font-medium">
                    {calculateDays(startDate, endDate)} day{calculateDays(startDate, endDate) !== 1 ? 's' : ''} unavailable
                  </Text>
                </div>
              )}

              <TextField
                label="Reason (Optional)"
                value={reason}
                onChange={(_, newValue) => setReason(newValue || '')}
                placeholder="e.g., Personal commitment, vacation, etc."
                multiline
                rows={3}
                maxLength={200}
              />
              <Text variant="small" className="text-gray-500 text-right">
                {reason.length}/200
              </Text>
            </Stack>
          </DialogContent>
          <DialogFooter>
            <PrimaryButton
              text={submitting ? 'Updating...' : 'Update Period'}
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
            type: 'normal' as any,
            title: 'Delete Unavailability Period',
            subText: selectedPeriod
              ? `Are you sure you want to delete the unavailability period from ${formatDate(selectedPeriod.start_date)} to ${formatDate(selectedPeriod.end_date)}? This action cannot be undone.`
              : ''
          }}
        >
          <DialogFooter>
            <PrimaryButton
              text={submitting ? 'Deleting...' : 'Delete'}
              onClick={handleDelete}
              disabled={submitting}
              styles={{
                root: { backgroundColor: '#d13438', borderColor: '#d13438' },
                rootHovered: { backgroundColor: '#a4262c', borderColor: '#a4262c' }
              }}
            />
            <DefaultButton
              text="Cancel"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={submitting}
            />
          </DialogFooter>
        </Dialog>
      </Stack>
    </div>
  );
};

export default ContractorUnavailability;
