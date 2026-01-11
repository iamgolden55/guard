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
  Label,
  Stack,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import type { Venue, StaffProfile } from '../../../../../types';
import type { ScheduleShift } from '../../types';
import { THEME } from '../../types';

interface EditShiftDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSubmit: (shiftId: number, data: EditShiftFormData) => Promise<void>;
  onDelete: (shiftId: number) => Promise<void>;
  shift: ScheduleShift | null;
  venues: Venue[];
  staff: StaffProfile[];
  isLoading?: boolean;
  error?: string | null;
}

export interface EditShiftFormData {
  date: Date;
  venueId: number;
  staffId: number | null;
  startTime: string;
  endTime: string;
  notes: string;
}

export const EditShiftDialog: React.FC<EditShiftDialogProps> = ({
  isOpen,
  onDismiss,
  onSubmit,
  onDelete,
  shift,
  venues,
  staff,
  isLoading = false,
  error = null
}) => {
  // Form state
  const [date, setDate] = useState<Date | null>(null);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Populate form when shift changes
  useEffect(() => {
    if (shift && isOpen) {
      setDate(new Date(shift.date));
      setVenueId(shift.venueId);
      setStaffId(shift.staffId);
      setStartTime(shift.startTime);
      setEndTime(shift.endTime);
      setNotes('');
      setShowDeleteConfirm(false);
    }
  }, [shift, isOpen]);

  // Venue options
  const venueOptions = venues.map((venue) => ({
    key: venue.id?.toString() || '',
    text: venue.name
  }));

  // Staff options
  const staffOptions = [
    { key: '', text: 'No staff (Open Shift)' },
    ...staff.map((s) => ({
      key: s.id?.toString() || '',
      text: `${s.firstName} ${s.lastName}`
    }))
  ];

  const handleSubmit = async () => {
    if (!shift || !date || !venueId) return;

    const formData: EditShiftFormData = {
      date,
      venueId,
      staffId,
      startTime,
      endTime,
      notes
    };

    await onSubmit(shift.id, formData);
  };

  const handleDelete = async () => {
    if (!shift) return;
    await onDelete(shift.id);
    setShowDeleteConfirm(false);
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={{
        type: DialogType.normal,
        title: 'Edit Shift',
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
      {showDeleteConfirm ? (
        <Stack tokens={{ childrenGap: 16 }}>
          <MessageBar messageBarType={MessageBarType.warning}>
            Are you sure you want to delete this shift? This action cannot be undone.
          </MessageBar>

          <div
            style={{
              padding: '16px',
              backgroundColor: THEME.bg.secondary,
              borderRadius: '8px'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>
              {shift?.venueName}
            </div>
            <div style={{ fontSize: '14px', color: THEME.text.secondary }}>
              {shift?.date && new Date(shift.date).toLocaleDateString()}
            </div>
            <div style={{ fontSize: '14px', color: THEME.text.secondary }}>
              {shift?.startTime} - {shift?.endTime}
            </div>
            <div style={{ fontSize: '14px', color: THEME.text.secondary }}>
              {shift?.staffName || 'Open Shift'}
            </div>
          </div>

          <DialogFooter>
            <DefaultButton
              onClick={() => setShowDeleteConfirm(false)}
              text="Cancel"
            />
            <PrimaryButton
              onClick={handleDelete}
              text="Delete Shift"
              disabled={isLoading}
              styles={{
                root: {
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  ':hover': {
                    backgroundColor: '#b91c1c',
                    borderColor: '#b91c1c'
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
        </Stack>
      ) : (
        <>
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

            {/* Staff selection */}
            <ComboBox
              label="Staff Member"
              options={staffOptions}
              selectedKey={staffId?.toString() || ''}
              onChange={(_, option) =>
                setStaffId(option?.key ? parseInt(option.key as string) : null)
              }
              placeholder="Select staff"
            />

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

            {/* Notes */}
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={notes}
              onChange={(_, value) => setNotes(value || '')}
              placeholder="Optional notes"
            />
          </Stack>

          <DialogFooter>
            <DefaultButton
              onClick={() => setShowDeleteConfirm(true)}
              text="Delete"
              styles={{
                root: {
                  color: '#dc2626',
                  borderColor: '#dc2626',
                  ':hover': {
                    backgroundColor: '#fef2f2'
                  }
                }
              }}
            />
            <DefaultButton onClick={onDismiss} text="Cancel" />
            <PrimaryButton
              onClick={handleSubmit}
              text="Update Shift"
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
        </>
      )}
    </Dialog>
  );
};

export default EditShiftDialog;
