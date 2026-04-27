import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  DatePicker,
  ComboBox,
  TextField,
  Toggle,
  Checkbox,
  Label,
  Dropdown,
  type IDropdownOption,
  type IComboBoxOption,
  Stack,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import type { Venue, StaffProfile } from '../../../../../types';
import { THEME, RECURRING_OPTIONS, DAYS_OF_WEEK_FULL } from '../../types';

interface CreateShiftDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSubmit: (data: CreateShiftFormData) => Promise<void>;
  venues: Venue[];
  staff: StaffProfile[];
  initialDate?: Date | null;
  defaultStaticRate?: string;
  defaultStandardRate?: string;
  isLoading?: boolean;
  error?: string | null;
}

export interface CreateShiftFormData {
  date: Date;
  venueId: number;
  staffId: number | null;
  multiStaff: number[];
  isMultiStaffMode: boolean;
  startTime: string;
  endTime: string;
  notes: string;
  payRateType: 'static' | 'standard' | 'custom';
  customPayRate: string;
  requiresFire: boolean;
  requiresCapacity: boolean;
  requiresToilet: boolean;
  isRecurring: boolean;
  recurringType: string;
  recurringDays: number[];
  recurringEndDate: Date | null;
}

export const CreateShiftDialog: React.FC<CreateShiftDialogProps> = ({
  isOpen,
  onDismiss,
  onSubmit,
  venues,
  staff,
  initialDate,
  defaultStaticRate = '15.50',
  defaultStandardRate = '18.00',
  isLoading = false,
  error = null
}) => {
  // Form state
  const [date, setDate] = useState<Date | null>(initialDate || null);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [multiStaff, setMultiStaff] = useState<number[]>([]);
  const [isMultiStaffMode, setIsMultiStaffMode] = useState(false);
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('04:00');
  const [notes, setNotes] = useState('');
  const [payRateType, setPayRateType] = useState<'static' | 'standard' | 'custom'>('static');
  const [customPayRate, setCustomPayRate] = useState('');
  const [requiresFire, setRequiresFire] = useState(false);
  const [requiresCapacity, setRequiresCapacity] = useState(false);
  const [requiresToilet, setRequiresToilet] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('0');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);

  // Reset form when dialog opens with new date
  useEffect(() => {
    if (isOpen && initialDate) {
      setDate(initialDate);
      resetForm();
    }
  }, [isOpen, initialDate]);

  const resetForm = () => {
    setVenueId(null);
    setStaffId(null);
    setMultiStaff([]);
    setIsMultiStaffMode(false);
    setStartTime('20:00');
    setEndTime('04:00');
    setNotes('');
    setPayRateType('static');
    setCustomPayRate('');
    setRequiresFire(false);
    setRequiresCapacity(false);
    setRequiresToilet(false);
    setIsRecurring(false);
    setRecurringType('0');
    setRecurringDays([]);
    setRecurringEndDate(null);
  };

  // Options for dropdowns
  const venueOptions: IComboBoxOption[] = venues.map((venue) => ({
    key: venue.id?.toString() || '',
    text: venue.name
  }));

  const staffOptions: IComboBoxOption[] = [
    { key: '', text: 'No staff (Open Shift)' },
    ...staff.map((s) => ({
      key: s.id?.toString() || '',
      text: `${s.firstName} ${s.lastName}`
    }))
  ];

  const payRateOptions: IDropdownOption[] = [
    { key: 'static', text: `Static Rate (${defaultStaticRate}/hr)` },
    { key: 'standard', text: `Standard Rate (${defaultStandardRate}/hr)` },
    { key: 'custom', text: 'Custom Rate' }
  ];

  const handleSubmit = async () => {
    if (!date || !venueId) return;

    const formData: CreateShiftFormData = {
      date,
      venueId,
      staffId: isMultiStaffMode ? null : staffId,
      multiStaff: isMultiStaffMode ? multiStaff : [],
      isMultiStaffMode,
      startTime,
      endTime,
      notes,
      payRateType,
      customPayRate,
      requiresFire,
      requiresCapacity,
      requiresToilet,
      isRecurring,
      recurringType,
      recurringDays,
      recurringEndDate
    };

    await onSubmit(formData);
  };

  const toggleRecurringDay = (dayIndex: number) => {
    setRecurringDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const toggleMultiStaff = (staffId: number) => {
    setMultiStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((s) => s !== staffId)
        : [...prev, staffId]
    );
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={{
        type: DialogType.normal,
        title: 'Create New Shift',
        styles: {
          title: {
            color: THEME.text.primary,
            fontWeight: 600
          }
        }
      }}
      modalProps={{
        isBlocking: true,
        styles: {
          main: {
            maxWidth: '500px',
            minWidth: '400px'
          }
        }
      }}
    >
      <Stack tokens={{ childrenGap: 16 }}>
        {error && (
          <MessageBar messageBarType={MessageBarType.error}>
            {error}
          </MessageBar>
        )}

        {/* Date picker */}
        <DatePicker
          label="Date"
          value={date || undefined}
          onSelectDate={(d) => setDate(d || null)}
          isRequired
          placeholder="Select date"
        />

        {/* Venue selection */}
        <ComboBox
          label="Venue"
          options={venueOptions}
          selectedKey={venueId?.toString() || ''}
          onChange={(_, option) =>
            setVenueId(option ? parseInt(option.key as string) : null)
          }
          required
          placeholder="Select venue"
        />

        {/* Multi-staff toggle */}
        <Toggle
          label="Multiple Staff"
          checked={isMultiStaffMode}
          onChange={(_, checked) => setIsMultiStaffMode(checked || false)}
          inlineLabel
        />

        {/* Staff selection */}
        {!isMultiStaffMode ? (
          <ComboBox
            label="Staff Member"
            options={staffOptions}
            selectedKey={staffId?.toString() || ''}
            onChange={(_, option) =>
              setStaffId(option?.key ? parseInt(option.key as string) : null)
            }
            placeholder="Select staff (optional for open shift)"
          />
        ) : (
          <div>
            <Label>Select Staff Members</Label>
            <div
              style={{
                maxHeight: '150px',
                overflowY: 'auto',
                border: `1px solid ${THEME.border.default}`,
                borderRadius: '4px',
                padding: '8px'
              }}
            >
              {staff.map((s) => (
                <Checkbox
                  key={s.id}
                  label={`${s.firstName} ${s.lastName}`}
                  checked={multiStaff.includes(s.id || 0)}
                  onChange={() => toggleMultiStaff(s.id || 0)}
                  styles={{ root: { marginBottom: '4px' } }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Time inputs */}
        <Stack horizontal tokens={{ childrenGap: 16 }}>
          <TextField
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(_, value) => setStartTime(value || '')}
            required
            styles={{ root: { flex: 1 } }}
          />
          <TextField
            label="End Time"
            type="time"
            value={endTime}
            onChange={(_, value) => setEndTime(value || '')}
            required
            styles={{ root: { flex: 1 } }}
          />
        </Stack>

        {/* Recurring shift toggle */}
        <Toggle
          label="Recurring Shift"
          checked={isRecurring}
          onChange={(_, checked) => setIsRecurring(checked || false)}
          inlineLabel
        />

        {/* Recurring options */}
        {isRecurring && (
          <Stack tokens={{ childrenGap: 12 }}>
            <Dropdown
              label="Recurrence Pattern"
              selectedKey={recurringType}
              options={RECURRING_OPTIONS.map((o) => ({
                key: o.key,
                text: o.text
              }))}
              onChange={(_, option) =>
                setRecurringType((option?.key as string) || '0')
              }
            />

            {recurringType !== '0' && (
              <>
                <Label>Days of Week</Label>
                <Stack horizontal wrap tokens={{ childrenGap: 8 }}>
                  {DAYS_OF_WEEK_FULL.map((day, index) => (
                    <Checkbox
                      key={day}
                      label={day.slice(0, 3)}
                      checked={recurringDays.includes(index)}
                      onChange={() => toggleRecurringDay(index)}
                    />
                  ))}
                </Stack>

                <DatePicker
                  label="Recurrence End Date"
                  value={recurringEndDate || undefined}
                  onSelectDate={(d) => setRecurringEndDate(d || null)}
                  placeholder="Select end date"
                />
              </>
            )}
          </Stack>
        )}

        {/* Security checks */}
        <div>
          <Label>Security Requirements</Label>
          <Stack horizontal tokens={{ childrenGap: 16 }}>
            <Checkbox
              label="Fire Exit"
              checked={requiresFire}
              onChange={(_, checked) => setRequiresFire(checked || false)}
            />
            <Checkbox
              label="Capacity"
              checked={requiresCapacity}
              onChange={(_, checked) => setRequiresCapacity(checked || false)}
            />
            <Checkbox
              label="Toilet"
              checked={requiresToilet}
              onChange={(_, checked) => setRequiresToilet(checked || false)}
            />
          </Stack>
        </div>

        {/* Pay rate */}
        <Dropdown
          label="Pay Rate"
          selectedKey={payRateType}
          options={payRateOptions}
          onChange={(_, option) =>
            setPayRateType((option?.key as 'static' | 'standard' | 'custom') || 'static')
          }
        />

        {payRateType === 'custom' && (
          <TextField
            label="Custom Hourly Rate"
            type="number"
            prefix="$"
            value={customPayRate}
            onChange={(_, value) => setCustomPayRate(value || '')}
            placeholder="Enter rate"
          />
        )}

        {/* Notes */}
        <TextField
          label="Notes"
          multiline
          rows={3}
          value={notes}
          onChange={(_, value) => setNotes(value || '')}
          placeholder="Optional notes for this shift"
        />
      </Stack>

      <DialogFooter>
        <DefaultButton onClick={onDismiss} text="Cancel" />
        <PrimaryButton
          onClick={handleSubmit}
          text="Create Shift"
          disabled={!date || !venueId || isLoading}
          styles={{
            root: {
              backgroundColor: THEME.primary,
              borderColor: THEME.primary,
              ':hover': {
                backgroundColor: THEME.primaryHover,
                borderColor: THEME.primaryHover
              }
            }
          }}
        >
          {isLoading && (
            <Spinner
              size={SpinnerSize.xSmall}
              styles={{ root: { marginRight: '8px' } }}
            />
          )}
        </PrimaryButton>
      </DialogFooter>
    </Dialog>
  );
};

export default CreateShiftDialog;
