import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  Dropdown,
  Stack,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  type IDropdownOption
} from '@fluentui/react';
import type { ScheduleShift } from '../../types';
import { THEME } from '../../types';

interface CopyShiftsDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSubmit: (sourceMonth: Date, targetMonth: Date) => Promise<void>;
  currentDate: Date;
  shifts: ScheduleShift[];
  isLoading?: boolean;
  error?: string | null;
}

export const CopyShiftsDialog: React.FC<CopyShiftsDialogProps> = ({
  isOpen,
  onDismiss,
  onSubmit,
  currentDate,
  shifts,
  isLoading = false,
  error = null
}) => {
  const [sourceMonth, setSourceMonth] = useState<Date | null>(currentDate);
  const [targetMonth, setTargetMonth] = useState<Date | null>(null);

  // Generate month options (12 months back and 12 months forward)
  const monthOptions: IDropdownOption[] = useMemo(() => {
    const options: IDropdownOption[] = [];
    const now = new Date();

    for (let i = -12; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const text = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });

      // Count shifts for this month
      const monthShifts = shifts.filter((s) => {
        const shiftDate = new Date(s.date);
        return (
          shiftDate.getMonth() === date.getMonth() &&
          shiftDate.getFullYear() === date.getFullYear()
        );
      });

      options.push({
        key,
        text: `${text} (${monthShifts.length} shifts)`,
        data: date
      });
    }

    return options;
  }, [shifts]);

  // Get shifts for selected source month
  const sourceMonthShifts = useMemo(() => {
    if (!sourceMonth) return 0;
    return shifts.filter((s) => {
      const shiftDate = new Date(s.date);
      return (
        shiftDate.getMonth() === sourceMonth.getMonth() &&
        shiftDate.getFullYear() === sourceMonth.getFullYear()
      );
    }).length;
  }, [sourceMonth, shifts]);

  const handleSubmit = async () => {
    if (!sourceMonth || !targetMonth) return;
    await onSubmit(sourceMonth, targetMonth);
  };

  const handleDismiss = () => {
    setSourceMonth(currentDate);
    setTargetMonth(null);
    onDismiss();
  };

  // Check if source and target are the same
  const isSameMonth =
    sourceMonth &&
    targetMonth &&
    sourceMonth.getMonth() === targetMonth.getMonth() &&
    sourceMonth.getFullYear() === targetMonth.getFullYear();

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={handleDismiss}
      dialogContentProps={{
        type: DialogType.normal,
        title: 'Copy Shifts',
        subText: 'Copy all shifts from one month to another',
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
            maxWidth: '450px',
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

        {/* Source month */}
        <Dropdown
          label="Copy From"
          selectedKey={
            sourceMonth
              ? `${sourceMonth.getFullYear()}-${sourceMonth.getMonth()}`
              : undefined
          }
          options={monthOptions}
          onChange={(_, option) => {
            if (option?.data) {
              setSourceMonth(option.data as Date);
            }
          }}
          placeholder="Select source month"
          required
        />

        {sourceMonthShifts > 0 && (
          <MessageBar messageBarType={MessageBarType.info}>
            {sourceMonthShifts} shift{sourceMonthShifts !== 1 ? 's' : ''} will
            be copied
          </MessageBar>
        )}

        {sourceMonthShifts === 0 && sourceMonth && (
          <MessageBar messageBarType={MessageBarType.warning}>
            No shifts found in the selected month
          </MessageBar>
        )}

        {/* Target month */}
        <Dropdown
          label="Copy To"
          selectedKey={
            targetMonth
              ? `${targetMonth.getFullYear()}-${targetMonth.getMonth()}`
              : undefined
          }
          options={monthOptions}
          onChange={(_, option) => {
            if (option?.data) {
              setTargetMonth(option.data as Date);
            }
          }}
          placeholder="Select target month"
          required
        />

        {isSameMonth && (
          <MessageBar messageBarType={MessageBarType.error}>
            Source and target months cannot be the same
          </MessageBar>
        )}

        {/* Summary */}
        {sourceMonth && targetMonth && !isSameMonth && sourceMonthShifts > 0 && (
          <div
            style={{
              padding: '16px',
              backgroundColor: THEME.primaryLight,
              borderRadius: '8px',
              border: `1px solid ${THEME.primary}`
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: THEME.text.primary
              }}
            >
              Summary
            </div>
            <div
              style={{
                fontSize: '13px',
                color: THEME.text.secondary,
                marginTop: '8px'
              }}
            >
              Copy{' '}
              <strong>
                {sourceMonthShifts} shift{sourceMonthShifts !== 1 ? 's' : ''}
              </strong>{' '}
              from{' '}
              <strong>
                {sourceMonth.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </strong>{' '}
              to{' '}
              <strong>
                {targetMonth.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </strong>
            </div>
          </div>
        )}
      </Stack>

      <DialogFooter>
        <DefaultButton onClick={handleDismiss} text="Cancel" />
        <PrimaryButton
          onClick={handleSubmit}
          text="Copy Shifts"
          disabled={
            !sourceMonth ||
            !targetMonth ||
            isSameMonth ||
            sourceMonthShifts === 0 ||
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

export default CopyShiftsDialog;
