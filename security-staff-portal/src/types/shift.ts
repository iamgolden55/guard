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

export interface Venue {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
  description?: string; // Venue description
  termsAndConditions?: string; // Terms and conditions for staff working at this venue
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
