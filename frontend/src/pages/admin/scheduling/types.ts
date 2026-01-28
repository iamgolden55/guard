// Types for the Shift Scheduling module

export interface ScheduleShift {
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
  status?: string;
}

export interface BulkShiftDetails {
  venueId: number | null;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  selectedStaff: number[];
  isSequential: boolean;
}

export interface NewShiftFormData {
  date: Date | null;
  venueId: number | null;
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

export interface FilterState {
  venueId: string | null;
  staffId: string | null;
  status: string | null;
}

export type ViewMode = 'month' | 'day';

export type EventType = 'work' | 'open' | 'published' | 'general' | 'personal' | 'break';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: EventType;
  description?: string;
  attendees?: { id: number; name: string; avatar?: string }[];
  shift?: ScheduleShift;
}

export interface PositionedEvent extends CalendarEvent {
  top: number;
  height: number;
  left: number;
  width: number;
  column: number;
  totalColumns: number;
}

export interface TimeSlot {
  hour: number;
  label: string;
  isHalfHour?: boolean;
}

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAYS_OF_WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const RECURRING_OPTIONS = [
  { key: '0', text: 'No recurrence' },
  { key: '1', text: 'Daily' },
  { key: '2', text: 'Weekly' },
  { key: '3', text: 'Bi-weekly' },
  { key: '4', text: 'Monthly' }
] as const;

// Color theme constants - Warm amber palette
export const THEME = {
  // Primary colors
  primary: '#f59e0b',
  primaryHover: '#d97706',
  primaryLight: '#fef3c7',

  // Shift status colors
  shift: {
    assigned: {
      bg: '#fef3c7',
      border: '#f59e0b',
      text: '#92400e'
    },
    open: {
      bg: '#d1fae5',
      border: '#10b981',
      text: '#065f46'
    },
    published: {
      bg: '#ede9fe',
      border: '#8b5cf6',
      text: '#5b21b6'
    }
  },

  // Neutrals
  bg: {
    primary: '#fafafa',
    secondary: '#f5f5f5',
    card: '#ffffff',
    hover: '#f4f4f5'
  },

  text: {
    primary: '#18181b',
    secondary: '#71717a',
    muted: '#a1a1aa'
  },

  border: {
    default: '#e4e4e7',
    light: '#f4f4f5',
    focus: '#f59e0b'
  }
} as const;
