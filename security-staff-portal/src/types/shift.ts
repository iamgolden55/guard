export interface Shift {
  id: number;
  staffUser: number;
  venue: Venue;
  startTime: string;
  endTime: string | null;
  startSignature: string; // base64 data URL
  endSignature: string | null;
  status: ShiftStatus;
  managerApproved: boolean;
  managerSignature: string | null;
  managerNotes: string | null;
  managerUser: number | null;
  autoCheckout: boolean; // Whether this shift was automatically checked out
  createdAt: string;
  updatedAt: string;
  termsAccepted: boolean; // Flag indicating if the staff has accepted the venue's terms and conditions
}

export enum ShiftStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// New types for shift scheduling
export interface ScheduledShift {
  id: number;
  venue: number; // Venue ID
  venueDetail?: Venue; // Expanded venue details (optional)
  staff: number | null; // Staff ID (null if open shift)
  staffDetail?: StaffProfile; // Expanded staff details (optional)
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  status: ScheduledShiftStatus;
  notes: string | null;
  isPublished: boolean;
  createdBy: number; // Admin ID
  createdAt: string;
  updatedAt: string;
  requiresFireSafetyChecks: boolean;
  requiresCapacityMonitoring: boolean;
  requiresToiletChecks: boolean;
  payRate: number | null;
}

export enum ScheduledShiftStatus {
  SCHEDULED = 'scheduled',  // Planned, not yet active
  OPEN = 'open',            // Available for staff to claim
  ASSIGNED = 'assigned',    // Assigned to specific staff
  CHECKED_IN = 'checked_in', // Staff has started the shift
  COMPLETED = 'completed',  // Shift has ended
  CANCELLED = 'cancelled'   // Shift was cancelled
}

export interface ShiftTemplate {
  id: number;
  name: string;
  description: string | null;
  venue: number; // Venue ID
  startTime: string; // Time only (HH:MM)
  endTime: string; // Time only (HH:MM)
  dayOfWeek: number | null; // 0-6 for Sun-Sat, null if not day-specific
  requiresFireSafetyChecks: boolean;
  requiresCapacityMonitoring: boolean;
  requiresToiletChecks: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringShiftPattern {
  id: number;
  shift: number; // Reference to the original shift
  patternType: RecurringPatternType;
  daysOfWeek: number[]; // Array of days (0-6) for weekly patterns
  interval: number; // For every X days/weeks/etc.
  endDate: string | null; // When the pattern ends
  endOccurrences: number | null; // Alternative: after X occurrences
}

export enum RecurringPatternType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom'
}

export interface StaffProfile {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  qualifications: string[] | null;
  isActive: boolean;
}

export interface Venue {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
  description?: string; // Venue description
  termsAndConditions?: string; // Terms and conditions for staff working at this venue
  requiresFireSafetyChecks?: boolean;
  requiresCapacityMonitoring?: boolean;
  requiresToiletChecks?: boolean;
  maxCapacity?: number;
}

export interface FireExitCheck {
  id: number;
  shift: number;
  timestamp: string;
  exitName: string;
  isPassed: boolean;
  comments: string;
}

export interface CapacityCheck {
  id: number;
  shift: number;
  timestamp: string;
  count: number;
  comments: string;
}

export interface ToiletCheck {
  id: number;
  shift: number;
  timestamp: string;
  location: string;
  condition: ConditionRating;
  comments: string;
}

export enum ConditionRating {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical'
}

export interface EnforcementVisit {
  id: number;
  shift: number;
  timestamp: string;
  officerName: string;
  officerBadge: string;
  reasonForVisit: string;
  actionTaken: string;
  outcome: string;
}
