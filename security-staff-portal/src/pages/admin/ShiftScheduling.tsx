import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Dialog,
  DialogType,
  IconButton,
  DetailsList,
  SelectionMode,
  IColumn,
  ComboBox,
  IComboBoxOption,
  DatePicker,
  Label,
  Dropdown,
  type IDropdownOption,
  TextField,
  Toggle,
  DetailsRow,
  IDetailsRowProps,
  Checkbox,
  mergeStyleSets,
  CommandBar,
  type ICommandBarItemProps,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Calendar,
  DayOfWeek,
  addMonths,
  type ICalendarProps,
  Pivot,
  PivotItem,
  ICheckboxProps
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService } from '../../services';
import type { Venue, User } from '../../types';
import { UserRole } from '../../types';

// Mock data - replace with actual API calls
const mockVenues: Venue[] = [
  { id: 1, name: 'Downtown Club', address: '123 Main St', isActive: true },
  { id: 2, name: 'Riverside Bar', address: '456 Water St', isActive: true },
  { id: 3, name: 'Westside Security', address: '789 West Ave', isActive: true },
];

const mockStaff: User[] = [
  { id: 1, username: 'staff1', email: 'staff1@example.com', firstName: 'John', lastName: 'Doe', role: UserRole.STAFF, isActive: true },
  { id: 2, username: 'staff2', email: 'staff2@example.com', firstName: 'Jane', lastName: 'Smith', role: UserRole.STAFF, isActive: true },
  { id: 3, username: 'staff3', email: 'staff3@example.com', firstName: 'Mike', lastName: 'Johnson', role: UserRole.STAFF, isActive: true },
];

interface ScheduleShift {
  id: number;
  staffId: number | null;
  staffName: string | null;
  venueId: number;
  venueName: string;
  date: Date;
  startTime: string;
  endTime: string;
  isPublished: boolean;
  isRecurring: boolean;
  recurringDays?: number[];
  recurringEndDate?: Date;
}

// Add interface for bulk scheduling
interface BulkShiftDetails {
  venueId: number | null;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  selectedStaff: number[];
  isSequential: boolean; // If true, assign each staff to different days; if false, all staff to all days
}

const styles = mergeStyleSets({
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '1px',
    backgroundColor: '#f0f0f0',
    padding: '1px',
    marginTop: '10px'
  },
  dayHeader: {
    padding: '8px',
    textAlign: 'center',
    fontWeight: 600,
    backgroundColor: '#f8f8f8',
  },
  dayCell: {
    padding: '8px',
    backgroundColor: 'white',
    minHeight: '100px',
    position: 'relative',
    cursor: 'pointer',
  },
  dateLabel: {
    position: 'absolute',
    top: '5px',
    right: '8px',
    fontSize: '14px',
    color: '#666',
  },
  shift: {
    margin: '2px 0',
    padding: '4px 8px',
    borderRadius: '3px',
    fontSize: '12px',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  staffShift: {
    backgroundColor: '#e1f5fe',
    border: '1px solid #b3e5fc',
  },
  openShift: {
    backgroundColor: '#f1f8e9',
    border: '1px solid #dcedc8',
  },
  filterBar: {
    padding: '10px 0',
  }
});

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const recurringOptions: IDropdownOption[] = [
  { key: '0', text: 'No recurrence' },
  { key: '1', text: 'Daily' },
  { key: '2', text: 'Weekly' },
  { key: '3', text: 'Bi-weekly' },
  { key: '4', text: 'Monthly' }
];

const ShiftScheduling: React.FC = () => {
  const { authState } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [venues, setVenues] = useState<Venue[]>(mockVenues); // Replace with API call
  const [staff, setStaff] = useState<User[]>(mockStaff); // Replace with API call
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<ScheduleShift | null>(null);

  // Dialog states
  const [isNewShiftDialogOpen, setIsNewShiftDialogOpen] = useState<boolean>(false);
  const [isEditShiftDialogOpen, setIsEditShiftDialogOpen] = useState<boolean>(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState<boolean>(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);

  // Bulk scheduling states
  const [isBulkShiftDialogOpen, setIsBulkShiftDialogOpen] = useState<boolean>(false);
  const [bulkShiftDetails, setBulkShiftDetails] = useState<BulkShiftDetails>({
    venueId: null,
    startDate: null,
    endDate: null,
    startTime: '20:00',
    endTime: '04:00',
    daysOfWeek: [],
    selectedStaff: [],
    isSequential: false
  });

  // Copy shifts states
  const [isCopyShiftsDialogOpen, setIsCopyShiftsDialogOpen] = useState<boolean>(false);
  const [sourceMonth, setSourceMonth] = useState<Date | null>(null);
  const [targetMonth, setTargetMonth] = useState<Date | null>(null);

  // Form states
  const [newShiftDate, setNewShiftDate] = useState<Date | null>(null);
  const [newShiftVenue, setNewShiftVenue] = useState<number | null>(null);
  const [newShiftStaff, setNewShiftStaff] = useState<number | null>(null);
  const [newShiftStartTime, setNewShiftStartTime] = useState<string>('');
  const [newShiftEndTime, setNewShiftEndTime] = useState<string>('');
  const [isShiftRecurring, setIsShiftRecurring] = useState<boolean>(false);
  const [recurringType, setRecurringType] = useState<string>('0');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);

  // Filter states
  const [venueFilter, setVenueFilter] = useState<number | null>(null);
  const [staffFilter, setStaffFilter] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);

  // Month picker states
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState<Date>(new Date());

  // Initialize calendar and load data
  useEffect(() => {
    generateCalendarDays(currentDate);
    loadShifts();
  }, [currentDate]);

  // Helper to generate days for the current month view
  const generateCalendarDays = (date: Date) => {
    const days: Date[] = [];
    const year = date.getFullYear();
    const month = date.getMonth();

    // Get the first day of the month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();

    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = lastDay.getDate();

    // Add days from previous month to fill the first row
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }

    // Add all days from current month
    for (let i = 1; i <= lastDate; i++) {
      days.push(new Date(year, month, i));
    }

    // Add days from next month to complete the last row
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        days.push(new Date(year, month + 1, i));
      }
    }

    setCalendarDays(days);
  };

  // Load shifts - replace with actual API call
  const loadShifts = () => {
    setIsLoading(true);
    setError(null);

    // Mock data for demonstration
    const mockShifts: ScheduleShift[] = [
      {
        id: 1,
        staffId: 1,
        staffName: 'John Doe',
        venueId: 1,
        venueName: 'Downtown Club',
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15),
        startTime: '20:00',
        endTime: '04:00',
        isPublished: true,
        isRecurring: false
      },
      {
        id: 2,
        staffId: null,
        staffName: null,
        venueId: 2,
        venueName: 'Riverside Bar',
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 16),
        startTime: '18:00',
        endTime: '02:00',
        isPublished: true,
        isRecurring: true,
        recurringDays: [5, 6], // Friday and Saturday
        recurringEndDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 16)
      },
      {
        id: 3,
        staffId: 2,
        staffName: 'Jane Smith',
        venueId: 3,
        venueName: 'Westside Security',
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 17),
        startTime: '22:00',
        endTime: '06:00',
        isPublished: false,
        isRecurring: false
      }
    ];

    setTimeout(() => {
      setShifts(mockShifts);
      setIsLoading(false);
    }, 500);
  };

  // Filter shifts for a specific day
  const getShiftsForDay = (date: Date) => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate.getDate() === date.getDate() &&
             shiftDate.getMonth() === date.getMonth() &&
             shiftDate.getFullYear() === date.getFullYear();
    });
  };

  // Handle opening a new shift dialog
  const handleNewShift = (date: Date) => {
    setNewShiftDate(date);
    setNewShiftVenue(null);
    setNewShiftStaff(null);
    setNewShiftStartTime('20:00');
    setNewShiftEndTime('04:00');
    setIsShiftRecurring(false);
    setRecurringType('0');
    setRecurringDays([]);
    setRecurringEndDate(null);
    setIsNewShiftDialogOpen(true);
  };

  // Handle creating a new shift
  const handleCreateShift = () => {
    if (!newShiftDate || !newShiftVenue || !newShiftStartTime || !newShiftEndTime) {
      setError('Please fill in all required fields');
      return;
    }

    const newShift: ScheduleShift = {
      id: shifts.length + 1, // Would be assigned by API
      staffId: newShiftStaff,
      staffName: newShiftStaff
        ? `${staff.find(s => s.id === newShiftStaff)?.firstName} ${staff.find(s => s.id === newShiftStaff)?.lastName}`
        : null,
      venueId: newShiftVenue,
      venueName: venues.find(v => v.id === newShiftVenue)?.name || '',
      date: newShiftDate,
      startTime: newShiftStartTime,
      endTime: newShiftEndTime,
      isPublished: false,
      isRecurring: isShiftRecurring,
      recurringDays: isShiftRecurring ? recurringDays : undefined,
      recurringEndDate: isShiftRecurring ? recurringEndDate || undefined : undefined
    };

    setShifts([...shifts, newShift]);
    setIsNewShiftDialogOpen(false);
    setError(null);
  };

  // Handle editing a shift
  const handleEditShift = (shift: ScheduleShift) => {
    setSelectedShift(shift);
    setNewShiftDate(new Date(shift.date));
    setNewShiftVenue(shift.venueId);
    setNewShiftStaff(shift.staffId);
    setNewShiftStartTime(shift.startTime);
    setNewShiftEndTime(shift.endTime);
    setIsShiftRecurring(shift.isRecurring);
    setRecurringDays(shift.recurringDays || []);
    setRecurringEndDate(shift.recurringEndDate || null);
    setIsEditShiftDialogOpen(true);
  };

  // Handle updating a shift
  const handleUpdateShift = () => {
    if (!selectedShift) return;

    const updatedShifts = shifts.map(shift => {
      if (shift.id === selectedShift.id) {
        return {
          ...shift,
          staffId: newShiftStaff,
          staffName: newShiftStaff
            ? `${staff.find(s => s.id === newShiftStaff)?.firstName} ${staff.find(s => s.id === newShiftStaff)?.lastName}`
            : null,
          venueId: newShiftVenue || 0,
          venueName: venues.find(v => v.id === newShiftVenue)?.name || '',
          date: newShiftDate || new Date(),
          startTime: newShiftStartTime,
          endTime: newShiftEndTime,
          isRecurring: isShiftRecurring,
          recurringDays: isShiftRecurring ? recurringDays : undefined,
          recurringEndDate: isShiftRecurring ? recurringEndDate || undefined : undefined
        };
      }
      return shift;
    });

    setShifts(updatedShifts);
    setIsEditShiftDialogOpen(false);
  };

  // Handle deleting a shift
  const handleDeleteShift = () => {
    if (!selectedShift) return;

    const updatedShifts = shifts.filter(shift => shift.id !== selectedShift.id);
    setShifts(updatedShifts);
    setIsConfirmDialogOpen(false);
    setIsEditShiftDialogOpen(false);
  };

  // Handle publishing shifts
  const handlePublishShifts = () => {
    const updatedShifts = shifts.map(shift => ({
      ...shift,
      isPublished: true
    }));
    setShifts(updatedShifts);
  };

  // Handle creating a schedule template
  const handleCreateTemplate = () => {
    // Implementation for saving the current schedule as a template
    alert('Template saved successfully');
    setIsTemplateDialogOpen(false);
  };

  // Handle bulk shift dialog
  const handleOpenBulkShiftDialog = () => {
    // Reset form
    setBulkShiftDetails({
      venueId: null,
      startDate: new Date(),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), // Last day of current month
      startTime: '20:00',
      endTime: '04:00',
      daysOfWeek: [],
      selectedStaff: [],
      isSequential: false
    });
    setIsBulkShiftDialogOpen(true);
  };

  // Handle creating bulk shifts
  const handleCreateBulkShifts = () => {
    const {
      venueId,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek,
      selectedStaff,
      isSequential
    } = bulkShiftDetails;

    if (!venueId || !startDate || !endDate || !startTime || !endTime || daysOfWeek.length === 0 || selectedStaff.length === 0) {
      setError('Please fill in all required fields and select at least one day and one staff member.');
      return;
    }

    // Create new shifts based on the bulk criteria
    const newShifts: ScheduleShift[] = [];
    let nextShiftId = shifts.length + 1;
    const selectedVenue = venues.find(v => v.id === venueId);

    // Calculate all dates within the range that match the selected days of week
    const allDates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      if (daysOfWeek.includes(currentDate.getDay())) {
        allDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (isSequential && selectedStaff.length > 0) {
      // Sequential assignment: each staff member gets assigned to different days in rotation
      let staffIndex = 0;

      for (const date of allDates) {
        const staffId = selectedStaff[staffIndex % selectedStaff.length];
        const staffMember = staff.find(s => s.id === staffId);

        newShifts.push({
          id: nextShiftId++,
          staffId,
          staffName: staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : null,
          venueId,
          venueName: selectedVenue?.name || '',
          date,
          startTime,
          endTime,
          isPublished: false,
          isRecurring: false
        });

        staffIndex++;
      }
    } else {
      // All staff to all days: create a shift for each staff member for each date
      for (const date of allDates) {
        for (const staffId of selectedStaff) {
          const staffMember = staff.find(s => s.id === staffId);

          newShifts.push({
            id: nextShiftId++,
            staffId,
            staffName: staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : null,
            venueId,
            venueName: selectedVenue?.name || '',
            date,
            startTime,
            endTime,
            isPublished: false,
            isRecurring: false
          });
        }
      }
    }

    // Add new shifts to the existing ones
    setShifts([...shifts, ...newShifts]);
    setIsBulkShiftDialogOpen(false);
    setError(null);
  };

  // Handle updating bulk shift details
  const updateBulkShiftDetails = (field: keyof BulkShiftDetails, value: any) => {
    setBulkShiftDetails({
      ...bulkShiftDetails,
      [field]: value
    });
  };

  // Handle day of week selection for bulk scheduling
  const handleDayOfWeekToggle = (dayIndex: number, checked?: boolean) => {
    if (checked === undefined) return;

    const updatedDays = [...bulkShiftDetails.daysOfWeek];

    if (checked) {
      if (!updatedDays.includes(dayIndex)) {
        updatedDays.push(dayIndex);
      }
    } else {
      const index = updatedDays.indexOf(dayIndex);
      if (index > -1) {
        updatedDays.splice(index, 1);
      }
    }

    updateBulkShiftDetails('daysOfWeek', updatedDays);
  };

  // Handle staff selection for bulk scheduling
  const handleStaffToggle = (staffId: number, checked?: boolean) => {
    if (checked === undefined) return;

    const updatedStaff = [...bulkShiftDetails.selectedStaff];

    if (checked) {
      if (!updatedStaff.includes(staffId)) {
        updatedStaff.push(staffId);
      }
    } else {
      const index = updatedStaff.indexOf(staffId);
      if (index > -1) {
        updatedStaff.splice(index, 1);
      }
    }

    updateBulkShiftDetails('selectedStaff', updatedStaff);
  };

  // Handle opening copy shifts dialog
  const handleOpenCopyShiftsDialog = () => {
    setSourceMonth(currentDate);
    setTargetMonth(null);
    setIsCopyShiftsDialogOpen(true);
  };

  // Handle copying shifts between months
  const handleCopyShifts = () => {
    if (!sourceMonth || !targetMonth) {
      setError('Please select both source and target months.');
      return;
    }

    // Find all shifts in the source month
    const sourceMonthShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate.getMonth() === sourceMonth.getMonth() &&
             shiftDate.getFullYear() === sourceMonth.getFullYear();
    });

    if (sourceMonthShifts.length === 0) {
      setError('No shifts found in the source month to copy.');
      return;
    }

    // Create new shifts for the target month with the same pattern
    const newShifts: ScheduleShift[] = [];
    let nextShiftId = shifts.length + 1;

    for (const shift of sourceMonthShifts) {
      const sourceDate = new Date(shift.date);

      // Create a new date in the target month with the same day
      const targetDate = new Date(
        targetMonth.getFullYear(),
        targetMonth.getMonth(),
        sourceDate.getDate()
      );

      // Skip if the day doesn't exist in the target month (e.g., Feb 30)
      if (targetDate.getMonth() !== targetMonth.getMonth()) continue;

      newShifts.push({
        ...shift,
        id: nextShiftId++,
        date: targetDate,
        isPublished: false // Reset published status for the copied shifts
      });
    }

    // Add new shifts to the existing ones
    setShifts([...shifts, ...newShifts]);
    setIsCopyShiftsDialogOpen(false);
    setError(null);

    // Navigate to the target month to show the copied shifts
    setCurrentDate(targetMonth);
  };

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'newShift',
      text: 'New Shift',
      iconProps: { iconName: 'Add' },
      onClick: () => handleNewShift(new Date())
    },
    {
      key: 'bulkCreateShifts',
      text: 'Bulk Create',
      iconProps: { iconName: 'CalendarAgenda' },
      onClick: handleOpenBulkShiftDialog
    },
    {
      key: 'copyShifts',
      text: 'Copy Shifts',
      iconProps: { iconName: 'Copy' },
      onClick: handleOpenCopyShiftsDialog
    },
    {
      key: 'publishShifts',
      text: 'Publish Schedule',
      iconProps: { iconName: 'PublishContent' },
      onClick: handlePublishShifts
    },
    {
      key: 'saveAsTemplate',
      text: 'Save as Template',
      iconProps: { iconName: 'Save' },
      onClick: () => setIsTemplateDialogOpen(true)
    },
    {
      key: 'filter',
      text: 'Filter',
      iconProps: { iconName: 'Filter' },
      subMenuProps: {
        items: [
          {
            key: 'filterVenue',
            text: 'By Venue',
            onClick: () => {}
          },
          {
            key: 'filterStaff',
            text: 'By Staff',
            onClick: () => {}
          },
          {
            key: 'clearFilters',
            text: 'Clear Filters',
            onClick: () => {
              setVenueFilter(null);
              setStaffFilter(null);
            }
          }
        ]
      }
    }
  ];

  // Navigation controls for calendar
  const handlePrevMonth = () => {
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    setCurrentDate(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentDate(nextMonth);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generate months for dropdown
  const generateMonthOptions = (): IDropdownOption[] => {
    const options: IDropdownOption[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();

    // Generate options for 24 months (2 years) - past, current, and future
    for (let monthOffset = -6; monthOffset < 18; monthOffset++) {
      const date = new Date();
      date.setMonth(date.getMonth() + monthOffset);
      const monthName = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();

      options.push({
        key: `${year}-${date.getMonth()}`,
        text: `${monthName} ${year}`,
        data: { date }
      });
    }

    return options;
  };

  // Handle month selection from dropdown
  const handleMonthSelection = (option: IDropdownOption | undefined) => {
    if (option && option.data) {
      const { date } = option.data as { date: Date };
      setCurrentDate(date);
      setIsMonthPickerOpen(false);
    }
  };

  // Handle month picker dialog
  const handleOpenMonthPicker = () => {
    setSelectedMonthYear(currentDate);
    setIsMonthPickerOpen(true);
  };

  const handleMonthPickerSelect = () => {
    setCurrentDate(selectedMonthYear);
    setIsMonthPickerOpen(false);
  };

  // Render recurring options in the form
  const renderRecurringOptions = () => {
    if (!isShiftRecurring) return null;

    return (
      <Stack tokens={{ childrenGap: 10 }}>
        <Dropdown
          label="Recurrence Pattern"
          options={recurringOptions}
          selectedKey={recurringType}
          onChange={(_, option) => option && setRecurringType(option.key as string)}
        />

        {recurringType === '1' || recurringType === '2' ? (
          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <Label>Repeat on</Label>
            {daysOfWeek.map((day) => (
              <Checkbox
                key={day}
                label={day.substring(0, 3)}
                checked={recurringDays.includes(daysOfWeek.indexOf(day))}
                onChange={(_, checked) => {
                  if (checked === undefined) return;
                  const index = daysOfWeek.indexOf(day);
                  if (checked) {
                    setRecurringDays([...recurringDays, index]);
                  } else {
                    setRecurringDays(recurringDays.filter(d => d !== index));
                  }
                }}
              />
            ))}
          </Stack>
        ) : null}

        <DatePicker
          label="End Date"
          value={recurringEndDate || undefined}
          minDate={newShiftDate || undefined}
          onSelectDate={(date: Date | null | undefined) => {
            if (date) {
              setRecurringEndDate(date);
            }
          }}
        />
      </Stack>
    );
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Shift Scheduling</Text>
          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <DefaultButton text="Previous" onClick={handlePrevMonth} iconProps={{ iconName: 'ChevronLeft' }} />
            <DefaultButton text="Today" onClick={handleToday} />
            <DefaultButton
              text="Select Month"
              onClick={handleOpenMonthPicker}
              iconProps={{ iconName: 'Calendar' }}
              split
              menuProps={{
                items: generateMonthOptions().map(option => ({
                  key: option.key as string,
                  text: option.text as string,
                  onClick: () => handleMonthSelection(option)
                }))
              }}
            />
            <DefaultButton text="Next" onClick={handleNextMonth} iconProps={{ iconName: 'ChevronRight' }} />
          </Stack>
        </Stack>

        <Text variant="xLarge">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>

        {error && (
          <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
            {error}
          </MessageBar>
        )}

        <CommandBar items={commandBarItems} />

        <Stack horizontal className={styles.filterBar} tokens={{ childrenGap: 10 }}>
          <ComboBox
            label="Venue Filter"
            placeholder="Select Venue"
            options={venues.map(venue => ({ key: venue.id, text: venue.name }))}
            selectedKey={venueFilter}
            onChange={(_, option) => setVenueFilter(option ? Number(option.key) : null)}
          />
          <ComboBox
            label="Staff Filter"
            placeholder="Select Staff"
            options={staff.map(s => ({ key: s.id, text: `${s.firstName} ${s.lastName}` }))}
            selectedKey={staffFilter}
            onChange={(_, option) => setStaffFilter(option ? Number(option.key) : null)}
          />
        </Stack>

        {isLoading ? (
          <Spinner size={SpinnerSize.large} label="Loading schedule..." />
        ) : (
          <div className={styles.calendarGrid}>
            {daysOfWeek.map((day) => (
              <div key={`header-${day}`} className={styles.dayHeader}>
                {day}
              </div>
            ))}

            {calendarDays.map((day) => (
              <div
                key={`day-${day.toISOString()}`}
                className={styles.dayCell}
                style={{
                  opacity: day.getMonth() !== currentDate.getMonth() ? 0.5 : 1,
                  backgroundColor: day.toDateString() === new Date().toDateString() ? '#e6f7ff' : 'white'
                }}
                onClick={() => handleNewShift(day)}
              >
                <div className={styles.dateLabel}>{day.getDate()}</div>

                {getShiftsForDay(day).map(shift => (
                  <div
                    key={`shift-${shift.id}`}
                    className={`${styles.shift} ${shift.staffId ? styles.staffShift : styles.openShift}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditShift(shift);
                    }}
                  >
                    <div>{shift.venueName}</div>
                    <div>{shift.startTime} - {shift.endTime}</div>
                    <div>{shift.staffName || 'Open Shift'}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* New Shift Dialog */}
        <Dialog
          hidden={!isNewShiftDialogOpen}
          onDismiss={() => setIsNewShiftDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Create New Shift'
          }}
          minWidth={600}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            <DatePicker
              label="Date"
              value={newShiftDate || undefined}
              isRequired
              onSelectDate={(date: Date | null | undefined) => {
                if (date) {
                  setNewShiftDate(date);
                }
              }}
            />

            <Dropdown
              label="Venue"
              placeholder="Select venue"
              options={venues.map(venue => ({ key: venue.id, text: venue.name }))}
              selectedKey={newShiftVenue}
              required
              onChange={(_, option) => option && setNewShiftVenue(Number(option.key))}
            />

            <Dropdown
              label="Staff Member"
              placeholder="Select staff (or leave empty for open shift)"
              options={[
                { key: 'open', text: 'Open Shift (No Staff Assigned)' },
                ...staff.map(s => ({ key: s.id, text: `${s.firstName} ${s.lastName}` }))
              ]}
              selectedKey={newShiftStaff || 'open'}
              onChange={(_, option) => {
                if (option) {
                  setNewShiftStaff(option.key === 'open' ? null : Number(option.key));
                }
              }}
            />

            <Stack horizontal tokens={{ childrenGap: 10 }}>
              <TextField
                label="Start Time"
                type="time"
                value={newShiftStartTime}
                required
                onChange={(_, value) => setNewShiftStartTime(value || '')}
                styles={{ root: { width: '50%' } }}
              />
              <TextField
                label="End Time"
                type="time"
                value={newShiftEndTime}
                required
                onChange={(_, value) => setNewShiftEndTime(value || '')}
                styles={{ root: { width: '50%' } }}
              />
            </Stack>

            <Toggle
              label="Recurring Shift"
              checked={isShiftRecurring}
              onChange={(_, checked) => checked !== undefined && setIsShiftRecurring(checked)}
            />

            {renderRecurringOptions()}
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsNewShiftDialogOpen(false)} />
            <PrimaryButton text="Create Shift" onClick={handleCreateShift} />
          </Stack>
        </Dialog>

        {/* Edit Shift Dialog */}
        <Dialog
          hidden={!isEditShiftDialogOpen}
          onDismiss={() => setIsEditShiftDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Edit Shift'
          }}
          minWidth={600}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            <DatePicker
              label="Date"
              value={newShiftDate || undefined}
              isRequired
              onSelectDate={(date: Date | null | undefined) => {
                if (date) {
                  setNewShiftDate(date);
                }
              }}
            />

            <Dropdown
              label="Venue"
              placeholder="Select venue"
              options={venues.map(venue => ({ key: venue.id, text: venue.name }))}
              selectedKey={newShiftVenue}
              required
              onChange={(_, option) => option && setNewShiftVenue(Number(option.key))}
            />

            <Dropdown
              label="Staff Member"
              placeholder="Select staff (or leave empty for open shift)"
              options={[
                { key: 'open', text: 'Open Shift (No Staff Assigned)' },
                ...staff.map(s => ({ key: s.id, text: `${s.firstName} ${s.lastName}` }))
              ]}
              selectedKey={newShiftStaff || 'open'}
              onChange={(_, option) => {
                if (option) {
                  setNewShiftStaff(option.key === 'open' ? null : Number(option.key));
                }
              }}
            />

            <Stack horizontal tokens={{ childrenGap: 10 }}>
              <TextField
                label="Start Time"
                type="time"
                value={newShiftStartTime}
                required
                onChange={(_, value) => setNewShiftStartTime(value || '')}
                styles={{ root: { width: '50%' } }}
              />
              <TextField
                label="End Time"
                type="time"
                value={newShiftEndTime}
                required
                onChange={(_, value) => setNewShiftEndTime(value || '')}
                styles={{ root: { width: '50%' } }}
              />
            </Stack>

            <Toggle
              label="Recurring Shift"
              checked={isShiftRecurring}
              onChange={(_, checked) => checked !== undefined && setIsShiftRecurring(checked)}
            />

            {renderRecurringOptions()}
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton
              text="Delete"
              iconProps={{ iconName: 'Delete' }}
              onClick={() => setIsConfirmDialogOpen(true)}
            />
            <DefaultButton text="Cancel" onClick={() => setIsEditShiftDialogOpen(false)} />
            <PrimaryButton text="Update Shift" onClick={handleUpdateShift} />
          </Stack>
        </Dialog>

        {/* Confirm Delete Dialog */}
        <Dialog
          hidden={!isConfirmDialogOpen}
          onDismiss={() => setIsConfirmDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Confirm Delete',
            subText: 'Are you sure you want to delete this shift? This action cannot be undone.'
          }}
        >
          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }}>
            <DefaultButton text="Cancel" onClick={() => setIsConfirmDialogOpen(false)} />
            <PrimaryButton text="Delete" onClick={handleDeleteShift} />
          </Stack>
        </Dialog>

        {/* Template Dialog */}
        <Dialog
          hidden={!isTemplateDialogOpen}
          onDismiss={() => setIsTemplateDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Save Schedule as Template'
          }}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            <TextField
              label="Template Name"
              placeholder="Enter a name for this template"
              required
            />
            <TextField
              label="Description"
              placeholder="Enter a description (optional)"
              multiline
              rows={3}
            />
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsTemplateDialogOpen(false)} />
            <PrimaryButton text="Save Template" onClick={handleCreateTemplate} />
          </Stack>
        </Dialog>

        {/* Month Picker Dialog */}
        <Dialog
          hidden={!isMonthPickerOpen}
          onDismiss={() => setIsMonthPickerOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Select Month for Scheduling'
          }}
        >
          <Calendar
            onSelectDate={(date: Date | null | undefined) => {
              if (date) {
                // Just take the month and year, reset to 1st day
                const newDate = new Date(date.getFullYear(), date.getMonth(), 1);
                setSelectedMonthYear(newDate);
              }
            }}
            value={selectedMonthYear}
            isMonthPickerVisible={true}
            showMonthPickerAsOverlay={false}
            highlightSelectedMonth={true}
            isDayPickerVisible={false}
            showGoToToday={true}
          />
          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsMonthPickerOpen(false)} />
            <PrimaryButton text="Select" onClick={handleMonthPickerSelect} />
          </Stack>
        </Dialog>

        {/* Bulk Shift Creation Dialog */}
        <Dialog
          hidden={!isBulkShiftDialogOpen}
          onDismiss={() => setIsBulkShiftDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Bulk Create Shifts'
          }}
          minWidth={700}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            <Text>Create multiple shifts at once by selecting date range, staff, and other details.</Text>

            <Dropdown
              label="Venue"
              placeholder="Select venue"
              options={venues.map(venue => ({ key: venue.id, text: venue.name }))}
              selectedKey={bulkShiftDetails.venueId}
              required
              onChange={(_, option) => option && updateBulkShiftDetails('venueId', Number(option.key))}
            />

            <Stack horizontal tokens={{ childrenGap: 10 }}>
              <DatePicker
                label="Start Date"
                value={bulkShiftDetails.startDate || undefined}
                isRequired
                onSelectDate={(date) => date && updateBulkShiftDetails('startDate', date)}
                styles={{ root: { width: '50%' } }}
              />
              <DatePicker
                label="End Date"
                value={bulkShiftDetails.endDate || undefined}
                isRequired
                minDate={bulkShiftDetails.startDate || undefined}
                onSelectDate={(date) => date && updateBulkShiftDetails('endDate', date)}
                styles={{ root: { width: '50%' } }}
              />
            </Stack>

            <Stack horizontal tokens={{ childrenGap: 10 }}>
              <TextField
                label="Start Time"
                type="time"
                value={bulkShiftDetails.startTime}
                required
                onChange={(_, value) => value && updateBulkShiftDetails('startTime', value)}
                styles={{ root: { width: '50%' } }}
              />
              <TextField
                label="End Time"
                type="time"
                value={bulkShiftDetails.endTime}
                required
                onChange={(_, value) => value && updateBulkShiftDetails('endTime', value)}
                styles={{ root: { width: '50%' } }}
              />
            </Stack>

            <Label required>Select Days of Week</Label>
            <Stack horizontal wrap tokens={{ childrenGap: 10 }}>
              {daysOfWeek.map((day, index) => (
                <Checkbox
                  key={day}
                  label={day}
                  checked={bulkShiftDetails.daysOfWeek.includes(index)}
                  onChange={(_, checked) => handleDayOfWeekToggle(index, checked)}
                  styles={{ root: { marginRight: 12 } }}
                />
              ))}
            </Stack>

            <Pivot>
              <PivotItem headerText="Select Staff">
                <Stack tokens={{ childrenGap: 10, padding: 10 }}>
                  <Label required>Select Staff Members</Label>
                  <Stack className="staff-selection-container" styles={{ root: { maxHeight: 200, overflowY: 'auto', padding: 10, border: '1px solid #eee' }}}>
                    {staff.map((staffMember) => (
                      <Checkbox
                        key={staffMember.id}
                        label={`${staffMember.firstName} ${staffMember.lastName}`}
                        checked={bulkShiftDetails.selectedStaff.includes(staffMember.id)}
                        onChange={(_, checked) => handleStaffToggle(staffMember.id, checked)}
                        styles={{ root: { marginBottom: 8 } }}
                      />
                    ))}
                  </Stack>

                  <Toggle
                    label="Sequential Assignment"
                    inlineLabel
                    checked={bulkShiftDetails.isSequential}
                    onChange={(_, checked) => checked !== undefined && updateBulkShiftDetails('isSequential', checked)}
                  />
                  <Text styles={{ root: { fontSize: 12, color: '#666' } }}>
                    {bulkShiftDetails.isSequential
                      ? "Staff will be assigned sequentially to different days (rotation)."
                      : "Each staff member will be assigned to all selected days."}
                  </Text>
                </Stack>
              </PivotItem>
              <PivotItem headerText="Preview">
                <Stack tokens={{ padding: 10 }}>
                  <Text variant="medium">Scheduled Days: {bulkShiftDetails.daysOfWeek.map(d => daysOfWeek[d]).join(", ")}</Text>
                  <Text variant="medium">Staff Members: {bulkShiftDetails.selectedStaff.length}</Text>
                  <Text variant="medium">
                    {bulkShiftDetails.isSequential
                      ? `Creating approximately ${Math.min(bulkShiftDetails.selectedStaff.length, bulkShiftDetails.daysOfWeek.length)} shifts per week`
                      : `Creating approximately ${bulkShiftDetails.selectedStaff.length * bulkShiftDetails.daysOfWeek.length} shifts per week`}
                  </Text>
                </Stack>
              </PivotItem>
            </Pivot>
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsBulkShiftDialogOpen(false)} />
            <PrimaryButton text="Create Shifts" onClick={handleCreateBulkShifts} />
          </Stack>
        </Dialog>

        {/* Copy Shifts Dialog */}
        <Dialog
          hidden={!isCopyShiftsDialogOpen}
          onDismiss={() => setIsCopyShiftsDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Copy Monthly Schedule'
          }}
          minWidth={500}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            <Text>
              Copy the entire shift schedule from one month to another.
              This will create new shifts in the target month with the same staff assignments, venues, and times.
            </Text>

            <Stack horizontal tokens={{ childrenGap: 20 }} horizontalAlign="space-between">
              <Stack styles={{ root: { width: '45%' } }}>
                <Label>Source Month</Label>
                <Calendar
                  onSelectDate={(date) => date && setSourceMonth(new Date(date.getFullYear(), date.getMonth(), 1))}
                  value={sourceMonth || undefined}
                  isMonthPickerVisible={true}
                  showMonthPickerAsOverlay={false}
                  highlightSelectedMonth={true}
                  isDayPickerVisible={false}
                  showGoToToday={false}
                />
                {sourceMonth && (
                  <Text variant="medium" styles={{ root: { marginTop: 8 } }}>
                    Selected: {sourceMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </Text>
                )}
              </Stack>

              <Stack styles={{ root: { width: '45%' } }}>
                <Label>Target Month</Label>
                <Calendar
                  onSelectDate={(date) => date && setTargetMonth(new Date(date.getFullYear(), date.getMonth(), 1))}
                  value={targetMonth || undefined}
                  isMonthPickerVisible={true}
                  showMonthPickerAsOverlay={false}
                  highlightSelectedMonth={true}
                  isDayPickerVisible={false}
                  showGoToToday={false}
                />
                {targetMonth && (
                  <Text variant="medium" styles={{ root: { marginTop: 8 } }}>
                    Selected: {targetMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </Text>
                )}
              </Stack>
            </Stack>

            {sourceMonth && targetMonth && sourceMonth.getTime() === targetMonth.getTime() && (
              <MessageBar messageBarType={MessageBarType.warning}>
                Source and target months are the same. Please select different months.
              </MessageBar>
            )}
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsCopyShiftsDialogOpen(false)} />
            <PrimaryButton
              text="Copy Shifts"
              onClick={handleCopyShifts}
              disabled={!sourceMonth || !targetMonth || (sourceMonth.getTime() === targetMonth.getTime())}
            />
          </Stack>
        </Dialog>

      </Stack>
    </MainLayout>
  );
};

export default ShiftScheduling;
