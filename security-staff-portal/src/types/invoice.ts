export interface Invoice {
  id: number;
  staffUser: number;
  staffName: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  status: InvoiceStatus;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REJECTED = 'rejected'
}

export interface InvoiceItem {
  id: number;
  invoice: number;
  shift: number;
  date: string;
  venue: string;
  hoursWorked: number;
  rate: number;
  amount: number;
}

export interface InvoiceFilter {
  startDate?: string;
  endDate?: string;
  status?: InvoiceStatus;
  staffUser?: number;
}

export interface PayRate {
  id: number;
  staffUser: number;
  venueName?: string;
  venue?: number | null; // Null for default rate
  hourlyRate: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
