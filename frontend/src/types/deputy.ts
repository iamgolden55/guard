export interface DeputyConfig {
  id: number;
  apiEndpoint: string;
  apiKey: string;
  isActive: boolean;
  lastSyncDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeputyStatus {
  isConnected: boolean;
  lastSyncDate: string | null;
  employeeCount: number;
  timesheetCount: number;
  errorMessage: string | null;
}

export interface DeputyEmployee {
  id: number;
  deputyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  mappedToUser: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeputyTimesheet {
  id: number;
  deputyId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  duration: number;
  shiftNotes: string;
  location: string;
  imported: boolean;
  mappedToShift: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldMapping {
  id: number;
  sourceField: string;
  targetField: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: number;
  entityType: 'employee' | 'timesheet';
  status: 'success' | 'failed';
  message: string;
  recordsProcessed: number;
  createdAt: string;
}
