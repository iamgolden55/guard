import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
import { BulkShiftModal } from '../../components/BulkShiftModal';
import { useAuth } from '../../contexts/AuthContext';
import shiftService from '../../services/shiftService';
import venueService from '../../services/venueService';
import settingsService from '../../services/settingsService';
import type { 
  Venue, 
  StaffProfile,
  ScheduledShift,
  ScheduledShiftStatus,
  RecurringPatternType,
  Shift, // Add Shift import
  ShiftStatus // Add ShiftStatus import
} from '../../types';
import { UserRole } from '../../types';
import { getShifts, bulkCreateShifts, updateShift, deleteShift } from '../../services/api';

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
  shiftGroup?: string | null;
  requiredSecurityRole?: string;
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

// Add CSS for hover effect
const hoverStyles = `
  <style>
    .shift-container:hover .shift-delete-btn {
      opacity: 1 !important;
    }
  </style>
`;

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
  const [venues, setVenues] = useState<Venue[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<ScheduleShift | null>(null);
  const [selectedShifts, setSelectedShifts] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

  // Dialog states
  const [isNewShiftDialogOpen, setIsNewShiftDialogOpen] = useState<boolean>(false);
  const [isEditShiftDialogOpen, setIsEditShiftDialogOpen] = useState<boolean>(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState<boolean>(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  
  // Template states
  const [templateName, setTemplateName] = useState<string>('');
  const [templateDescription, setTemplateDescription] = useState<string>('');

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
  const [isMultiStaffMode, setIsMultiStaffMode] = useState<boolean>(false);
  const [newShiftMultiStaff, setNewShiftMultiStaff] = useState<number[]>([]);
  const [newShiftStartTime, setNewShiftStartTime] = useState<string>('');
  const [newShiftEndTime, setNewShiftEndTime] = useState<string>('');
  const [isShiftRecurring, setIsShiftRecurring] = useState<boolean>(false);
  const [recurringType, setRecurringType] = useState<string>('0');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);
  const [newShiftRequiresFire, setNewShiftRequiresFire] = useState<boolean>(false);
  const [newShiftRequiresCapacity, setNewShiftRequiresCapacity] = useState<boolean>(false);
  const [newShiftRequiresToilet, setNewShiftRequiresToilet] = useState<boolean>(false);
  const [newShiftNotes, setNewShiftNotes] = useState<string>('');
  const [newShiftPayRate, setNewShiftPayRate] = useState<string>('');

  // Filter states
  const [venueFilter, setVenueFilter] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);

  // Month picker states
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState<Date>(new Date());

  // State for fetched system setting rates
  const [fetchedStaticRate, setFetchedStaticRate] = useState<string>('...'); 
  const [fetchedStandardRate, setFetchedStandardRate] = useState<string>('...');
  const [isSettingsLoading, setIsSettingsLoading] = useState<boolean>(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Add to the state:
  const [payRateType, setPayRateType] = useState<'static' | 'standard' | 'custom'>('static');
  const [customPayRate, setCustomPayRate] = useState<string>('');

  // Fetch system settings (including pay rates)
  useEffect(() => {
    const loadSystemSettings = async () => {
      setIsSettingsLoading(true);
      setSettingsError(null);
      try {
        const settingsData = await settingsService.getSettings();
        setFetchedStaticRate(settingsData.default_hourly_rate.toString());
        setFetchedStandardRate(settingsData.special_event_pay_rate.toString());
      } catch (err) {
        console.error("Failed to load system settings:", err);
        setSettingsError("Could not load default pay rates.");
        // Set default values as fallback
        setFetchedStaticRate('15.50'); 
        setFetchedStandardRate('18.00');
      } finally {
        setIsSettingsLoading(false);
      }
    };
    loadSystemSettings();
  }, []); // Run once on mount

  // Load venues and staff data
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load venues
        const venuesData = await venueService.getAllVenues();
        // Ensure venuesData is an array and map it to include isActive
        const mappedVenues = (Array.isArray(venuesData) ? venuesData : []).map(venue => ({
          ...venue,
          id: venue.id ?? 0, // Provide default for potentially undefined id
          isActive: true // Add default isActive property
        }));
        setVenues(mappedVenues);
        
        // Load staff profiles
        const staffData = await shiftService.getStaffProfiles();
        // Ensure staffData is an array before setting state
        if (!staffData || !Array.isArray(staffData)) {
          console.error('Staff data is not an array:', staffData);
          setStaff([]);
          setError('Failed to load staff profiles correctly. Please try refreshing the page.');
        } else {
          setStaff(staffData);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError('Failed to load venues and staff data. Please try refreshing the page.');
        // Ensure state is reset to empty arrays on error
        setVenues([]);
        setStaff([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, []);

  // Load shifts for the current month view
  const loadShifts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("Fetching shifts with filters:", { venueFilter, staffFilter });
      
      // Use the updated getShifts function
      const filteredShiftsFromApi = await getShifts({
        venueId: venueFilter,
        staffId: staffFilter
      });
      
      console.log("Raw API response:", filteredShiftsFromApi);
      
      // Map the API response to ScheduleShift type
      const mappedShifts = filteredShiftsFromApi.map((shift: any) => {
        // Extract date from start_time for calendar display
        const startDate = new Date(shift.start_time);
        const endDate = new Date(shift.end_time);
        
        
        return {
          id: shift.id,
          venueId: shift.venue,
          venueName: shift.venue_details?.name || 'Unknown Venue',
          staffId: shift.staff_user || null,
          staffName: shift.staff_details ? `${shift.staff_details.first_name} ${shift.staff_details.last_name}` : null,
          date: startDate,
          startTime: startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          isPublished: true, // Assume scheduled shifts are published
          isRecurring: false,
          status: shift.status,
          shiftGroup: shift.shift_group || null,
          requiredSecurityRole: shift.required_security_role || 'sg'
        };
      });
      
      console.log("Loaded and mapped shifts:", mappedShifts.length, mappedShifts);
      setShifts(mappedShifts);
    } catch (err) {
      console.error('Error loading shifts:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while loading shifts');
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, [venueFilter, staffFilter]);

  // Initialize calendar when date changes
  useEffect(() => {
    try {
      generateCalendarDays(currentDate);
    } catch (error) {
      console.error("Error initializing calendar:", error);
      setError("Failed to initialize calendar. Please try refreshing the page.");
    }
  }, [currentDate]);

  // Load shifts when component mounts and when filters change
  useEffect(() => {
    loadShifts();
  }, [loadShifts]);
  
  // Also reload shifts when calendar days are ready (fallback)
  useEffect(() => {
    if (calendarDays.length > 0) {
      console.log('Calendar days ready, ensuring shifts are loaded');
      loadShifts();
    }
  }, [calendarDays, loadShifts]);

  // Helper to generate days for the current month view
  const generateCalendarDays = (date: Date) => {
    try {
      const days: Date[] = [];
      const year = date.getFullYear();
      const month = date.getMonth();

      console.log(`Generating calendar days for ${year}-${month + 1}`);

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

      console.log(`Generated ${days.length} calendar days`);
      setCalendarDays(days);
    } catch (error) {
      console.error("Error generating calendar days:", error);
      // Set a minimal fallback calendar
      const today = new Date();
      const days = [today];
      setCalendarDays(days);
    }
  };

  // Venues and staff are loaded in the useEffect above, no need for separate functions

  // Get shifts in the same group as the selected shift
  const getGroupShifts = (shiftGroup: string | null) => {
    if (!shiftGroup) return [];
    return shifts.filter(shift => shift.shiftGroup === shiftGroup);
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

  // Handle closing the new shift dialog
  const handleCloseNewShiftDialog = () => {
    setIsNewShiftDialogOpen(false);
    resetNewShiftForm();
  };

  // Reset new shift form values
  const resetNewShiftForm = () => {
    setNewShiftDate(null);
    setNewShiftVenue(null);
    setNewShiftStaff(null);
    setIsMultiStaffMode(false);
    setNewShiftMultiStaff([]);
    setNewShiftStartTime('');
    setNewShiftEndTime('');
    setNewShiftNotes('');
    setNewShiftPayRate('');
    setNewShiftRequiresFire(false);
    setNewShiftRequiresCapacity(false);
    setNewShiftRequiresToilet(false);
    setIsShiftRecurring(false);
    setRecurringType('0');
    setRecurringDays([]);
    setRecurringEndDate(null);
  };

  // Create multi-staff shifts
  const createMultiStaffShifts = async (
    venue: number,
    staffUsers: number[],
    startTime: string,
    endTime: string,
    notes?: string,
    hourlyRate?: number | null,
    isSpecialEvent?: boolean
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/shifts/create_multi_staff/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          venue,
          staff_users: staffUsers,
          start_time: startTime,
          end_time: endTime,
          status: 'scheduled',
          required_security_role: 'sg',
          notes: notes || '',
          hourly_rate: hourlyRate,
          is_special_event: isSpecialEvent || false
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Multi-staff shift creation failed:', response.status, errorData);
        
        // Handle validation errors
        if (response.status === 400) {
          const errorMessage = errorData.detail || Object.values(errorData).join(', ');
          throw new Error(errorMessage);
        }
        
        throw new Error(`Failed to create shifts: ${response.status} - ${errorData.detail || 'Unknown error'}`);
      }
      
      const result = await response.json();
      console.log('Multi-staff shifts created successfully:', result);
      return true;
    } catch (err) {
      console.error('Error creating multi-staff shifts:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while creating the shifts');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Create a single shift
  const createShift = async (shiftData: Partial<Shift>): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/shifts/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(shiftData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Shift creation failed:', response.status, errorData);
        
        // Handle duplicate shift errors specifically
        if (response.status === 400 && errorData.non_field_errors) {
          const duplicateError = errorData.non_field_errors.find((error: string) => 
            error.includes('shift already exists')
          );
          if (duplicateError) {
            throw new Error(duplicateError);
          }
        }
        
        throw new Error(`Failed to create shift: ${response.status} - ${errorData.detail || 'Unknown error'}`);
      }
      
      // Successfully created shift
      return true;
    } catch (err) {
      console.error('Error creating shift:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while creating the shift');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new shift form submission
  const handleNewShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!newShiftDate || !newShiftVenue || !newShiftStartTime || !newShiftEndTime) {
      setError('Please fill out all required fields: date, venue, start time, and end time');
      return;
    }
    
    // Validate staff selection based on mode
    if (isMultiStaffMode) {
      if (newShiftMultiStaff.length === 0) {
        setError('Please select at least one staff member for multi-staff mode');
        return;
      }
    }
    
    // Format times to ISO string format
    const formatTimeToISO = (date: Date, timeString: string): string => {
      const [hours, minutes] = timeString.split(':').map(Number);
      const dateObj = new Date(date);
      dateObj.setHours(hours, minutes, 0, 0);
      return dateObj.toISOString();
    };
    
    const startDateTime = formatTimeToISO(newShiftDate, newShiftStartTime);
    let endDateTime = formatTimeToISO(newShiftDate, newShiftEndTime);
    
    // Handle shifts that cross midnight
    if (new Date(endDateTime) < new Date(startDateTime)) {
      const nextDay = new Date(newShiftDate);
      nextDay.setDate(nextDay.getDate() + 1);
      endDateTime = formatTimeToISO(nextDay, newShiftEndTime);
    }
    
    // Use fetched rates from state
    let selectedPayRateValue: string | null = null;
    let isSpecialEvent = false;

    if (payRateType === 'static') {
      selectedPayRateValue = fetchedStaticRate;
      isSpecialEvent = false; // Static is not a special event
    } else if (payRateType === 'standard') {
      selectedPayRateValue = fetchedStandardRate;
      isSpecialEvent = true; // Standard rate is for special events
    } else if (payRateType === 'custom') {
      selectedPayRateValue = customPayRate;
      isSpecialEvent = false; // Assume custom rate isn't inherently special event
    }

    const baseShiftData = {
      venue: newShiftVenue,
      staff_user: newShiftStaff || null,
      start_time: startDateTime,
      end_time: endDateTime,
      notes: newShiftNotes,
      status: 'scheduled', // Use valid status choice
      required_security_role: 'sg', // Default to Security Guard
      hourly_rate: selectedPayRateValue ? parseFloat(selectedPayRateValue) : null,
      is_special_event: isSpecialEvent
    };
    
    let success = false;
    
    if (!isShiftRecurring) {
      // Create shift(s) based on mode
      if (isMultiStaffMode) {
        success = await createMultiStaffShifts(
          newShiftVenue,
          newShiftMultiStaff,
          startDateTime,
          endDateTime,
          newShiftNotes,
          selectedPayRateValue ? parseFloat(selectedPayRateValue) : null,
          isSpecialEvent
        );
      } else {
        success = await createShift(baseShiftData);
      }
    } else {
      // Handle recurring shifts
      if (!recurringEndDate) {
        setError('Please select an end date for recurring shifts');
        return;
      }
      
      if (recurringType === '0' && recurringDays.length === 0) {
        setError('Please select at least one day of the week for weekly recurring shifts');
        return;
      }
      
      // Create array of dates for recurring shifts
      const dates: Date[] = [];
      const startDate = new Date(newShiftDate!);
      const endDate = new Date(recurringEndDate);
      
      if (recurringType === '0') { // Weekly recurrence
        // Get day of week for selected days (0-6)
        const selectedDays = recurringDays;
        
        // Generate all dates between start and end date that match selected days
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dayOfWeek = d.getDay();
          if (selectedDays.includes(dayOfWeek)) {
            dates.push(new Date(d));
          }
        }
      } else { // Monthly recurrence
        const dayOfMonth = startDate.getDate();
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          
          // Move to next month
          let nextMonth = currentDate.getMonth() + 1;
          let nextYear = currentDate.getFullYear();
          
          if (nextMonth > 11) {
            nextMonth = 0;
            nextYear += 1;
          }
          
          currentDate = new Date(nextYear, nextMonth, dayOfMonth);
        }
      }
      
      // Create shifts for all generated dates
      let allSuccessful = true;
      for (const date of dates) {
        const shiftDate = new Date(date);
        
        // Create shift with adjusted date
        const recurringShiftData = {
          ...baseShiftData,
          startTime: formatTimeToISO(shiftDate, newShiftStartTime),
          endTime: formatTimeToISO(shiftDate, newShiftEndTime),
        };
        
        // Handle shifts that cross midnight
        if (new Date(recurringShiftData.endTime) < new Date(recurringShiftData.startTime)) {
          const nextDay = new Date(shiftDate);
          nextDay.setDate(nextDay.getDate() + 1);
          recurringShiftData.endTime = formatTimeToISO(nextDay, newShiftEndTime);
        }
        
        const result = await createShift(recurringShiftData);
        if (!result) {
          allSuccessful = false;
          break;
        }
      }
      
      success = allSuccessful;
    }
    
    if (success) {
      // Close dialog and reset form
      handleCloseNewShiftDialog();
      // Reload shifts to show newly created ones
      loadShifts();
    }
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
  const handleUpdateShift = async () => {
    if (!selectedShift) return;

    // Validation
    if (!newShiftDate || !newShiftVenue || !newShiftStartTime || !newShiftEndTime) {
      setError('Please fill out all required fields: date, venue, start time, and end time');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Format times to ISO string format (same logic as create)
      const formatTimeToISO = (date: Date, timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const dateObj = new Date(date);
        dateObj.setHours(hours, minutes, 0, 0);
        return dateObj.toISOString();
      };

      const startDateTime = formatTimeToISO(newShiftDate, newShiftStartTime);
      let endDateTime = formatTimeToISO(newShiftDate, newShiftEndTime);

      // Handle shifts that cross midnight
      if (new Date(endDateTime) < new Date(startDateTime)) {
        const nextDay = new Date(newShiftDate);
        nextDay.setDate(nextDay.getDate() + 1);
        endDateTime = formatTimeToISO(nextDay, newShiftEndTime);
      }

      // Prepare update data with backend format
      const updateData = {
        venue: newShiftVenue,
        staff_user: newShiftStaff || null,
        start_time: startDateTime,
        end_time: endDateTime,
        notes: newShiftNotes || '',
        status: 'scheduled',
        shift_group: selectedShift.shiftGroup || null,
        required_security_role: selectedShift.requiredSecurityRole || 'sg'
      };

      console.log('Updating shift:', selectedShift.id, updateData);

      // Call API to update the shift
      const updatedShift = await updateShift(selectedShift.id.toString(), updateData);

      if (updatedShift) {
        console.log('Shift updated successfully:', updatedShift);
        
        // Update local state with the response
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
        setSelectedShift(null);
        resetNewShiftForm();
        
        // Optionally reload shifts from server to ensure consistency
        await loadShifts();
      } else {
        setError('Failed to update shift. Please try again.');
      }
    } catch (err) {
      console.error('Error updating shift:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating the shift');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle deleting a shift
  const handleDeleteShift = async () => {
    if (!selectedShift) return;

    try {
      setIsLoading(true);
      
      // Call the backend API to delete the shift
      const success = await deleteShift(selectedShift.id.toString());
      
      if (success) {
        // Remove the shift from local state
        const updatedShifts = shifts.filter(shift => shift.id !== selectedShift.id);
        setShifts(updatedShifts);
        setIsConfirmDialogOpen(false);
        setIsEditShiftDialogOpen(false);
        
        // Show success message
        console.log(`Successfully deleted shift ${selectedShift.id}`);
      } else {
        // Show error message
        console.error('Failed to delete shift');
        alert('Failed to delete shift. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('An error occurred while deleting the shift. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle bulk selection toggle
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedShifts(new Set()); // Clear selections when exiting selection mode
    }
  };

  // Handle individual shift selection
  const toggleShiftSelection = (shiftId: number) => {
    const newSelected = new Set(selectedShifts);
    if (newSelected.has(shiftId)) {
      newSelected.delete(shiftId);
    } else {
      newSelected.add(shiftId);
    }
    setSelectedShifts(newSelected);
  };

  // Handle select all shifts
  const selectAllShifts = () => {
    const allShiftIds = new Set(shifts.map(shift => shift.id));
    setSelectedShifts(allShiftIds);
  };

  // Handle clear all selections
  const clearAllSelections = () => {
    setSelectedShifts(new Set());
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedShifts.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedShifts.size} shifts? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      setIsLoading(true);
      const promises = Array.from(selectedShifts).map(shiftId => 
        deleteShift(shiftId.toString())
      );
      
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
      const failCount = results.length - successCount;
      
      // Remove successful deletions from local state
      const deletedIds = new Set<number>();
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          deletedIds.add(Array.from(selectedShifts)[index]);
        }
      });
      
      const updatedShifts = shifts.filter(shift => !deletedIds.has(shift.id));
      setShifts(updatedShifts);
      setSelectedShifts(new Set());
      
      if (failCount > 0) {
        alert(`Deleted ${successCount} shifts successfully. ${failCount} shifts failed to delete.`);
      } else {
        console.log(`Successfully deleted ${successCount} shifts`);
      }
    } catch (error) {
      console.error('Error during bulk delete:', error);
      alert('An error occurred during bulk deletion. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle publishing shifts
  const handlePublishShifts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get all shift IDs
      const shiftIds = shifts.map(shift => shift.id);
      
      if (shiftIds.length === 0) {
        setError('No shifts to publish');
        return;
      }
      
      // Confirm with user
      const confirmed = window.confirm(
        `Are you sure you want to publish ${shiftIds.length} shifts? This will make them visible to staff members.`
      );
      
      if (!confirmed) {
        return;
      }
      
      // Call backend API using publishShifts from api.ts
      const success = await publishShifts(shiftIds.map(String));
      
      if (success) {
        // Update local state to reflect published status
        const updatedShifts = shifts.map(shift => ({
          ...shift,
          isPublished: true,
          status: 'published' as const
        }));
        setShifts(updatedShifts);
        
        console.log(`Successfully published ${shiftIds.length} shifts`);
      } else {
        setError('Failed to publish shifts. Please try again.');
      }
    } catch (err) {
      console.error('Error publishing shifts:', err);
      setError('An error occurred while publishing shifts.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle creating a schedule template
  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Analyze current month's schedule to extract patterns
      const currentMonthShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.date);
        return shiftDate.getMonth() === currentDate.getMonth() &&
               shiftDate.getFullYear() === currentDate.getFullYear();
      });

      if (currentMonthShifts.length === 0) {
        setError('No shifts found in the current month to create a template');
        return;
      }

      // Group shifts by venue and time pattern
      const shiftPatterns = new Map<string, {
        venue: number;
        startTime: string;
        endTime: string;
        daysOfWeek: Set<number>;
        staffCount: number;
      }>();

      currentMonthShifts.forEach(shift => {
        const shiftDate = new Date(shift.date);
        const dayOfWeek = shiftDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const patternKey = `${shift.venueId}-${shift.startTime}-${shift.endTime}`;

        if (!shiftPatterns.has(patternKey)) {
          shiftPatterns.set(patternKey, {
            venue: shift.venueId,
            startTime: shift.startTime,
            endTime: shift.endTime,
            daysOfWeek: new Set([dayOfWeek]),
            staffCount: 1
          });
        } else {
          const pattern = shiftPatterns.get(patternKey)!;
          pattern.daysOfWeek.add(dayOfWeek);
        }
      });

      // Create templates for each unique pattern
      let templatesCreated = 0;
      for (const [patternKey, pattern] of shiftPatterns) {
        try {
          // Use shiftService to create template
          const venue = venues.find(v => v.id === pattern.venue);
          if (!venue) continue;

          const templateSuffix = shiftPatterns.size > 1 ? ` - ${venue.name}` : '';
          
          await shiftService.createShiftTemplate({
            name: `${templateName}${templateSuffix}`,
            description: templateDescription || `Template created from ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} schedule`,
            venueId: pattern.venue,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            dayOfWeek: pattern.daysOfWeek.size === 1 ? Array.from(pattern.daysOfWeek)[0] : null,
            requiresFireSafetyChecks: false,
            requiresCapacityMonitoring: false,
            requiresToiletChecks: false
          });
          
          templatesCreated++;
        } catch (templateError) {
          console.error('Error creating template:', templateError);
        }
      }

      if (templatesCreated > 0) {
        console.log(`Successfully created ${templatesCreated} template(s)`);
        
        // Reset form and close dialog
        setTemplateName('');
        setTemplateDescription('');
        setIsTemplateDialogOpen(false);
      } else {
        setError('Failed to create any templates. Please try again.');
      }

    } catch (err) {
      console.error('Error creating template:', err);
      setError('An error occurred while creating the template.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle opening bulk shift dialog
  const handleOpenBulkShiftDialog = () => {
    // Reset the form to default values
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    setBulkShiftDetails({
      venueId: venues.length > 0 ? venues[0].id : null,
      startDate: today,
      endDate: nextWeek,
      startTime: '20:00',
      endTime: '04:00',
      daysOfWeek: [5, 6], // Default to Friday and Saturday
      selectedStaff: [],
      isSequential: false
    });
    
    setError(null);
    setIsBulkShiftDialogOpen(true);
  };

  // Handle creating bulk shifts
  const handleCreateBulkShifts = async (shifts: Array<{
    venueId: string;
    startTime: string;
    endTime: string;
    staffIds?: number[];
    isSequential?: boolean;
    hourlyRate?: number | null;
    isSpecialEvent?: boolean;
  }>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Attempting to create ${shifts.length} shifts`);
      
      if (!shifts.length) {
        setError('No shifts to create. Please check your selection.');
        setIsLoading(false);
        return;
      }
      
      // Validate shifts data
      for (const shift of shifts) {
        if (!shift.venueId || !shift.startTime || !shift.endTime) {
          setError('Invalid shift data. Please check your inputs.');
          setIsLoading(false);
          return;
        }
      }
      
      const result = await bulkCreateShifts(shifts);
      
      if (result) {
        // Reload shifts after bulk creation
        console.log('Shifts created successfully, reloading data');
        await loadShifts();
        setIsBulkShiftDialogOpen(false);
      } else {
        setError('Failed to create shifts. Please try again.');
      }
    } catch (err) {
      console.error('Error creating bulk shifts:', err);
      setError('An error occurred while creating shifts. ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
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
  const handleCopyShifts = async () => {
    if (!sourceMonth || !targetMonth) {
      setError('Please select both source and target months.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

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

      // Confirm with user
      const confirmed = window.confirm(
        `Are you sure you want to copy ${sourceMonthShifts.length} shifts from ${sourceMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} to ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}?`
      );

      if (!confirmed) {
        return;
      }

      // Create shifts for the target month using the bulk create API
      const shiftsToCreate = [];
      
      for (const shift of sourceMonthShifts) {
        const sourceDate = new Date(shift.date);
        const targetDate = new Date(
          targetMonth.getFullYear(),
          targetMonth.getMonth(),
          sourceDate.getDate()
        );

        console.log(`Processing shift ${shift.id} at ${shift.venueName}:`);
        console.log(`  Source date: ${sourceDate.toDateString()}`);
        console.log(`  Target date: ${targetDate.toDateString()}`);
        console.log(`  Target month validation: ${targetDate.getMonth()} === ${targetMonth.getMonth()}`);

        // Skip if the day doesn't exist in the target month (e.g., Feb 30)
        if (targetDate.getMonth() !== targetMonth.getMonth()) {
          console.log(`  SKIPPED: Invalid date mapping`);
          continue;
        }

        // Format for API first to check the full datetime
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const startDateTime = new Date(`${targetDateStr}T${shift.startTime}:00`);
        
        // Skip shifts that would have start times in the past
        const now = new Date();
        if (startDateTime < now) {
          console.log(`  SKIPPED: Target datetime ${startDateTime.toISOString()} is in the past`);
          continue;
        }

        // Handle overnight shifts - if end time is before start time, it's the next day
        let endDateStr = targetDateStr;
        const startTimeOnly = shift.startTime;
        const endTimeOnly = shift.endTime;
        
        // Check if this is an overnight shift (end time < start time)
        if (endTimeOnly < startTimeOnly) {
          // End time is next day
          const endDate = new Date(targetDate);
          endDate.setDate(endDate.getDate() + 1);
          endDateStr = endDate.toISOString().split('T')[0];
          console.log(`  OVERNIGHT SHIFT detected: End time moved to next day (${endDateStr})`);
        }

        const shiftToCreate: any = {
          venueId: shift.venueId.toString(),
          startTime: `${targetDateStr}T${shift.startTime}:00`,
          endTime: `${endDateStr}T${shift.endTime}:00`,
        };
        
        // Only add staffIds if there's actually a staff member assigned
        if (shift.staffId) {
          shiftToCreate.staffIds = [shift.staffId];
        }
        
        console.log(`  ADDED to create queue:`, shiftToCreate);
        console.log(`  Original shift data:`, {
          id: shift.id,
          venueId: shift.venueId,
          staffId: shift.staffId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime
        });
        shiftsToCreate.push(shiftToCreate);
      }

      if (shiftsToCreate.length === 0) {
        setError('No valid shifts could be created for the target month.');
        return;
      }

      // Use the bulk create API to create the copied shifts
      console.log(`Sending ${shiftsToCreate.length} shifts to bulk create API:`, shiftsToCreate);
      const result = await bulkCreateShifts(shiftsToCreate, true); // Allow past dates for copy operation
      console.log('Bulk create API result:', result);

      if (result && result.length > 0) {
        // Reload shifts to get the updated data
        await loadShifts();

        // Navigate to target month
        setCurrentDate(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1));

        // Close dialog
        setIsCopyShiftsDialogOpen(false);
        setSourceMonth(null);
        setTargetMonth(null);

        console.log(`Successfully copied ${result.length} shifts to ${targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
      } else {
        setError('Failed to copy shifts. Please try again.');
      }

    } catch (err) {
      console.error('Error copying shifts:', err);
      setError('An error occurred while copying shifts.');
    } finally {
      setIsLoading(false);
    }
  };

  // Base command bar items
  const baseCommandBarItems: ICommandBarItemProps[] = [
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
      key: 'selectShifts',
      text: isSelectionMode ? 'Exit Selection' : 'Select Shifts',
      iconProps: { iconName: isSelectionMode ? 'Cancel' : 'MultiSelect' },
      onClick: toggleSelectionMode
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

  // Selection mode command bar items
  const selectionCommandBarItems: ICommandBarItemProps[] = [
    {
      key: 'selectAll',
      text: 'Select All',
      iconProps: { iconName: 'SelectAll' },
      onClick: selectAllShifts,
      disabled: shifts.length === 0
    },
    {
      key: 'clearSelection',
      text: 'Clear Selection',
      iconProps: { iconName: 'ClearSelection' },
      onClick: clearAllSelections,
      disabled: selectedShifts.size === 0
    },
    {
      key: 'bulkDelete',
      text: `Delete (${selectedShifts.size})`,
      iconProps: { iconName: 'Delete' },
      onClick: handleBulkDelete,
      disabled: selectedShifts.size === 0
    }
  ];

  // Add the selection toggle button to selection mode items
  const exitSelectionButton: ICommandBarItemProps = {
    key: 'exitSelection',
    text: 'Exit Selection',
    iconProps: { iconName: 'Cancel' },
    onClick: toggleSelectionMode
  };

  // Combine command bar items based on mode
  const commandBarItems: ICommandBarItemProps[] = isSelectionMode ? 
    [...selectionCommandBarItems, exitSelectionButton] : 
    baseCommandBarItems;

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
    return (
      <Stack tokens={{ childrenGap: 10 }}>
        <Dropdown
          label="Recurrence Pattern"
          options={recurringOptions}
          selectedKey={recurringType}
          onChange={(event, option) => option && setRecurringType(option.key as string)}
        />

        {recurringType === '1' || recurringType === '2' ? (
          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <Label>Repeat on</Label>
            {daysOfWeek.map((day) => (
              <Checkbox
                key={day}
                label={day.substring(0, 3)}
                checked={recurringDays.includes(daysOfWeek.indexOf(day))}
                onChange={(event, checked) => {
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

  // Handle venue filter change
  const handleVenueFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setVenueFilter(value === 'all' ? null : value);
  };
  
  // Handle staff filter change
  const handleStaffFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStaffFilter(value === 'all' ? null : value);
  };
  
  // Apply filters and reload shifts
  const applyFilters = async () => {
    try {
      setIsLoading(true);
      // Get shifts with filters applied
      const filteredShiftsFromApi = await getShifts({
        venueId: venueFilter,
        staffId: staffFilter
      });
      // Map the API response to ScheduleShift type
      const mappedShifts = filteredShiftsFromApi.map(shift => ({
        ...shift,
        id: parseInt(shift.id, 10), // Convert id to number
        venueId: parseInt(shift.venueId, 10), // Convert venueId to number
        staffId: shift.staffId ? parseInt(shift.staffId, 10) : null, // Convert staffId to number or null
        staffName: shift.staffName || null, // Convert undefined staffName to null
        date: new Date(shift.date), // Ensure date is a Date object
        isPublished: false, // Add default value
        isRecurring: false, // Add default value
        // Add other necessary mappings or defaults if needed
      }));
      setShifts(mappedShifts);
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Clear all filters
  const clearFilters = async () => {
    setVenueFilter(null);
    setStaffFilter(null);
    
    try {
      setIsLoading(true);
      // Reload shifts without filters
      const shiftsDataFromApi = await getShifts();
      // Map the API response to ScheduleShift type
      const mappedShifts = shiftsDataFromApi.map(shift => ({
        ...shift,
        id: parseInt(shift.id, 10), // Convert id to number
        venueId: parseInt(shift.venueId, 10), // Convert venueId to number
        staffId: shift.staffId ? parseInt(shift.staffId, 10) : null, // Convert staffId to number or null
        staffName: shift.staffName || null, // Convert undefined staffName to null
        date: new Date(shift.date), // Ensure date is a Date object
        isPublished: false, // Add default value
        isRecurring: false, // Add default value
        // Add other necessary mappings or defaults if needed
      }));
      setShifts(mappedShifts);
    } catch (error) {
      console.error('Error clearing filters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered shifts based on applied filters
  const filteredShifts = shifts.filter(shift => {
    let matchesVenue = true;
    let matchesStaff = true;
    
    if (venueFilter) {
      matchesVenue = shift.venueId === parseInt(venueFilter, 10);
    }
    
    if (staffFilter) {
      matchesStaff = shift.staffId === parseInt(staffFilter, 10);
    }
    
    return matchesVenue && matchesStaff;
  });

  // Add a check for data loading before rendering
  if (isLoading && (!venues.length || !staff.length)) {
    return (
      <MainLayout>
        <Stack tokens={{ childrenGap: 20 }}>
          <Spinner size={SpinnerSize.large} label="Loading schedule data..." />
        </Stack>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Inject hover styles */}
      <div dangerouslySetInnerHTML={{ __html: hoverStyles }} />
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
            onChange={(event, option) => setVenueFilter(option ? String(option.key) : null)}
          />
          <ComboBox
            label="Staff Filter"
            placeholder="Select Staff"
            options={Array.isArray(staff) ? staff.map(s => ({ key: s.id, text: `${s.firstName} ${s.lastName}` })) : []}
            selectedKey={staffFilter}
            onChange={(event, option) => setStaffFilter(option ? String(option.key) : null)}
          />
        </Stack>

        {isLoading ? (
          <Spinner size={SpinnerSize.large} label="Loading schedule..." />
        ) : error ? (
          <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>
        ) : !calendarDays.length ? (
          <MessageBar messageBarType={MessageBarType.warning}>
            No calendar data available. Please try refreshing the page.
          </MessageBar>
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
                    className={`shift-container ${styles.shift} ${shift.staffId ? styles.staffShift : styles.openShift}`}
                    style={{ 
                      position: 'relative',
                      border: isSelectionMode && selectedShifts.has(shift.id) ? '2px solid #0078d4' : undefined,
                      backgroundColor: isSelectionMode && selectedShifts.has(shift.id) ? 
                        (shift.staffId ? '#cce7f8' : '#e8f4e2') : undefined
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelectionMode) {
                        toggleShiftSelection(shift.id);
                      } else {
                        handleEditShift(shift);
                      }
                    }}
                  >
                    {/* Selection checkbox */}
                    {isSelectionMode && (
                      <Checkbox
                        checked={selectedShifts.has(shift.id)}
                        styles={{
                          root: {
                            position: 'absolute',
                            top: '2px',
                            left: '2px',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '3px',
                            padding: '2px'
                          }
                        }}
                        onChange={() => toggleShiftSelection(shift.id)}
                      />
                    )}
                    
                    <div>{shift.venueName || 'Unknown Venue'}</div>
                    <div>{shift.startTime || '--:--'} - {shift.endTime || '--:--'}</div>
                    <div>{shift.staffName || 'Open Shift'}</div>
                    
                    {/* Quick delete button - hide in selection mode */}
                    {!isSelectionMode && (
                    <IconButton
                      iconProps={{ iconName: 'Delete' }}
                      title="Delete shift"
                      styles={{
                        root: {
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          minWidth: '20px',
                          opacity: 0,
                          transition: 'opacity 0.2s'
                        },
                        icon: {
                          fontSize: '10px',
                          color: '#d32f2f'
                        }
                      }}
                      className="shift-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShift(shift);
                        setIsConfirmDialogOpen(true);
                      }}
                    />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* New Shift Dialog */}
        <Dialog
          hidden={!isNewShiftDialogOpen}
          onDismiss={handleCloseNewShiftDialog}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Create New Shift'
          }}
          minWidth={600}
        >
          <form onSubmit={handleNewShiftSubmit}>
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
                onChange={(event, option) => option && setNewShiftVenue(Number(option.key))}
              />

              <Toggle
                label="Multi-Staff Mode"
                checked={isMultiStaffMode}
                onText="Multiple Staff"
                offText="Single Staff"
                onChange={(event, checked) => {
                  setIsMultiStaffMode(checked || false);
                  // Reset selections when mode changes
                  if (checked) {
                    setNewShiftStaff(null);
                  } else {
                    setNewShiftMultiStaff([]);
                  }
                }}
                styles={{ root: { marginBottom: 10 } }}
              />

              {!isMultiStaffMode ? (
                <Dropdown
                  label="Staff Member"
                  placeholder="Select staff (or leave empty for open shift)"
                  options={[
                    { key: 'open', text: 'Open Shift (No Staff Assigned)' },
                    ...(Array.isArray(staff) ? staff.map(s => ({ key: s.id, text: `${s.firstName} ${s.lastName}` })) : [])
                  ]}
                  selectedKey={newShiftStaff || 'open'}
                  onChange={(event, option) => {
                    if (option) {
                      setNewShiftStaff(option.key === 'open' ? null : Number(option.key));
                    }
                  }}
                />
              ) : (
                <div>
                  <Label required>Staff Members</Label>
                  <DetailsList
                    items={Array.isArray(staff) ? staff.map(s => ({
                      id: s.id,
                      name: `${s.firstName} ${s.lastName}`,
                      selected: newShiftMultiStaff.includes(s.id)
                    })) : []}
                    columns={[
                      {
                        key: 'checkbox',
                        name: '',
                        minWidth: 30,
                        maxWidth: 30,
                        onRender: (item) => (
                          <Checkbox
                            checked={item.selected}
                            onChange={(event, checked) => {
                              if (checked) {
                                setNewShiftMultiStaff([...newShiftMultiStaff, item.id]);
                              } else {
                                setNewShiftMultiStaff(newShiftMultiStaff.filter(id => id !== item.id));
                              }
                            }}
                          />
                        )
                      },
                      {
                        key: 'name',
                        name: 'Staff Member',
                        minWidth: 200,
                        onRender: (item) => <Text>{item.name}</Text>
                      }
                    ]}
                    selectionMode={SelectionMode.none}
                    compact={true}
                    styles={{ root: { maxHeight: 200, overflowY: 'auto' } }}
                  />
                  <Text variant="small" styles={{ root: { marginTop: 5, color: '#666' } }}>
                    Selected: {newShiftMultiStaff.length} staff member(s)
                  </Text>
                </div>
              )}

              <Stack horizontal tokens={{ childrenGap: 10 }}>
                <TextField
                  label="Start Time"
                  type="time"
                  value={newShiftStartTime}
                  required
                  onChange={(event, value) => setNewShiftStartTime(value || '')}
                  styles={{ root: { width: '50%' } }}
                />
                <TextField
                  label="End Time"
                  type="time"
                  value={newShiftEndTime}
                  required
                  onChange={(event, value) => setNewShiftEndTime(value || '')}
                  styles={{ root: { width: '50%' } }}
                />
              </Stack>

              <Toggle
                label="Recurring Shift"
                checked={isShiftRecurring}
                onChange={(event, checked) => checked !== undefined && setIsShiftRecurring(checked)}
              />

              {isShiftRecurring && renderRecurringOptions()}

              <Stack tokens={{ childrenGap: 10 }}>
                <Label>Pay Rate {isSettingsLoading ? '(Loading rates...)' : settingsError ? '(Error loading rates)' : ''}</Label>
                <Dropdown
                  label="Select Pay Rate Type"
                  options={[
                    { key: 'static', text: `Static (£${fetchedStaticRate})` },
                    { key: 'standard', text: `Standard (£${fetchedStandardRate})` },
                    { key: 'custom', text: 'Custom' }
                  ]}
                  selectedKey={payRateType}
                  onChange={(_, option) => setPayRateType(option?.key as 'static' | 'standard' | 'custom')}
                  disabled={isSettingsLoading || !!settingsError}
                />
                {payRateType === 'custom' && (
                  <TextField
                    label="Custom Pay Rate (£)"
                    value={customPayRate}
                    onChange={(_, value) => setCustomPayRate(value || '')}
                    type="number"
                    min={0}
                  />
                )}
              </Stack>
            </Stack>

            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
              <DefaultButton text="Cancel" onClick={handleCloseNewShiftDialog} />
              <PrimaryButton 
                text={isLoading ? "Creating..." : "Create Shift"} 
                type="submit"
                disabled={isSettingsLoading || isLoading}
              />
            </Stack>
          </form>
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
            {/* Show shift group information if applicable */}
            {selectedShift?.shiftGroup && (
              <MessageBar messageBarType={MessageBarType.info} isMultiline={false}>
                <Text>
                  <strong>Multi-Staff Shift Group:</strong> This shift is part of a group with{' '}
                  {getGroupShifts(selectedShift.shiftGroup).length} staff members.{' '}
                  Changes will only affect {selectedShift.staffName}'s individual shift.
                </Text>
              </MessageBar>
            )}

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
              onChange={(event, option) => option && setNewShiftVenue(Number(option.key))}
            />

            <Dropdown
              label="Staff Member"
              placeholder="Select staff (or leave empty for open shift)"
              options={[
                { key: 'open', text: 'Open Shift (No Staff Assigned)' },
                ...(Array.isArray(staff) ? staff.map(s => ({ key: s.id, text: `${s.firstName} ${s.lastName}` })) : [])
              ]}
              selectedKey={newShiftStaff || 'open'}
              onChange={(event, option) => {
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
                onChange={(event, value) => setNewShiftStartTime(value || '')}
                styles={{ root: { width: '50%' } }}
              />
              <TextField
                label="End Time"
                type="time"
                value={newShiftEndTime}
                required
                onChange={(event, value) => setNewShiftEndTime(value || '')}
                styles={{ root: { width: '50%' } }}
              />
            </Stack>

            <Toggle
              label="Recurring Shift"
              checked={isShiftRecurring}
              onChange={(event, checked) => checked !== undefined && setIsShiftRecurring(checked)}
            />

            {isShiftRecurring && renderRecurringOptions()}
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton
              text="Delete"
              iconProps={{ iconName: 'Delete' }}
              onClick={() => setIsConfirmDialogOpen(true)}
            />
            <DefaultButton text="Cancel" onClick={() => setIsEditShiftDialogOpen(false)} />
            <PrimaryButton 
              text={isLoading ? "Updating..." : "Update Shift"} 
              onClick={handleUpdateShift}
              disabled={isLoading}
            />
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
            <PrimaryButton 
              text={isLoading ? "Deleting..." : "Delete"} 
              onClick={handleDeleteShift}
              disabled={isLoading}
            />
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
            <Text variant="medium">
              Create a reusable template from the current month's shift schedule. This will analyze the patterns and create templates for each unique venue/time combination.
            </Text>
            
            <TextField
              label="Template Name"
              placeholder="Enter a name for this template"
              value={templateName}
              onChange={(_, newValue) => setTemplateName(newValue || '')}
              required
            />
            <TextField
              label="Description"
              placeholder="Enter a description (optional)"
              value={templateDescription}
              onChange={(_, newValue) => setTemplateDescription(newValue || '')}
              multiline
              rows={3}
            />
            
            {shifts.filter(shift => {
              const shiftDate = new Date(shift.date);
              return shiftDate.getMonth() === currentDate.getMonth() &&
                     shiftDate.getFullYear() === currentDate.getFullYear();
            }).length > 0 && (
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                {shifts.filter(shift => {
                  const shiftDate = new Date(shift.date);
                  return shiftDate.getMonth() === currentDate.getMonth() &&
                         shiftDate.getFullYear() === currentDate.getFullYear();
                }).length} shifts found in {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            )}
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => {
              setIsTemplateDialogOpen(false);
              setTemplateName('');
              setTemplateDescription('');
            }} />
            <PrimaryButton 
              text="Save Template" 
              onClick={handleCreateTemplate}
              disabled={!templateName.trim() || isLoading}
            />
          </Stack>
        </Dialog>

        {/* Copy Shifts Dialog */}
        <Dialog
          hidden={!isCopyShiftsDialogOpen}
          onDismiss={() => setIsCopyShiftsDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Copy Shifts Between Months'
          }}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            <Text variant="medium">
              Select the source month to copy shifts from and the target month to copy shifts to.
            </Text>
            
            <Stack horizontal tokens={{ childrenGap: 10 }}>
              <Stack styles={{ root: { width: '50%' } }}>
                <Label required>Source Month (Copy From)</Label>
                <DatePicker
                  value={sourceMonth || undefined}
                  onSelectDate={(date) => date && setSourceMonth(date)}
                  placeholder="Select source month"
                  isRequired
                  showMonthPickerAsOverlay
                  highlightSelectedMonth
                />
                {sourceMonth && (
                  <Text variant="small" styles={{ root: { color: '#666', marginTop: 5 } }}>
                    {shifts.filter(shift => {
                      const shiftDate = new Date(shift.date);
                      return shiftDate.getMonth() === sourceMonth.getMonth() &&
                             shiftDate.getFullYear() === sourceMonth.getFullYear();
                    }).length} shifts found in this month
                  </Text>
                )}
              </Stack>
              
              <Stack styles={{ root: { width: '50%' } }}>
                <Label required>Target Month (Copy To)</Label>
                <DatePicker
                  value={targetMonth || undefined}
                  onSelectDate={(date) => date && setTargetMonth(date)}
                  placeholder="Select target month"
                  isRequired
                  showMonthPickerAsOverlay
                  highlightSelectedMonth
                />
              </Stack>
            </Stack>

            {sourceMonth && targetMonth && sourceMonth.getTime() === targetMonth.getTime() && (
              <MessageBar messageBarType={MessageBarType.warning}>
                Source and target months are the same. Please select different months.
              </MessageBar>
            )}
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => {
              setIsCopyShiftsDialogOpen(false);
              setSourceMonth(null);
              setTargetMonth(null);
            }} />
            <PrimaryButton 
              text="Copy Shifts" 
              onClick={handleCopyShifts}
              disabled={!sourceMonth || !targetMonth || sourceMonth.getTime() === targetMonth.getTime() || isLoading}
            />
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
              onChange={(event, option) => option && updateBulkShiftDetails('venueId', Number(option.key))}
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
                onChange={(event, value) => value && updateBulkShiftDetails('startTime', value)}
                styles={{ root: { width: '50%' } }}
              />
              <TextField
                label="End Time"
                type="time"
                value={bulkShiftDetails.endTime}
                required
                onChange={(event, value) => value && updateBulkShiftDetails('endTime', value)}
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
                  onChange={(event, checked) => handleDayOfWeekToggle(index, checked)}
                  styles={{ root: { marginRight: 12 } }}
                />
              ))}
            </Stack>

            <Pivot>
              <PivotItem headerText="Select Staff">
                <Stack tokens={{ childrenGap: 10, padding: 10 }}>
                  <Label required>Select Staff Members</Label>
                  <Stack className="staff-selection-container" styles={{ root: { maxHeight: 200, overflowY: 'auto', padding: 10, border: '1px solid #eee'}}}>
                    {staff.map((staffMember) => (
                      <Checkbox
                        key={staffMember.id}
                        label={`${staffMember.firstName} ${staffMember.lastName}`}
                        checked={bulkShiftDetails.selectedStaff.includes(staffMember.id)}
                        onChange={(event, checked) => handleStaffToggle(staffMember.id, checked)}
                        styles={{ root: { marginBottom: 8 } }}
                      />
                    ))}
                  </Stack>
                  
                  {bulkShiftDetails.selectedStaff.length > 1 && (
                    <Stack tokens={{ childrenGap: 5 }}>
                      <Toggle
                        label="Assignment Mode"
                        onText="Sequential (Rotate Staff)"
                        offText="Parallel (All Staff Every Shift)"
                        checked={bulkShiftDetails.isSequential}
                        onChange={(event, checked) => updateBulkShiftDetails('isSequential', !!checked)}
                        styles={{ root: { marginTop: 10 } }}
                      />
                      <Text variant="small" styles={{ root: { color: '#666' } }}>
                        {bulkShiftDetails.isSequential 
                          ? 'Each shift will be assigned to a different staff member in rotation'
                          : 'All selected staff will be assigned to every shift (multi-staff shifts)'
                        }
                      </Text>
                    </Stack>
                  )}
                </Stack>
              </PivotItem>
            </Pivot>
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsBulkShiftDialogOpen(false)} />
            <PrimaryButton text="Create Shifts" onClick={() => {
              try {
                const { venueId, startDate, endDate, startTime, endTime, daysOfWeek, selectedStaff, isSequential } = bulkShiftDetails;
                
                if (!venueId || !startDate || !endDate) {
                  setError('Please select venue and date range');
                  return;
                }
                
                if (!startTime || !endTime) {
                  setError('Please enter start and end times');
                  return;
                }
                
                if (!daysOfWeek || daysOfWeek.length === 0) {
                  setError('Please select at least one day of the week');
                  return;
                }
                
                // Generate shifts for the selected date range and days
                const shiftsToCreate = [];
                const currentDate = new Date(startDate);
                const endDateObj = new Date(endDate);
                let shiftIndex = 0;
                
                console.log(`Generating shifts from ${currentDate.toDateString()} to ${endDateObj.toDateString()}`);
                console.log(`Selected staff: ${selectedStaff.length}, Sequential mode: ${isSequential}`);
                
                while (currentDate <= endDateObj) {
                  const dayOfWeek = currentDate.getDay();
                  if (daysOfWeek.includes(dayOfWeek)) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    
                    let staffIdsForShift: number[] = [];
                    
                    if (selectedStaff.length > 0) {
                      if (isSequential) {
                        // Sequential mode: Rotate through staff members for each shift
                        const staffMemberIndex = shiftIndex % selectedStaff.length;
                        staffIdsForShift = [selectedStaff[staffMemberIndex]];
                      } else {
                        // Parallel mode: Assign all selected staff to each shift
                        staffIdsForShift = [...selectedStaff];
                      }
                    }
                    
                    shiftsToCreate.push({
                      venueId: venueId.toString(),
                      startTime: `${dateStr}T${startTime}:00`,
                      endTime: `${dateStr}T${endTime}:00`,
                      staffIds: staffIdsForShift,
                      isSequential
                    });
                    
                    shiftIndex++;
                  }
                  // Move to next day
                  currentDate.setDate(currentDate.getDate() + 1);
                }
                
                console.log(`Created ${shiftsToCreate.length} shifts for submission`);
                
                if (shiftsToCreate.length > 0) {
                  handleCreateBulkShifts(shiftsToCreate);
                } else {
                  setError('No shifts would be created with the current selection. Please check your date range and days.');
                }
              } catch (error) {
                console.error("Error preparing bulk shifts:", error);
                setError("Failed to prepare shifts. Please check your inputs.");
              }
            }} />
          </Stack>
        </Dialog>
      </Stack>
    </MainLayout>
  );
};

export default ShiftScheduling;