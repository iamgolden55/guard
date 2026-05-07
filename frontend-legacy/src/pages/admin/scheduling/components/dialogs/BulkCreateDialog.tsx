import React, { useState } from 'react';
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
  Stack,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  type IComboBoxOption
} from '@fluentui/react';
import type { Venue, StaffProfile } from '../../../../../types';
import { THEME, DAYS_OF_WEEK_FULL } from '../../types';

interface BulkCreateDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSubmit: (data: BulkCreateFormData) => Promise<void>;
  venues: Venue[];
  staff: StaffProfile[];
  isLoading?: boolean;
  error?: string | null;
}

export interface BulkCreateFormData {
  venueId: number;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  selectedStaff: number[];
  isSequential: boolean;
}

export const BulkCreateDialog: React.FC<BulkCreateDialogProps> = ({
  isOpen,
  onDismiss,
  onSubmit,
  venues,
  staff,
  isLoading = false,
  error = null
}) => {
  // Form state
  const [venueId, setVenueId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('04:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<number[]>([]);
  const [isSequential, setIsSequential] = useState(false);

  const resetForm = () => {
    setVenueId(null);
    setStartDate(null);
    setEndDate(null);
    setStartTime('20:00');
    setEndTime('04:00');
    setDaysOfWeek([]);
    setSelectedStaff([]);
    setIsSequential(false);
  };

  const handleDismiss = () => {
    resetForm();
    onDismiss();
  };

  // Venue options
  const venueOptions: IComboBoxOption[] = venues.map((venue) => ({
    key: venue.id?.toString() || '',
    text: venue.name
  }));

  const toggleDay = (dayIndex: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const toggleStaff = (staffId: number) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((s) => s !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSubmit = async () => {
    if (!venueId || !startDate || !endDate) return;

    const formData: BulkCreateFormData = {
      venueId,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek,
      selectedStaff,
      isSequential
    };

    await onSubmit(formData);
  };

  // Calculate shift count preview
  const calculateShiftCount = () => {
    if (!startDate || !endDate || daysOfWeek.length === 0) return 0;

    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      if (daysOfWeek.includes(current.getDay())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    if (selectedStaff.length > 0 && !isSequential) {
      count *= selectedStaff.length;
    }

    return count;
  };

  const shiftCount = calculateShiftCount();

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={handleDismiss}
      dialogContentProps={{
        type: DialogType.normal,
        title: 'Bulk Create Shifts',
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
            maxWidth: '550px',
            minWidth: '450px'
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

        {/* Date range */}
        <Stack horizontal tokens={{ childrenGap: 16 }}>
          <DatePicker
            label="Start Date"
            value={startDate || undefined}
            onSelectDate={(d) => setStartDate(d || null)}
            isRequired
            placeholder="Select start"
            styles={{ root: { flex: 1 } }}
          />
          <DatePicker
            label="End Date"
            value={endDate || undefined}
            onSelectDate={(d) => setEndDate(d || null)}
            isRequired
            placeholder="Select end"
            minDate={startDate || undefined}
            styles={{ root: { flex: 1 } }}
          />
        </Stack>

        {/* Time range */}
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

        {/* Days of week */}
        <div>
          <Label required>Days of Week</Label>
          <Stack horizontal wrap tokens={{ childrenGap: 8 }}>
            {DAYS_OF_WEEK_FULL.map((day, index) => (
              <Checkbox
                key={day}
                label={day.slice(0, 3)}
                checked={daysOfWeek.includes(index)}
                onChange={() => toggleDay(index)}
                styles={{
                  root: {
                    padding: '8px 12px',
                    backgroundColor: daysOfWeek.includes(index)
                      ? THEME.primaryLight
                      : THEME.bg.secondary,
                    borderRadius: '6px'
                  }
                }}
              />
            ))}
          </Stack>
        </div>

        {/* Staff selection */}
        <div>
          <Label>Staff Members (Optional)</Label>
          <div
            style={{
              maxHeight: '150px',
              overflowY: 'auto',
              border: `1px solid ${THEME.border.default}`,
              borderRadius: '6px',
              padding: '8px'
            }}
          >
            {staff.map((s) => (
              <Checkbox
                key={s.id}
                label={`${s.firstName} ${s.lastName}`}
                checked={selectedStaff.includes(s.id || 0)}
                onChange={() => toggleStaff(s.id || 0)}
                styles={{ root: { marginBottom: '4px' } }}
              />
            ))}
          </div>
        </div>

        {/* Assignment mode */}
        {selectedStaff.length > 1 && (
          <Toggle
            label="Assignment Mode"
            onText="Sequential (rotate staff through shifts)"
            offText="Parallel (all staff on every shift)"
            checked={isSequential}
            onChange={(_, checked) => setIsSequential(checked || false)}
          />
        )}

        {/* Preview */}
        {shiftCount > 0 && (
          <MessageBar messageBarType={MessageBarType.info}>
            This will create <strong>{shiftCount}</strong> shift
            {shiftCount !== 1 ? 's' : ''}
            {selectedStaff.length > 0 && (
              <>
                {' '}
                for {selectedStaff.length} staff member
                {selectedStaff.length !== 1 ? 's' : ''}
                {isSequential && ' (rotating)'}
              </>
            )}
          </MessageBar>
        )}
      </Stack>

      <DialogFooter>
        <DefaultButton onClick={handleDismiss} text="Cancel" />
        <PrimaryButton
          onClick={handleSubmit}
          text={`Create ${shiftCount} Shift${shiftCount !== 1 ? 's' : ''}`}
          disabled={
            !venueId ||
            !startDate ||
            !endDate ||
            daysOfWeek.length === 0 ||
            isLoading
          }
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

export default BulkCreateDialog;
